import httpx
import os
import re
from typing import List, Dict, Any, Optional

NUTRITION_SERVICE_URL = os.getenv("NUTRITION_SERVICE_URL", "http://localhost:8080")

def parse_ingredient(ingredient_str: str) -> Dict[str, Any]:
    """
    Parse an ingredient string like "1 cup flour" or "2 tablespoons olive oil"
    into {name, amount, unit}.
    """
    # Try to extract quantity and unit
    # Pattern: optional number (int or float), optional unit, then ingredient name
    match = re.match(r'^([\d./]+)?\s*([a-z]+)?\s+(.+)$', ingredient_str.strip(), re.IGNORECASE)
    
    if match:
        amount_str, unit, name = match.groups()
        amount = None
        if amount_str:
            try:
                # Handle fractions like "1/2"
                if '/' in amount_str:
                    parts = amount_str.split('/')
                    amount = float(parts[0]) / float(parts[1])
                else:
                    amount = float(amount_str)
            except ValueError:
                amount = None
        
        return {
            "name": name.strip(),
            "amount": amount,
            "unit": unit.strip() if unit else None
        }
    
    # Fallback: just use the whole string as name
    return {
        "name": ingredient_str.strip(),
        "amount": None,
        "unit": None
    }

async def calculate_recipe_nutrition(ingredients: List[str]) -> Optional[Dict[str, Any]]:
    """
    Call the C# nutrition calculator microservice.
    
    Args:
        ingredients: List of ingredient strings like ["1 cup flour", "2 eggs", ...]
    
    Returns:
        Dict with nutrition data and unknown ingredients:
        {
            "nutrition": {calories, protein, carbs, fats},
            "unknown_ingredients": ["ingredient1", "ingredient2", ...]
        }
        or None if service unavailable
    """
    if not ingredients:
        return None
    
    # Parse ingredients into structured format
    parsed_ingredients = [parse_ingredient(ing) for ing in ingredients]
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NUTRITION_SERVICE_URL}/nutrition/estimate",
                json={"ingredients": parsed_ingredients},
                timeout=5.0
            )
            response.raise_for_status()
            data = response.json()
            
            result = {}
            
            # Extract totals from response
            if "totals" in data:
                totals = data["totals"]
                result["nutrition"] = {
                    "calories": int(totals.get("caloriesKcal", 0)),
                    "protein": round(totals.get("proteinG", 0), 1),
                    "carbs": round(totals.get("carbsG", 0), 1),
                    "fats": round(totals.get("fatG", 0), 1)
                }
            
            # Extract unknown ingredients list
            unknown = data.get("unknownIngredients", [])
            if unknown:
                result["unknown_ingredients"] = unknown
            
            return result if result else None
            
    except Exception as e:
        print(f"Nutrition calculation failed: {e}")
        return None
