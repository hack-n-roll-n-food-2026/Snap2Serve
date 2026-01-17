from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, vision, agent

app = FastAPI(title="Snap2Serve Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(vision.router, prefix="/vision", tags=["vision"])
app.include_router(agent.router, prefix="/agent", tags=["agent"])

@app.get("/health")
def health():
    return {"ok": True}
