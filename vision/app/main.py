from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .extract import extract_ingredients
from .normalize import normalize_ingredients
import hashlib

app = FastAPI(title="Snap2Serve Vision Service")

# Enable CORS for all origins (development only)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/vision/ingredients")
async def vision_ingredients(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    img_bytes = await image.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Empty upload.")

    # Stable image id (hash)
    image_id = hashlib.sha256(img_bytes).hexdigest()

    # Extract [{name, confidence}, ...]
    detected_raw = await extract_ingredients(
        img_bytes,
        filename=image.filename,
        content_type=image.content_type,
    )

    # Normalize names + dedupe
    detected = normalize_ingredients(detected_raw)

    return {
        "image_id": image_id,
        "ingredients_detected": detected,
    }
