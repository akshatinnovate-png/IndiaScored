from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import os
import pymongo
import joblib
import pandas as pd
import numpy as np

from dotenv import load_dotenv
load_dotenv()

# Import your custom modules
from models import InferenceModel
from inference_utils import infer_user, pd_to_tier

# MongoDB connection
client = pymongo.MongoClient(os.getenv("MONGO_URI"))
db = client["bharatscore"]
users_coll = db["users"]

# Load model artifacts
try:
    bundle = joblib.load("artifacts/bharatscore_pipeline_bundle.pkl")
    explainer = bundle["explainer"]
    feature_names = bundle["feature_names"]
    print("Bundle loaded successfully!")
    
    # Try to load the new inference wrapper first
    try:
        inference = joblib.load("artifacts/new_inference_wrapper.pkl")
        print("New inference wrapper loaded successfully!")
    except:
        # If new one doesn't exist, try to create it
        print("Creating new inference wrapper...")
        preprocessor = bundle["preprocessor"]
        calibrated_clf = bundle["calibrated_clf"]
        inference = InferenceModel(preprocessor, calibrated_clf)
        joblib.dump(inference, "artifacts/new_inference_wrapper.pkl")
        print("New inference wrapper created and saved!")
        
except Exception as e:
    print(f"Error loading models: {e}")
    import traceback
    traceback.print_exc()
    bundle = inference = explainer = feature_names = None

app = FastAPI(title="Bharat Score API", description="API for Bharat Score Prediction", version="2.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- MODELS --------------------
class ProfileRequest(BaseModel):
    clerk_user_id: str
    name: str
    gender: str
    state: str
    occupation: str

class OnboardRequest(BaseModel):
    clerk_user_id: str
    user_type: str
    region: str
    sms_count: float
    bill_on_time_ratio: float | None = None
    recharge_freq: float
    sim_tenure: float
    location_stability: float
    income_signal: float
    coop_score: float
    land_verified: int
    age_group: str
    loan_amount_requested: float
    consent: bool = True

class InputData(BaseModel):
    user_type: str
    region: str
    sms_count: float
    bill_on_time_ratio: float
    recharge_freq: float
    sim_tenure: float
    location_stability: float
    income_signal: float
    coop_score: float
    land_verified: int
    age_group: str
    loan_amount_requested: float

# -------------------- HELPERS --------------------
TIER_BINS = [(0.00, 0.05, "A+"), (0.05, 0.10, "A"), (0.10, 0.20, "B"), (0.20, 0.35, "C"), (0.35, 1.00, "D")]

# -------------------- ENDPOINTS --------------------
@app.post("/profile")
def create_or_update_profile(req: ProfileRequest):
    doc = {
        "clerk_user_id": req.clerk_user_id,
        "profile": {
            "name": req.name,
            "gender": req.gender,
            "state": req.state,
            "occupation": req.occupation,
        },
        "has_profile": True,
        "profile_updated_at": datetime.utcnow(),
    }
    users_coll.update_one({"clerk_user_id": req.clerk_user_id}, {"$set": doc}, upsert=True)
    return {"status": "stored", "clerk_user_id": req.clerk_user_id}

@app.get("/profile")
def get_profile(clerk_user_id: str):
    proj = {"_id": 0, "profile": 1, "has_profile": 1, "clerk_user_id": 1}
    user = users_coll.find_one({"clerk_user_id": clerk_user_id}, proj)
    if user and user.get("profile"):
        return {"profile": user["profile"], "has_profile": True}
    return {"profile": None, "has_profile": False}

@app.post("/onboard")
def onboard(req: OnboardRequest):
    if req.bill_on_time_ratio is None:
        req.bill_on_time_ratio = 0.0
    doc = {
        "clerk_user_id": req.clerk_user_id,
        "raw": req.dict(),
        "created": datetime.utcnow(),
        "status": "received"
    }
    inserted_id = users_coll.insert_one(doc).inserted_id
    return {"mongo_id": str(inserted_id), "clerk_user_id": req.clerk_user_id, "status": "stored"}

@app.post("/predict")
def predict(data: InputData):
    if inference is None:
        return {"error": "Model not loaded"}
    
    try:
        df = pd.DataFrame([data.dict()])
        result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)
        return result
    except Exception as e:
        return {"error": f"Prediction failed: {str(e)}"}

@app.get("/predict/{user_id}")
def predict_existing_user(user_id: str):
    """Predict risk for an existing user from database"""
    if inference is None:
        return {"error": "Model not loaded"}
    
    try:
        from bson import ObjectId
        user = users_coll.find_one({"_id": ObjectId(user_id)})
        if not user:
            return {"error": "User not found"}
        
        raw_data = user["raw"]
        df = pd.DataFrame([raw_data])
        result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)
        
        # Optionally save prediction to MongoDB
        users_coll.update_one({"_id": ObjectId(user_id)}, {"$set": {"prediction": result, "status": "predicted"}})
        return result
    except Exception as e:
        return {"error": f"Prediction failed: {str(e)}"}

@app.get("/stats")
def get_stats():
    total_users = users_coll.count_documents({})
    predicted_users = users_coll.count_documents({"prediction": {"$exists": True}})
    return {
        "total_users": total_users,
        "predicted_users": predicted_users,
        "pending_predictions": total_users - predicted_users
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "models_loaded": inference is not None,
        "message": "Bharat Score API v2 is running!"
    }

@app.get("/")
def root():
    return {"message": "Bharat Score API v2 is running!"}