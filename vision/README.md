# Snap2Serve Vision Service

This folder contains the **Vision + Ingredient Normalization** microservice for Snap2Serve.

## What this service does

* Exposes an API endpoint to upload a food image and return:

  * `ingredients_raw`: ingredients detected from the image (initially stubbed)
  * `ingredients_normalized`: cleaned + canonical ingredient names (synonyms + basic rules)

## Endpoints

* `GET /health`
  Returns `{ "ok": true }`

* `POST /vision/ingredients`
  Upload an image and receive detected ingredients (raw + normalized).

## Local setup (Windows/macOS/Linux)

### 1) Create a virtual environment

From `Snap2Serve/vision`:

```bash
python -m venv .venv
```

Activate it:

**Windows (PowerShell):**

```bash
.venv\Scripts\Activate.ps1
```

**Windows (cmd):**

```bash
.venv\Scripts\activate.bat
```

**macOS/Linux:**

```bash
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) (Optional) Environment variables

Copy `.env.example` to `.env` and fill in values if/when you add a vision provider key:

```bash
cp .env.example .env
```

### 4) Run the server

```bash
uvicorn app.main:app --reload --port 8001
```

* API docs: `http://localhost:8001/docs`
* Health check: `http://localhost:8001/health`

## Testing the endpoint

### Using the Swagger UI

Open `http://localhost:8001/docs` and try `POST /vision/ingredients`.

### Using curl (macOS/Linux/Git Bash)

```bash
curl -X POST "http://localhost:8001/vision/ingredients" \
  -H "accept: application/json" \
  -F "image=@path/to/your/image.jpg"
```

Example response:

```json
{
  "ingredients_raw": ["egg", "tomato", "garlic"],
  "ingredients_normalized": ["egg", "tomato", "garlic"],
  "debug": {
    "filename": "image.jpg",
    "content_type": "image/jpeg",
    "bytes": 123456
  }
}
```

## Where to edit things

* `app/main.py`

  * FastAPI routes and request handling
* `app/extract.py`

  * **Ingredient extraction**
  * Starts stubbed; replace with a real vision model/API call later
* `app/normalize.py`

  * Cleaning + canonicalization rules
* `app/synonyms.json`

  * Synonyms map (e.g., `capsicum -> bell pepper`)

## Notes for team integration

* Vision service runs on: `http://localhost:8001`
* Backend Orchestrator should call:

  * `POST http://localhost:8001/vision/ingredients`

## Next steps (planned)

* Replace stub extraction with real Vision API call
* Add optional OCR fallback for grocery labels/packaging
* Finalize response schema with the team
