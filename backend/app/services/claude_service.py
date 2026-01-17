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
- recipes: array of 3 recipe ideas (title + short steps + missing_items)
- shopping_list: merged missing items grouped by category
Keep steps short and practical.
"""

def _extract_json(text: str) -> str:
    """
    Handles cases where the model wraps JSON in markdown fences:
    ```json
    {...}
    ```
    """
    text = (text or "").strip()

    # Match ```json ... ``` or ``` ... ```
    m = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # If there's extra text, try to grab the first JSON object
    m2 = re.search(r"(\{.*\}|\[.*\])", text, flags=re.DOTALL)
    if m2:
        return m2.group(1).strip()

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
            max_tokens=800,
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