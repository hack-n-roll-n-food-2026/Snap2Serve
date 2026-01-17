from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Literal

router = APIRouter()

class VisionRequest(BaseModel):
    image_id: str | None = None
    gcs_uri: str | None = None

class Ingredient(BaseModel):
    name: str
    confidence: float
    source: Literal["label", "ocr", "manual"]

class VisionResponse(BaseModel):
    ingredients: List[Ingredient]

@router.post("/extract", response_model=VisionResponse)
async def extract(req: VisionRequest):
    # TODO (guy #3): call Google Vision label + OCR.
    # For now return empty list so frontend can still work.
    return {"ingredients": []}
