from fastapi import FastAPI, UploadFile, File, HTTPException
from .extract import extract_ingredients
from .normalize import normalize_ingredients

app = FastAPI(title="Snap2Serve Vision Service")

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

    # Step 1: extract (can be stubbed first)
    raw = await extract_ingredients(
        img_bytes,
        filename=image.filename,
        content_type=image.content_type,
    )

    # Step 2: normalize (rules + synonyms)
    normalized = normalize_ingredients(raw)

    return {
        "ingredients_raw": raw,
        "ingredients_normalized": normalized,
        "debug": {
            "filename": image.filename,
            "content_type": image.content_type,
            "bytes": len(img_bytes),
        },
    }
