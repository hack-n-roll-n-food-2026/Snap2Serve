from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any
import uuid

router = APIRouter()

@router.post("/image")
async def upload_image_route(image: UploadFile = File(...)) -> Dict[str, Any]:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    content = await image.read()

    return {
        "image_id": str(uuid.uuid4()),
        "filename": image.filename,
        "content_type": image.content_type,
        "size_bytes": len(content),
        "note": "Image received. (Storage disabled) Plug CV here next."
    }
