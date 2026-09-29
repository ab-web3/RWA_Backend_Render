
from pathlib import Path
import json
import os

import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any


# --------------------------------------------------
# 1. Define artifact paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

PREPROCESSOR_PATH = BASE_DIR / "ann_fusion_preprocessor.joblib"
VIT_CHECKPOINT_PATH = BASE_DIR / "tiny_vit_checkpoint.pth"
MANIFEST_PATH = BASE_DIR / "model_manifest.json"


# --------------------------------------------------
# 2. Initialize FastAPI
# --------------------------------------------------

app = FastAPI(
    title="RWA-SAMK ANN-ViT-XAI API",
    description="Backend API for RWA investor eligibility prediction",
    version="1.0.0"
)


# --------------------------------------------------
# 3. Configure CORS
# --------------------------------------------------

# Set FRONTEND_ORIGIN in Render environment variables.
# Example:
# FRONTEND_ORIGIN=https://your-frontend.vercel.app

frontend_origins = os.getenv(
    "FRONTEND_ORIGIN",
    "http://localhost:5173"
)

allowed_origins = [
    origin.strip()
    for origin in frontend_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# 4. Load preprocessing artifact and manifest
# --------------------------------------------------

preprocessor = None
model_manifest = None


@app.on_event("startup")
def load_artifacts():
    global preprocessor, model_manifest

    missing_files = []

    for path in [
        PREPROCESSOR_PATH,
        VIT_CHECKPOINT_PATH,
        MANIFEST_PATH
    ]:
        if not path.exists():
            missing_files.append(path.name)

    if missing_files:
        raise RuntimeError(
            f"Required model files are missing: {missing_files}"
        )

    # Load only trusted artifacts created by your own training process.
    preprocessor = joblib.load(PREPROCESSOR_PATH)

    with open(MANIFEST_PATH, "r", encoding="utf-8") as file:
        model_manifest = json.load(file)

    print("RWA-SAMK artifacts loaded successfully.")


# --------------------------------------------------
# 5. API endpoints
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "RWA-SAMK ANN-ViT-XAI API is running",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "preprocessor_loaded": preprocessor is not None,
        "manifest_loaded": model_manifest is not None,
        "vit_checkpoint_exists": VIT_CHECKPOINT_PATH.exists()
    }


# --------------------------------------------------
# 6. Prediction request structure
# --------------------------------------------------

class PredictionRequest(BaseModel):
    features: dict[str, Any]


@app.post("/predict")
def predict(request: PredictionRequest):
    """
    Expected request format:
    {
        "features": {
            "feature_1": 10,
            "feature_2": 20
        }
    }

    IMPORTANT:
    Replace this placeholder with the exact preprocessing,
    ANN, Tiny ViT, fusion, and prediction logic from your
    trained model pipeline.
    """

    if preprocessor is None:
        raise HTTPException(
            status_code=503,
            detail="Preprocessing artifact is not loaded."
        )

    raise HTTPException(
        status_code=501,
        detail=(
            "Prediction endpoint is not yet connected to the "
            "trained ANN-Tiny ViT-fusion inference pipeline."
        )
    )
