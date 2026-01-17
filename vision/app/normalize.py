import json
import re
from pathlib import Path
from typing import List, Dict, Any

SYN_PATH = Path(__file__).parent / "synonyms.json"

def _load_synonyms() -> dict:
    if not SYN_PATH.exists():
        return {}
    return json.loads(SYN_PATH.read_text(encoding="utf-8"))

SYNONYMS = _load_synonyms()

STOP_WORDS = {
    "fresh", "organic", "chopped", "diced", "sliced", "minced",
    "raw", "cooked", "ripe", "large", "small",
    "boneless", "skinless"
}

UNITS_PATTERN = re.compile(r"\b(\d+(\.\d+)?|1/2|1/4)\b|\b(g|kg|ml|l|tbsp|tsp|cup|cups)\b", re.IGNORECASE)

def _simple_singularize(s: str) -> str:
    if s.endswith("ies") and len(s) > 4:
        return s[:-3] + "y"
    if s.endswith("es") and len(s) > 3:
        return s[:-2]
    if s.endswith("s") and len(s) > 3:
        return s[:-1]
    return s

def _normalize_name(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9\s-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    # remove units / numbers
    s = UNITS_PATTERN.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()

    tokens = [t for t in s.split() if t not in STOP_WORDS]
    s = " ".join(tokens).strip()
    if not s:
        return ""

    s = _simple_singularize(s)
    s = SYNONYMS.get(s, s)
    return s

def normalize_ingredients(detected: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    best = {}  # name -> confidence

    for item in detected:
        name = _normalize_name(str(item.get("name", "")))
        if not name:
            continue
        conf = item.get("confidence", 0.0)
        try:
            conf = float(conf)
        except Exception:
            conf = 0.0
        conf = max(0.0, min(1.0, conf))

        if name not in best or conf > best[name]:
            best[name] = conf

    # stable ordering (optional): highest confidence first
    out = [{"name": k, "confidence": v} for k, v in best.items()]
    out.sort(key=lambda x: x["confidence"], reverse=True)
    return out
