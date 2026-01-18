# Nutrition Calculator (C#) Microservice

A lightweight .NET microservice that estimates **rough calories + macros** (protein/carbs/fat) from a recipe ingredient list.

* Endpoint: `POST /nutrition/estimate`
* Data source: `nutrition_db.json` (per-100g nutrition values)
* Purpose: hackathon/demo-friendly “healthy choices” feature

---

## Quickstart

### Prerequisites

* **.NET SDK** installed (recommended: .NET 10+)

  * Check: `dotnet --version`

### Run locally

From this folder (where the `.csproj` is):

```bash
dotnet restore
dotnet run
```

Service will start on:

* `http://localhost:8080`

Test health:

```bash
curl -s http://localhost:8080/health
```

---

## API

### `POST /nutrition/estimate`

**Request**

```json
{
  "ingredients": [
    { "name": "egg", "amount": 2, "unit": "pcs" },
    { "name": "tomato", "amount": 1, "unit": "pcs" },
    { "name": "olive oil", "amount": 1, "unit": "tbsp" }
  ]
}
```

**Response**

```json
{
  "totals": {
    "caloriesKcal": 252.2,
    "proteinG": 27.0,
    "carbsG": 6.1,
    "fatG": 14.8
  },
  "unknownIngredients": [],
  "notes": []
}
```

Notes:

* If an ingredient quantity is missing/unknown, the service may assume **100g** for demo purposes and add a note.
* If an ingredient name is not found in the local DB, it will appear under `unknownIngredients`.

---

## Nutrition Data (`nutrition_db.json`)

This service uses a local lookup DB keyed by canonical ingredient name (lowercase).

Example:

```json
{
  "egg": { "CaloriesKcal": 143, "ProteinG": 13.0, "CarbsG": 1.1, "FatG": 9.5 },
  "tomato": { "CaloriesKcal": 18, "ProteinG": 0.9, "CarbsG": 3.9, "FatG": 0.2 }
}
```

To add ingredients:

1. Add a new key (lowercase).
2. Add per-100g values: `CaloriesKcal`, `ProteinG`, `CarbsG`, `FatG`.

---

## Docker (optional)

Build:

```bash
docker build -t nutrition-cs .
```

Run:

```bash
docker run --rm -p 8080:8080 nutrition-cs
```

---

## Integration (Backend Orchestrator)

If running under Docker Compose and this service is named `nutrition`, your backend can call:

* `http://nutrition:8080/nutrition/estimate`

---

## Troubleshooting

### Port already in use

Change the port by setting `ASPNETCORE_URLS` before running:

**PowerShell**

```powershell
$env:ASPNETCORE_URLS="http://0.0.0.0:5055"
dotnet run
```

Then use:

* `http://localhost:5055`
