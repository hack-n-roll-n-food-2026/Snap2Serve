package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"golang.org/x/image/draw"
	"golang.org/x/image/webp"
)

const (
	maxUploadBytes = 10 << 20 // 10MB
	defaultMaxDim  = 1280
	defaultJpegQ   = 82
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	})
	mux.HandleFunc("/preprocess", preprocessHandler)

	addr := ":8080"
	log.Println("preprocess-go listening on", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func preprocessHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	// Optional tuning via query params
	maxDim := intParam(r, "max_dim", defaultMaxDim)
	jpegQ := intParam(r, "quality", defaultJpegQ)
	if maxDim < 256 {
		maxDim = 256
	}
	if maxDim > 3000 {
		maxDim = 3000
	}
	if jpegQ < 40 {
		jpegQ = 40
	}
	if jpegQ > 95 {
		jpegQ = 95
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Error(w, "failed to parse multipart form", http.StatusBadRequest)
		return
	}

	file, fh, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "missing form field 'image'", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read all bytes
	origBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "failed to read upload", http.StatusBadRequest)
		return
	}

	origCT := sniffContentType(origBytes, fh)

	img, ct, err := decodeImage(origBytes, origCT)
	if err != nil {
		http.Error(w, "unsupported or invalid image", http.StatusBadRequest)
		return
	}

	// Downscale if needed
	resized := downscale(img, maxDim)

	// Decide output format:
	// - If alpha exists => PNG (preserve transparency)
	// - Else => JPEG (smaller for photos)
	hasAlpha := imageHasAlpha(resized)
	var out bytes.Buffer
	var outCT string

	if hasAlpha {
		outCT = "image/png"
		enc := png.Encoder{CompressionLevel: png.BestCompression}
		if err := enc.Encode(&out, resized); err != nil {
			http.Error(w, "failed to encode png", http.StatusInternalServerError)
			return
		}
	} else {
		outCT = "image/jpeg"
		if err := jpeg.Encode(&out, resized, &jpeg.Options{Quality: jpegQ}); err != nil {
			http.Error(w, "failed to encode jpeg", http.StatusInternalServerError)
			return
		}
	}

	bounds := resized.Bounds()
	w.Header().Set("Content-Type", outCT)
	w.Header().Set("X-Original-Content-Type", ct)
	w.Header().Set("X-Image-Width", strconv.Itoa(bounds.Dx()))
	w.Header().Set("X-Image-Height", strconv.Itoa(bounds.Dy()))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(out.Bytes())
}

func intParam(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func sniffContentType(b []byte, fh *multipart.FileHeader) string {
	// Prefer browser-provided extension hint; else sniff.
	name := strings.ToLower(fh.Filename)
	switch {
	case strings.HasSuffix(name, ".jpg"), strings.HasSuffix(name, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(name, ".png"):
		return "image/png"
	case strings.HasSuffix(name, ".webp"):
		return "image/webp"
	default:
		return http.DetectContentType(b)
	}
}

func decodeImage(b []byte, ct string) (image.Image, string, error) {
	// Allow only jpg/jpeg/png/webp
	switch ct {
	case "image/jpeg", "image/jpg":
		img, err := jpeg.Decode(bytes.NewReader(b))
		return img, "image/jpeg", err
	case "image/png":
		img, err := png.Decode(bytes.NewReader(b))
		return img, "image/png", err
	case "image/webp":
		img, err := webp.Decode(bytes.NewReader(b))
		return img, "image/webp", err
	default:
		// Sometimes sniff returns "application/octet-stream"; try decode based on content too
		// but still restrict to supported decoders:
		if img, err := jpeg.Decode(bytes.NewReader(b)); err == nil {
			return img, "image/jpeg", nil
		}
		if img, err := png.Decode(bytes.NewReader(b)); err == nil {
			return img, "image/png", nil
		}
		if img, err := webp.Decode(bytes.NewReader(b)); err == nil {
			return img, "image/webp", nil
		}
		return nil, "", io.ErrUnexpectedEOF
	}
}

func downscale(src image.Image, maxDim int) image.Image {
	b := src.Bounds()
	w := b.Dx()
	h := b.Dy()

	longest := w
	if h > longest {
		longest = h
	}
	if longest <= maxDim {
		return src // no upscaling
	}

	var nw, nh int
	if w >= h {
		nw = maxDim
		nh = int(float64(h) * (float64(maxDim) / float64(w)))
	} else {
		nh = maxDim
		nw = int(float64(w) * (float64(maxDim) / float64(h)))
	}
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
	return dst
}

func imageHasAlpha(img image.Image) bool {
	// Cheap check: sample pixels in a grid; if any alpha < 255, treat as alpha.
	b := img.Bounds()
	stepX := max(1, b.Dx()/40)
	stepY := max(1, b.Dy()/40)

	for y := b.Min.Y; y < b.Max.Y; y += stepY {
		for x := b.Min.X; x < b.Max.X; x += stepX {
			_, _, _, a := img.At(x, y).RGBA()
			if a != 0xffff {
				return true
			}
		}
	}
	return false
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
