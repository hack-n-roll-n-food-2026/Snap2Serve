from __future__ import annotations

import asyncio
import json
import mimetypes
import os
import re
import traceback
from typing import Any, Dict, List, Optional, Tuple

import requests
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


def _preprocess_image(
    img_bytes: bytes,
    filename: Optional[str],
    content_type: Optional[str],
) -> Tuple[bytes, str]:
    """
    Calls Go preprocess service. Returns (optimized_bytes, optimized_mime).
    If preprocess fails or PREPROCESS_URL is not set, returns original.
    """
    url = os.getenv("PREPROCESS_URL")
    fallback_mime = content_type or "image/jpeg"
    if not url:
        return img_bytes, fallback_mime

    try:
        files = {
            "image": (
                filename or "upload.jpg",
                img_bytes,
                content_type or "application/octet-stream",
            )
        }
        resp = requests.post(url, files=files, timeout=8)
        resp.raise_for_status()

        out_bytes = resp.content
        out_mime = resp.headers.get("Content-Type", fallback_mime)

        if not out_bytes:
            return img_bytes, fallback_mime

        return out_bytes, out_mime
    except Exception as e:
        print("WARN: preprocess failed, using original image:", repr(e))
        return img_bytes, fallback_mime


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

    # Try direct parse first
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


def _coerce_detected(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = payload.get("ingredients_detected", [])
    if not isinstance(items, list):
        return []

    out: List[Dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue

        name = str(it.get("name", "")).strip()
        if not name:
            continue

        conf = it.get("confidence", 0.0)
        try:
            conf_f = float(conf)
        except Exception:
            conf_f = 0.0
        conf_f = max(0.0, min(1.0, conf_f))

        out.append({"name": name, "confidence": conf_f})

    return out[:25]


def _call_gemini(img_bytes: bytes, mime: str) -> str:
    """
    Synchronous Gemini call. Run it in a thread from async code.
    """
    api_key = os.getenv("GEMINI_API_KEY")  # optional; SDK can also read env itself
    client = genai.Client(api_key=api_key) if api_key else genai.Client()
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


async def extract_ingredients_detected(
    img_bytes: bytes,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Returns: [{ "name": str, "confidence": float }, ...]
    """
    try:
        # 1) Preprocess (in thread to avoid blocking event loop)
        img_bytes_opt, ct_opt = await asyncio.to_thread(
            _preprocess_image, img_bytes, filename, content_type
        )
        print(f"PREPROCESS OK: {len(img_bytes)} -> {len(img_bytes_opt)} bytes, ct={ct_opt}")
        mime = _guess_mime(filename, ct_opt)

        # 2) Gemini call (in thread)
        text = await asyncio.to_thread(_call_gemini, img_bytes_opt, mime)

        # 3) Parse + coerce
        payload = _extract_json_object(text)
        if not payload:
            print("WARN: Could not parse JSON object. Raw text:", repr(text[:400]))
            return []

        return _coerce_detected(payload)

    except Exception as e:
        print("Gemini vision call failed:", repr(e))
        traceback.print_exc()
        return []


# Backward-compatible alias if your main.py still imports extract_ingredients(...)
async def extract_ingredients(
    img_bytes: bytes,
    filename: Optional[str] = None,
    content_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    return await extract_ingredients_detected(img_bytes, filename, content_type)
