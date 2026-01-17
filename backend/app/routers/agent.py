from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.claude_service import recommend_recipes

router = APIRouter()

class RecommendRequest(BaseModel):
    ingredients_confirmed: List[str]
    preference_text: str

@router.post("/recommend")
async def recommend(req: RecommendRequest) -> Dict[str, Any]:
    return await recommend_recipes(
        ingredients=req.ingredients_confirmed,
        preference=req.preference_text
    )
