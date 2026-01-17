# Snap2Serve Backend

This is the backend service for Snap2Serve, a platform for recipe and vision-based food recognition.

## Features
- FastAPI-based REST API
- Vision service integration for food recognition
- Recipe generation and management
- Claude API integration (optional)

## Project Structure
```
backend/
├── Procfile
├── requirements.txt
├── .env.example
└── app/
    ├── main.py           # FastAPI app entry point
    ├── models.py         # Pydantic models and database models
    ├── routers/
    │   ├── agent.py      # Claude agent endpoints
    │   ├── upload.py     # File upload endpoints
    │   └── vision.py     # Vision service endpoints
    └── services/
        ├── claude_service.py   # Claude API logic
        ├── recipe_service.py   # Recipe logic
        └── vision_service.py   # Vision service logic
```

## Setup
1. Clone the repository and navigate to the backend directory:
   ```sh
   cd backend
   ```
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
3. Copy the example environment file and fill in your values:
   ```sh
   cp .env.example .env
   # Edit .env as needed
   ```
4. Run the FastAPI server (on localhost port 8000):
   ```sh
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## Deployment
- The `Procfile` is provided for deployment on platforms like Heroku.
- Make sure to set all required environment variables in production.

## API Endpoints
- `/upload` - Upload images for recognition
- `/vision` - Vision service endpoints
- `/agent` - Claude agent endpoints
- `/recipes` - Recipe management endpoints

## Environment Variables
See `.env.example` for all required and optional environment variables.

## License
MIT
