from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import traceback
from typing import List, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types

import re

def _extract_json_array(text: str) -> Optional[list]:
    if not text:
        return None

    # Try direct parse first
    try:
        val = json.loads(text)
        return val if isinstance(val, list) else None
    except Exception:
        pass

    # Fallback: find first [...] block
    m = re.search(r"\[[\s\S]*\]", text)
    if not m:
        return None

    try:
        val = json.loads(m.group(0))
        return val if isinstance(val, list) else None
    except Exception:
        return None


load_dotenv()

PROMPT = """
Return ONLY a JSON array of strings.
Each string is a cooking ingredient that is clearly present or strongly implied by the image.

Rules:
- Use short, canonical grocery names (e.g., "tomato", "bell pepper", "soy sauce").
- Do NOT include brands, utensils, plates, "food", "meal", or dish names.
- If unsure, omit it.
- Max 20 items.
Example output: ["tomato","garlic","egg"]
"""

def _guess_mime(filename: Optional[str], content_type: Optional[str]) -> str:
    if content_type and content_type.startswith("image/"):
        return content_type
    if filename:
        mt, _ = mimetypes.guess_type(filename)
        if mt and mt.startswith("image/"):
            return mt
    return "image/jpeg"

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


async def extract_ingredients(
    img_bytes: bytes,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
) -> List[str]:
    mime = _guess_mime(filename, content_type)

    try:
        text = await asyncio.to_thread(_call_gemini, img_bytes, mime)

        # Expect JSON array
        arr = _extract_json_array(text)
        if not arr:
            print("WARN: Could not parse JSON array. Raw text was:", repr(text[:400]))
            return []


        cleaned = [str(x).strip() for x in arr if str(x).strip()]
        return cleaned[:20]

    except Exception as e:
        print("Gemini vision call failed:", repr(e))
        traceback.print_exc()
        return []
