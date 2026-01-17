from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import re
import traceback
from typing import List, Optional, Dict, Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

PROMPT = """
You are extracting cooking ingredients from a photo.

Return ONLY valid JSON (no markdown, no prose) in this exact format:
{
  "ingredients_detected": [
    { "name": "ingredient name", "confidence": 0.0 }
  ]
}

Rules:
- "name" must be a short canonical grocery ingredient name (e.g., "tomato", "bell pepper", "soy sauce").
- Do NOT include brands, utensils, plates, dish names, or vague words like "food".
- If unsure, omit it.
- confidence must be a number between 0.0 and 1.0.
- Max 25 items.
"""

def _guess_mime(filename: Optional[str], content_type: Optional[str]) -> str:
    if content_type and content_type.startswith("image/"):
        return content_type
    if filename:
        mt, _ = mimetypes.guess_type(filename)
        if mt and mt.startswith("image/"):
            return mt
    return "image/jpeg"

def _extract_json_object(text: str) -> Optional[dict]:
    if not text:
        return None
    # Try direct parse
    try:
        val = json.loads(text)
        return val if isinstance(val, dict) else None
    except Exception:
        pass

    # Fallback: find first {...} block
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        val = json.loads(m.group(0))
        return val if isinstance(val, dict) else None
    except Exception:
        return None

def _call_gemini(img_bytes: bytes, mime: str) -> str:
    client = genai.Client()
    model = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

    resp = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=img_bytes, mime_type=mime),
            PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    return resp.text or ""

def _coerce_detected(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Accepts {"ingredients_detected":[{name,confidence},...]}.
    Returns a cleaned list with name str and confidence float in [0,1].
    """
    items = payload.get("ingredients_detected", [])
    if not isinstance(items, list):
        return []

    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        name = str(it.get("name", "")).strip()
        if not name:
            continue
        conf = it.get("confidence", 0.0)
        try:
            conf = float(conf)
        except Exception:
            conf = 0.0
        conf = max(0.0, min(1.0, conf))
        out.append({"name": name, "confidence": conf})

    return out[:25]

async def extract_ingredients(
    img_bytes: bytes,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    mime = _guess_mime(filename, content_type)

    try:
        text = await asyncio.to_thread(_call_gemini, img_bytes, mime)

        payload = _extract_json_object(text)
        if not payload:
            print("WARN: Could not parse JSON object. Raw text:", repr(text[:400]))
            return []

        return _coerce_detected(payload)

    except Exception as e:
        print("Gemini vision call failed:", repr(e))
        traceback.print_exc()
        return []
