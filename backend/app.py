from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import os
import pymongo
import joblib
import pandas as pd
from urllib.parse import unquote
import subprocess
import json

from dotenv import load_dotenv
load_dotenv()

# Custom modules
from inference_utils import infer_user, pd_to_tier, aggregate_user_scores

# MongoDB connection
client = pymongo.MongoClient(os.getenv("MONGO_URI"))
db = client["bharatscore"]
users_coll = db["users"]

def ollama_generate(prompt: str, model: str = "mistral"):
    try:
        result = subprocess.run(
            ["ollama", "run", model],
            input=prompt.encode("utf-8"),
            capture_output=True,
            check=True
        )
        return result.stdout.decode("utf-8").strip()
    except subprocess.CalledProcessError as e:
        return f"Error: {e.stderr.decode('utf-8')}"


# Load feature explanation KB //Retrerivel Layer
with open("feature_explanations.json") as f:
    feature_kb = json.load(f)

def retrieve_explanations(top_shap):
    explanations = []
    for f in top_shap:
        feat = f["feature"]
        if feat in feature_kb:
            explanations.append(feature_kb[feat])
    return explanations

# # Mistral Model
# from transformers import pipeline
# import json

# # Load LLM (Mistral)
# generator = pipeline(
#     "text-generation",
#     model="mistralai/Mistral-7B-Instruct-v0.2",
#     device_map="auto",
#     torch_dtype="auto"
# )

# # Load feature explanation KB
# with open("feature_explanations.json") as f:
#     feature_kb = json.load(f)

# def retrieve_explanations(top_shap):
#     explanations = []
#     for f in top_shap:
#         feat = f["feature"]
#         if feat in feature_kb:
#             explanations.append(feature_kb[feat])
#     return explanations


# Simple inference class

def ensure_consistent_output(result: dict) -> dict:
    """Ensure credit score, tier, and probability are always available at top-level"""
    return {
        **result,  # keep everything else
        "final_cibil_score": result.get("final_cibil_score") or result.get("alt_cibil_score"),
        "final_tier": result.get("final_tier") or result.get("tier"),
        "loan_approval_probability": result.get("loan_approval_probability") or (1 - result.get("pd", 0)),
    }

class SimpleInference:
    def __init__(self, preprocessor, calibrated_clf):
        self.pre = preprocessor
        self.clf = calibrated_clf
    
    def predict_proba(self, X):
        X_enc = self.pre.transform(X)
        return self.clf.predict_proba(X_enc)
    
    def predict(self, X, thr=0.5):
        return (self.predict_proba(X)[:,1] >= thr).astype(int)

# Load model bundle
try:
    bundle = joblib.load("artifacts/bharatscore_pipeline_bundle.pkl")
    inference = SimpleInference(bundle["preprocessor"], bundle["calibrated_clf"])
    explainer = bundle["explainer"]
    feature_names = bundle["feature_names"]
    print("Models loaded successfully!")
except Exception as e:
    print(f"Error loading models: {e}")
    import traceback
    traceback.print_exc()
    bundle = inference = explainer = feature_names = None

# FastAPI app
app = FastAPI(title="Bharat Score API", version="2.0")

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
    recharge_pattern: str
    loan_category: str
    psychometric_score: float
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
    recharge_pattern: str
    loan_category: str
    psychometric_score: float

class PsychometricScoreRequest(BaseModel):
    clerk_user_id: str
    psychometric_score: float

class ApplicationUpdateRequest(BaseModel):
    status: str
    remarks: Optional[str] = ""
    admin_notes: Optional[str] = ""

class AIInsightRequest(BaseModel):
    clerk_user_id: str
    application_created: str

# -------------------- HELPER FUNCTIONS --------------------
def find_application_by_timestamp(clerk_user_id: str, timestamp_str: str):
    """Find application with flexible timestamp matching"""
    decoded_timestamp = unquote(timestamp_str)
    
    # Try multiple timestamp formats
    timestamp_variants = [
        decoded_timestamp,
        decoded_timestamp + 'Z' if not decoded_timestamp.endswith('Z') else decoded_timestamp,
        decoded_timestamp.replace('Z', '') if decoded_timestamp.endswith('Z') else decoded_timestamp,
        decoded_timestamp + '.000Z' if '.' not in decoded_timestamp else decoded_timestamp,
        decoded_timestamp.replace('.000Z', 'Z') if '.000Z' in decoded_timestamp else decoded_timestamp,
        decoded_timestamp + '.000000' if '.' not in decoded_timestamp else decoded_timestamp,
        decoded_timestamp.replace('.000000', '') if '.000000' in decoded_timestamp else decoded_timestamp,
    ]
    
    for ts_variant in timestamp_variants:
        application = users_coll.find_one({
            "clerk_user_id": clerk_user_id,
            "created": ts_variant
        })
        if application:
            return application, ts_variant
    
    return None, None

def generate_remark(application_data):
    # Retrieve SHAP feature explanations with values
    explanations = retrieve_explanations(application_data.get("top_shap", []))
    explanations_text = "\n".join([f"- {e}" for e in explanations])

    prompt = f"""
    You are a loan assessment AI assistant.
    Your task is to generate a professional remark (2–3 sentences) 
    for a loan application based on the details and SHAP feature explanations. 

    Application Details:
    - Applicant: {application_data.get("name", "Unknown")}
    - Loan Amount: ₹{application_data.get("loan_amount_requested", "N/A")}
    - Decision: {application_data.get("decision", "N/A")}

    AI Assessment:
    - Credit Score: {application_data.get("alt_cibil_score", "N/A")}
    - Risk Tier: {application_data.get("tier", "N/A")}
    - Approval Probability: {round((1-application_data.get("pd", 0))*100, 1)}%

    SHAP Feature Explanations (feature and its impact on decision):
    {explanations_text}

    Guidelines for the remark:
    - Mention the decision (Approved / Rejected / Review).
    - Highlight 1–2 important SHAP features, including their **impact direction and magnitude** 
      in simple terms:
        * SHAP value > 0 → "positively influenced" (improved approval chances).
        * SHAP value < 0 → "negatively influenced" (raised risk concerns).
        * Large magnitude → "strongly influenced".
        * Small magnitude → "minor influence".
    - Translate SHAP values into easy-to-read phrases like:
        * "strong positive impact (+0.45)" → "significantly improved approval chances".
        * "negative impact (-0.30)" → "raised concerns about repayment ability".
    - For APPROVED: say approval, cite positive SHAP drivers, and mention doc verification.
    - For REJECTED: cite negative SHAP drivers clearly as concerns.
    - For REVIEW: cite uncertain/conflicting SHAP drivers and need for further check.
    - Keep the explanation professional, concise, and easy for a non-technical person to understand.
    """

    return ollama_generate(prompt, model="mistral")



# -------------------- OUPUT NORMALIZED FUNCION  --------------------
def normalize_model_output(app):
    """Extracts credit score, risk tier, and probability consistently from any application doc."""
    model_output = app.get("model_output", app)  # sometimes it's nested, sometimes top-level

    return {
        "final_cibil_score": model_output.get("final_cibil_score"),
        "final_tier": model_output.get("final_tier"),
        "loan_approval_probability": model_output.get("loan_approval_probability"),
    }

# -------------------- ENDPOINTS --------------------

# Profile endpoints
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

# Onboarding
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

# Prediction endpoints
@app.post("/predict")
def predict(data: InputData):
    if inference is None:
        return {"error": "Model not loaded"}
    try:
        df = pd.DataFrame([data.dict()])
        result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)
        result = ensure_consistent_output(result)
        return result
    except Exception as e:
        import traceback
        return {"error": str(e), "details": traceback.format_exc()}

@app.get("/predict/{user_id}")
def predict_existing_user(user_id: str):
    from bson import ObjectId
    if inference is None:
        return {"error": "Model not loaded"}
    user = users_coll.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"error": "User not found"}
    raw_data = user["raw"]
    df = pd.DataFrame([raw_data])
    result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)
    users_coll.update_one({"_id": ObjectId(user_id)}, {"$set": {"prediction": result, "status": "predicted"}})
    return result

# Psychometric endpoints

@app.post("/save-psychometric")
def save_psychometric_score(req: PsychometricScoreRequest):
    score = req.psychometric_score
    if score < 0 or score > 1:
        raise HTTPException(status_code=400, detail="Score must be between 0 and 1")
    
    user = users_coll.find_one({"clerk_user_id": req.clerk_user_id})
    now = datetime.utcnow()
    
    # OPTION 1: Remove all restrictions - users can take test anytime
    # Simply save the score without any time checks
    users_coll.update_one(
        {"clerk_user_id": req.clerk_user_id},
        {"$set": {"psychometric_score": score, "psychometric_taken_at": now}},
        upsert=True
    )
    return {"status": "saved", "clerk_user_id": req.clerk_user_id, "score": score, "taken_at": now}

@app.get("/psychometric-status")
def psychometric_status(clerk_user_id: str):
    user = users_coll.find_one({"clerk_user_id": clerk_user_id})
    if not user or "psychometric_score" not in user:
        return {"completed": False}
    
    return {
        "completed": True,
        "score": user["psychometric_score"],
        "last_test_date": user["psychometric_taken_at"].isoformat() if "psychometric_taken_at" in user else None
    }

# User data endpoints
@app.get("/users")
def get_user_data(clerk_user_id: str):
    apps_cursor = users_coll.find({"clerk_user_id": clerk_user_id}, {"_id": 0})
    applications = list(apps_cursor)
    if not applications:
        raise HTTPException(status_code=404, detail="No applications found")

    # Define required fields for the model
    REQUIRED_FIELDS = {
        "user_type", "region", "sms_count", "bill_on_time_ratio", "recharge_freq",
        "sim_tenure", "location_stability", "income_signal", "coop_score",
        "land_verified", "age_group", "loan_amount_requested", "recharge_pattern",
        "loan_category", "psychometric_score",
    }

    loan_results = []
    for app in applications:
        raw_data = app.get("raw")
        if not raw_data:
            continue

        # Skip if any required field is missing
        if not REQUIRED_FIELDS.issubset(raw_data.keys()):
            print(f"Skipping app due to missing fields: {raw_data}")
            continue

        df = pd.DataFrame([raw_data])
        result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)
        result = ensure_consistent_output(result)

        # Add extra metadata
        result["loan_amount_requested"] = raw_data.get("loan_amount_requested", 0)
        result["created"] = app.get("created")
        result["status"] = app.get("status")
        loan_results.append(result)

    if not loan_results:
        raise HTTPException(status_code=400, detail="No valid applications found for scoring")

    aggregated = aggregate_user_scores(loan_results)

    return {
        "applications": loan_results, 
        "final_cibil_score": aggregated["final_cibil_score"],
        "final_tier": aggregated["final_tier"],
        "loan_count": aggregated["loan_count"],
        "loan_approval_probability": aggregated.get("loan_approval_probability"),
    }

# Admin endpoints
@app.get("/admin/applications-summary")
def admin_applications_summary():
    pipeline = [
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }
        }
    ]
    counts = list(users_coll.aggregate(pipeline))

    total = sum([c["count"] for c in counts])
    summary = {"total_applications": total, "pending": 0, "approved": 0, "issues": 0}

    for c in counts:
        if c["_id"] in ["received", "pending"]:
            summary["pending"] += c["count"]
        elif c["_id"] == "approved":
            summary["approved"] += c["count"]
        elif c["_id"] in ["issue", "rejected"]:
            summary["issues"] += c["count"]

    # Get latest applicants list
    cursor = users_coll.find({}, {
        "_id": 0,
        "clerk_user_id": 1,
        "profile.name": 1,
        "status": 1,
        "created": 1,
        "raw.loan_amount_requested": 1
    }).sort("created", -1)

    applicants = []
    for doc in cursor:
        applicants.append({
            "clerk_user_id": doc.get("clerk_user_id"),
            "name": doc.get("profile", {}).get("name"),
            "status": doc.get("status", "pending"),
            "created": doc.get("created"),
            "loan_amount_requested": doc.get("raw", {}).get("loan_amount_requested", 0)
        })

    summary["applicants"] = applicants
    return summary

@app.get("/admin/applications/{clerk_user_id}")
def admin_application_detail(clerk_user_id: str):
    user_docs = list(users_coll.find({"clerk_user_id": clerk_user_id}))

    if not user_docs:
        raise HTTPException(status_code=404, detail="No applications found for this user")

    profile = user_docs[0].get("profile", {})
    applications = []

    for app in user_docs:
        raw_data = app.get("raw")
        if not raw_data:
            continue

        # Get existing model output or generate new one
        model_result = app.get("model_output")
        if not model_result:
            try:
                df = pd.DataFrame([raw_data])
                model_result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)
                # Save the model output
                users_coll.update_one(
                    {"_id": app["_id"]},
                    {"$set": {"model_output": model_result}}
                )
            except Exception as e:
                model_result = {"error": str(e)}
                
            model_result = ensure_consistent_output(model_result)

        applications.append({
            "raw": raw_data,
            "model_output": model_result,
            "created": app.get("created"),
            "status": app.get("status", "pending"),
            "ai_insight": app.get("ai_insight", ""),
            "admin_remarks": app.get("admin_remarks", ""),
            "admin_notes": app.get("admin_notes", ""),
            "user_notification": app.get("user_notification", {})
        })

    return {
        "clerk_user_id": clerk_user_id,
        "profile": profile,
        "applications": applications
    }

# FIXED: Single application update endpoint with proper timestamp handling
@app.patch("/admin/applications/{clerk_user_id}/{created_timestamp}")
def update_application_status(clerk_user_id: str, created_timestamp: str, update_req: ApplicationUpdateRequest):
    """Update application status with flexible timestamp matching"""
    
    valid_status = {"approved", "rejected", "issue", "pending"}
    if update_req.status not in valid_status:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {valid_status}")

    # Find application with flexible timestamp matching
    application, matched_timestamp = find_application_by_timestamp(clerk_user_id, created_timestamp)
    
    if not application:
        # Debug: Show what timestamps are available
        all_apps = list(users_coll.find(
            {"clerk_user_id": clerk_user_id},
            {"created": 1, "_id": 0}
        ))
        available_timestamps = [str(app.get("created", "")) for app in all_apps]
        
        raise HTTPException(
            status_code=404, 
            detail=f"Application not found. Available timestamps: {available_timestamps}. Searched for: {unquote(created_timestamp)}"
        )

    # Prepare update document
    update_doc = {
        "status": update_req.status,
        "admin_remarks": update_req.remarks,
        "admin_notes": update_req.admin_notes,
        "status_updated_at": datetime.utcnow(),
        "status_updated_by": "admin"
    }
    
    # Generate status-specific message for user
    status_messages = {
        "approved": "Congratulations! Your loan application has been approved. Please visit the nearest branch for document verification and loan disbursement.",
        "rejected": "Your loan application has been declined. Please contact our support team for more information.",
        "issue": "Your application requires additional review. Our team will contact you shortly with next steps.",
        "pending": "Your application is under review. We will update you on the progress soon."
    }
    
    update_doc["user_notification"] = {
        "message": status_messages.get(update_req.status, "Your application status has been updated."),
        "timestamp": datetime.utcnow(),
        "read": False
    }

    # Update using the matched timestamp
    result = users_coll.update_one(
        {"clerk_user_id": clerk_user_id, "created": matched_timestamp},
        {"$set": update_doc}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Failed to update application")

    return {
        "message": "Application updated successfully",
        "clerk_user_id": clerk_user_id,
        "created": matched_timestamp,
        "new_status": update_req.status,
        "admin_remarks": update_req.remarks,
        "user_notification": update_doc["user_notification"]
    }

@app.post("/admin/generate-insight")
async def generate_ai_insight(req: AIInsightRequest):
    """Generate natural language AI insights for admin review"""
    
    # Find the specific application
    app = users_coll.find_one({
        "clerk_user_id": req.clerk_user_id,
        "created": req.application_created
    })
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    raw_data = app.get("raw")
    if not raw_data:
        raise HTTPException(status_code=400, detail="No application data found")
    
    # Generate model prediction if not exists
    try:
        df = pd.DataFrame([raw_data])
        model_result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)
    except Exception as e:
        return {"error": f"Model prediction failed: {str(e)}"}
    
    # Create natural language insight
    profile = app.get("profile", {})
    applicant_name = profile.get("name", "Unknown User")
    loan_amount = raw_data.get("loan_amount_requested", 0)
    
    # Build insight based on model output
    insight = f"AI Assessment for {applicant_name}:\n\n"
    
    if model_result.get("final_cibil_score"):
        score = model_result["final_cibil_score"]
        insight += f"• Bharat Credit Score: {score}/1000 "
        if score >= 700:
            insight += "(Excellent creditworthiness)\n"
        elif score >= 600:
            insight += "(Good creditworthiness)\n"
        elif score >= 400:
            insight += "(Fair creditworthiness - requires careful evaluation)\n"
        else:
            insight += "(Poor creditworthiness - high risk)\n"
    
    if model_result.get("loan_approval_probability"):
        prob = model_result["loan_approval_probability"] * 100
        insight += f"• Approval Probability: {prob:.1f}%\n"
    
    if model_result.get("final_tier"):
        tier = model_result["final_tier"]
        insight += f"• Risk Category: {tier}\n"
    
    if model_result.get("recommended_interest_rate"):
        rate = model_result["recommended_interest_rate"]
        insight += f"• Recommended Interest Rate: {rate}% per annum\n"
    
    # Add key factors analysis
    if model_result.get("top_factors"):
        insight += "\nKey Decision Factors:\n"
        for factor, impact in model_result["top_factors"].items():
            factor_name = factor.replace("_", " ").title()
            impact_text = "positively influences" if impact > 0 else "negatively impacts"
            insight += f"• {factor_name} {impact_text} the decision\n"
    
    # Add recommendation based on approval probability
    if model_result.get("loan_approval_probability"):
        prob = model_result["loan_approval_probability"]
        insight += "\nAI Recommendation: "
        if prob >= 0.7:
            insight += "APPROVE - Strong candidate with low risk profile"
        elif prob >= 0.4:
            insight += "REVIEW - Moderate risk, consider additional verification"
        else:
            insight += "HIGH RISK - Requires careful manual assessment"
    
    # Store the insight in database
    users_coll.update_one(
        {"clerk_user_id": req.clerk_user_id, "created": req.application_created},
        {"$set": {
            "ai_insight": insight,
            "ai_insight_generated_at": datetime.utcnow(),
            "model_output": model_result
        }}
    )
    
    return {
        "insight": insight,
        "model_output": model_result,
        "generated_at": datetime.utcnow()
    }

# User notification endpoints
@app.get("/user/notifications")
def get_user_notifications(clerk_user_id: str):
    """Get all notifications for a user"""
    
    applications = list(users_coll.find(
        {"clerk_user_id": clerk_user_id, "user_notification": {"$exists": True}},
        {"_id": 0, "user_notification": 1, "status": 1, "created": 1, "admin_remarks": 1}
    ).sort("created", -1))
    
    notifications = []
    for app in applications:
        if "user_notification" in app:
            notifications.append({
                "message": app["user_notification"]["message"],
                "timestamp": app["user_notification"]["timestamp"],
                "read": app["user_notification"].get("read", False),
                "status": app["status"],
                "application_date": app["created"],
                "admin_remarks": app.get("admin_remarks", "")
            })
    
    return {"notifications": notifications}

@app.post("/user/notifications/mark-read")
def mark_notifications_read(clerk_user_id: str):
    """Mark all notifications as read for a user"""
    
    users_coll.update_many(
        {"clerk_user_id": clerk_user_id, "user_notification.read": False},
        {"$set": {"user_notification.read": True}}
    )
    
    return {"message": "All notifications marked as read"}

@app.get("/user/notifications/{clerk_user_id}")
def get_user_notifications_detailed(clerk_user_id: str):
    """Get all notifications for a user with detailed application info"""
    
    applications = list(users_coll.find(
        {"clerk_user_id": clerk_user_id, "user_notification": {"$exists": True}},
        {
            "_id": 0, 
            "user_notification": 1, 
            "status": 1, 
            "created": 1, 
            "admin_remarks": 1,
            "raw.loan_amount_requested": 1,
            "raw.loan_category": 1,
            "model_output.final_cibil_score": 1,
            "model_output.final_tier": 1,
            "profile.name": 1
        }
    ).sort("user_notification.timestamp", -1))
    
    notifications = []
    for app in applications:
        if "user_notification" in app:
            notifications.append({
                "id": f"{clerk_user_id}_{app['created']}",
                "message": app["user_notification"]["message"],
                "timestamp": app["user_notification"]["timestamp"],
                "read": app["user_notification"].get("read", False),
                "status": app["status"],
                "application_date": app["created"],
                "admin_remarks": app.get("admin_remarks", ""),
                "loan_amount": app.get("raw", {}).get("loan_amount_requested", 0),
                "loan_category": app.get("raw", {}).get("loan_category", ""),
                "cibil_score": app.get("model_output", {}).get("final_cibil_score"),
                "risk_tier": app.get("model_output", {}).get("final_tier"),
                "applicant_name": app.get("profile", {}).get("name", "")
            })
    
    return {"notifications": notifications}

@app.get("/user/notifications/count/{clerk_user_id}")
def get_unread_notification_count(clerk_user_id: str):
    """Get count of unread notifications for a user"""
    
    count = users_coll.count_documents({
        "clerk_user_id": clerk_user_id, 
        "user_notification.read": False
    })
    
    return {"unread_count": count}

@app.patch("/user/notifications/{clerk_user_id}/mark-read")
def mark_specific_notification_read(clerk_user_id: str, notification_id: str = None):
    """Mark specific notification as read"""
    
    if notification_id:
        # Extract created timestamp from notification_id
        try:
            created_str = notification_id.split(f"{clerk_user_id}_")[1]
            users_coll.update_one(
                {
                    "clerk_user_id": clerk_user_id, 
                    "created": created_str,
                    "user_notification.read": False
                },
                {"$set": {"user_notification.read": True}}
            )
        except IndexError:
            pass
    else:
        # Mark all as read
        users_coll.update_many(
            {"clerk_user_id": clerk_user_id, "user_notification.read": False},
            {"$set": {"user_notification.read": True}}
        )
    
    return {"message": "Notification(s) marked as read"}

@app.get("/user/applications/{clerk_user_id}")
def get_user_applications_with_notifications(clerk_user_id: str):
    """Get user applications with latest notification status"""
    try:
        applications = list(users_coll.find(
            {"clerk_user_id": clerk_user_id},
            {
                "_id": 0,
                "created": 1,
                "status": 1,
                "raw": 1,
                "model_output": 1,
                "user_notification": 1,
                "admin_remarks": 1,
                "admin_notes": 1,
                "status_updated_at": 1,
                "status_updated_by": 1
            }
        ).sort("created", -1).limit(50))
        
        return {
            "applications": applications,
            "total_count": len(applications)
        }
    except Exception as e:
        print(f"Error fetching applications: {e}")
        return {"applications": [], "total_count": 0, "error": str(e)}
    
    
# RAG Endpoint
# @app.post("/generate-remark")
# def generate_remark_endpoint(data: InputData):
#     if inference is None:
#         raise HTTPException(status_code=500, detail="Model not loaded")
#     try:
#         df = pd.DataFrame([data.dict()])
#         result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)
#         remark = generate_remark(result)
#         result["ai_remark"] = remark
#         return result
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-remark")
def generate_remark_endpoint(data: InputData):
    # Convert incoming JSON to DataFrame
    df = pd.DataFrame([data.dict()])

    # Run model inference + SHAP explanation
    result = infer_user(df, inference, explainer, feature_names, top_k_shap=5)

    # Generate AI remark using Ollama + retrieved explanations
    remark = generate_remark(result)
    result["ai_remark"] = remark

    return result



# Health check
@app.get("/health")
def health_check():
    return {"status": "healthy", "models_loaded": inference is not None, "explainer_loaded": explainer is not None}

@app.get("/")
def root():
    return {"message": "Bharat Score API v2 is running!"}

# Normalize model output endpoint
# @app.get("/user/normalized/{clerk_user_id}")
# def get_normalized_user_scores(clerk_user_id: str):
#     docs = list(users_coll.find({"clerk_user_id": clerk_user_id}))
#     if not docs:
#         raise HTTPException(status_code=404, detail="No applications found")

#     normalized_list = [normalize_model_output(app) for app in docs]
    
#     # Take last/latest app for summary
#     latest = normalized_list[0]
#     return {
#         "latest": latest,
#         "all": normalized_list
#     }

