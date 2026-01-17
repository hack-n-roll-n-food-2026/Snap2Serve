# Image Preprocessing Service (Go)

Fast, lightweight microservice for optimizing and preprocessing images before they're sent to vision APIs. Built with Go for high performance and minimal memory footprint.

## Features

- **Smart Resizing**: Automatically downscales images while maintaining aspect ratio
- **Format Optimization**: 
  - Converts to JPEG for photos (smaller file size)
  - Preserves PNG for images with transparency
  - Supports JPEG, PNG, and WebP input formats
- **Configurable Quality**: Adjust JPEG quality and max dimensions via query parameters
- **Fast & Efficient**: Built with Go for minimal latency and resource usage
- **Health Check**: `/health` endpoint for container orchestration

## API Endpoints

### `POST /preprocess`

Accepts a multipart form upload and returns an optimized image.

**Request:**
```bash
curl -X POST http://localhost:8080/preprocess \
  -F "image=@photo.jpg" \
  -o optimized.jpg
```

**Query Parameters:**
- `max_dim` (optional): Maximum width or height in pixels (default: 1280, range: 256-3000)
- `quality` (optional): JPEG quality (default: 82, range: 40-95)

**Example with parameters:**
```bash
curl -X POST "http://localhost:8080/preprocess?max_dim=1024&quality=90" \
  -F "image=@photo.jpg" \
  -o optimized.jpg
```

**Response Headers:**
- `Content-Type`: Output image type (`image/jpeg` or `image/png`)
- `X-Original-Content-Type`: Input image type
- `X-Image-Width`: Output image width
- `X-Image-Height`: Output image height

**Response Body:**
Binary image data (JPEG or PNG)

### `GET /health`

Health check endpoint for monitoring.

**Response:**
```json
{
  "ok": true
}
```

## Running Locally

### Option 1: Direct with Go

```bash
# Install dependencies
go mod download

# Run the service
go run cmd/preprocess/main.go
```

Service starts on `http://localhost:8080`

### Option 2: With Docker

```bash
# Build image
docker build -t preprocess-go .

# Run container
docker run -p 8080:8080 preprocess-go
```

## Configuration

The service accepts configuration via query parameters on each request:

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `max_dim` | 1280 | 256-3000 | Maximum dimension (width or height) in pixels |
| `quality` | 82 | 40-95 | JPEG compression quality |

## Integration with Snap2Serve

This microservice is used in the image upload pipeline:

1. User uploads raw image from camera/gallery
2. Frontend sends image to `/upload` endpoint in main backend
3. Backend forwards to this Go service for preprocessing
4. Optimized image is then sent to Claude Vision API for ingredient detection

**Benefits:**
- Reduces API costs by sending smaller images to Claude
- Faster upload times for users
- Consistent image format and quality

## Architecture

- **Language**: Go 1.22+
- **Dependencies**: `golang.org/x/image` for image processing
- **Container**: Distroless base for minimal attack surface
- **Max Upload Size**: 10MB
- **Supported Formats**: JPEG, PNG, WebP (input), JPEG/PNG (output)

## Error Handling

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Invalid request (missing image, unsupported format, or file too large) |
| 405 | Method not allowed (only POST is supported) |
| 500 | Internal processing error |

## Performance

- **Startup Time**: < 100ms
- **Processing Time**: 50-200ms for typical images
- **Memory Usage**: < 50MB baseline, peaks at ~100MB during processing
- **Throughput**: 100+ requests/second on modern hardware

## Development

```bash
# Run tests
go test ./...

# Build binary
go build -o preprocess ./cmd/preprocess

# Build for Linux
CGO_ENABLED=0 GOOS=linux go build -o preprocess ./cmd/preprocess

# Run with custom port
PORT=8081 go run cmd/preprocess/main.go
```

## Deployment

### Docker Compose

```yaml
services:
  preprocess:
    build: ./services/preprocess-go
    ports:
      - "8080:8080"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### Environment Variables

None required - all configuration is done via query parameters.

## License

Part of the Snap2Serve project.
