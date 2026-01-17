import json
import os
import re
from anthropic import Anthropic
from fastapi import HTTPException

api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    raise RuntimeError("ANTHROPIC_API_KEY is not set")

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
client = Anthropic(api_key=api_key)

SYSTEM = """You are a cooking assistant.
Given ingredients and a dish preference, output JSON with:
- recipes: array of 3 recipe ideas with EXACT structure:
  {
    "title": "recipe name",
    "ingredients": ["item 1", "item 2", ...],
    "short_steps": "brief 1-2 sentence overview of the recipe",
    "instructions": "step 1. step 2. step 3..." (detailed cooking steps as single string),
    "missing_items": ["item1", "item2", ...],
    "nutrition": {
      "calories": approximate calories per serving (number),
      "protein": grams of protein per serving (number),
      "carbs": grams of carbs per serving (number),
      "fats": grams of fats per serving (number)
    }
  }
- shopping_list: {"category": ["item1", "item2"], ...}

CRITICAL RULES:
1. instructions MUST be a single string, not an array. Use newlines (\\n) to separate steps.
2. short_steps should be a brief summary (1-2 sentences) for preview.
3. missing_items MUST list ANY ingredients needed that are NOT in the user's available ingredients list.
4. If a recipe uses only available ingredients, missing_items should be an empty array [].
5. Always include the missing_items field, even if empty.
6. For nutrition, provide reasonable estimates per serving based on typical values for the ingredients and portion sizes. Use whole numbers.

Return ONLY valid JSON. No markdown. No extra text.
"""

def _extract_json(text: str) -> str:
    """
    Handles cases where the model wraps JSON in markdown fences or returns incomplete JSON.
    Extracts and attempts to fix incomplete JSON.
    """
    text = (text or "").strip()

    # First, try to extract from markdown fences
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*?)(?:\n```|$)", text, flags=re.IGNORECASE)
    if m:
        text = m.group(1).strip()
    else:
        # Try to find JSON object without markdown
        m2 = re.search(r"(\{[\s\S]*)", text)
        if m2:
            text = m2.group(1).strip()
    
    # Handle incomplete JSON by trying to close it properly
    text = text.rstrip()
    if text.endswith(","):
        text = text[:-1]  # Remove trailing comma
    
    # Try to close any unclosed brackets
    open_braces = text.count("{") - text.count("}")
    open_brackets = text.count("[") - text.count("]")
    
    if open_brackets > 0:
        text += "]" * open_brackets
    if open_braces > 0:
        text += "}" * open_braces
    
    return text

async def recommend_recipes(ingredients: list[str], preference: str):
    msg = f"""
Ingredients I have: {ingredients}
What I want: {preference}

Return ONLY valid JSON. Do not wrap in markdown. Do not include commentary.
"""

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            system=SYSTEM,
            messages=[{"role": "user", "content": msg}],
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

    raw_text = resp.content[0].text or ""
    cleaned = _extract_json(raw_text)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Model returned invalid JSON",
                "raw": raw_text,
                "cleaned": cleaned,
            },
        )