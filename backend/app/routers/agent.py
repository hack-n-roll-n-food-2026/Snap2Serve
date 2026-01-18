from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.claude_service import recommend_recipes
from app.services.nutrition_service import calculate_recipe_nutrition

router = APIRouter()

class RecommendRequest(BaseModel):
    ingredients_confirmed: List[str]
    preference_text: str

@router.post("/recommend")
async def recommend(req: RecommendRequest) -> Dict[str, Any]:
    result = await recommend_recipes(
        ingredients=req.ingredients_confirmed,
        preference=req.preference_text
    )
    
    # Enrich each recipe with nutrition data from microservice
    recipes = result.get("recipes", [])
    for recipe in recipes:
        ingredients = recipe.get("ingredients", [])
        if ingredients:
            nutrition_data = await calculate_recipe_nutrition(ingredients)
            if nutrition_data:
                # Override AI-generated nutrition with actual calculated values
                if "nutrition" in nutrition_data:
                    recipe["nutrition"] = nutrition_data["nutrition"]
                # Add unknown ingredients info
                if "unknown_ingredients" in nutrition_data:
                    recipe["unknown_ingredients"] = nutrition_data["unknown_ingredients"]
    
    return result
