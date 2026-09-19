import numpy as np
import pandas as pd

# Constants from your model
TIER_BINS = [(0.00, 0.05, "A+"), (0.05, 0.10, "A"), (0.10, 0.20, "B"), (0.20, 0.35, "C"), (0.35, 1.00, "D")]
SANCTION_PCT = {"A+": 1.0, "A": 0.95, "B": 0.80, "C": 0.55, "D": 0.0}

def pd_to_alt_cibil(pd_value, scale_min=300, scale_max=900):
    p = np.clip(pd_value, 1e-6, 1-1e-6)
    x = -np.log(p / (1 - p))
    xmin, xmax = -6, 6
    xnorm = (x - xmin) / (xmax - xmin)
    xnorm = np.clip(xnorm, 0, 1)
    score = scale_min + (scale_max - scale_min) * xnorm
    return float(score)

def pd_to_tier(pd_value):
    for lo, hi, tier in TIER_BINS:
        if lo <= pd_value < hi:
            return tier
    return "D"

def sanction_amount(requested_amount, tier):
    pct = SANCTION_PCT.get(tier, 0.0)
    return int(np.floor(requested_amount * pct))

def feature_engineer_df(df_in):
    """Feature engineering function from your model"""
    df = df_in.copy()
    if "loan_amount_requested" in df.columns:
        df["loan_amount_log"] = np.log1p(df["loan_amount_requested"])
    if "sms_count" in df.columns:
        # simple normalization
        df["sms_norm"] = df["sms_count"] / (df["sms_count"].max() + 1)
    return df

def infer_user(df_row, model_inference, explainer=None, feature_names=None, top_k_shap=3):
    """
    Complete inference function from your model
    """
    # Apply feature engineering
    df_row_fe = feature_engineer_df(df_row)
    
    # Get prediction
    pd_val = float(model_inference.predict_proba(df_row_fe)[:, 1][0])
    alt_score = pd_to_alt_cibil(pd_val)
    tier = pd_to_tier(pd_val)
    
    requested = int(df_row_fe["loan_amount_requested"].values[0]) if "loan_amount_requested" in df_row_fe.columns else 0
    eligible = sanction_amount(requested, tier)
    
    decision = "Approved" if tier in ["A+", "A", "B", "C"] and eligible > 0 else "Rejected"
    
    result = {
        "pd": pd_val,
        "tier": tier,
        "alt_cibil_score": alt_score,
        "eligible_amount": eligible,
        "decision": decision,
    }
    
    # Add SHAP values if explainer is available
    if explainer is not None and feature_names is not None:
        try:
            X_enc_row = model_inference.pre.transform(df_row_fe)
            shap_vals_row_out = explainer.shap_values(X_enc_row)
            
            if isinstance(shap_vals_row_out, list):
                shap_vals_row = shap_vals_row_out[1]
            else:
                shap_vals_row = shap_vals_row_out
            
            vals = shap_vals_row[0]
            abs_idx = np.argsort(np.abs(vals))[::-1][:top_k_shap]
            top_shap = [{"feature": feature_names[i], "shap": float(vals[i]), "value_enc": float(X_enc_row[0, i])} for i in abs_idx]
            result["top_shap"] = top_shap
        except Exception as e:
            result["top_shap"] = []
            print(f"SHAP calculation failed: {e}")
    else:
        result["top_shap"] = []
    
    return result

def aggregate_user_scores(loans):
    """
    Aggregate multiple loan results into a final alt_cibil score and tier.
    Weighted by loan_amount_requested.
    """
    if not loans:
        return {
            "final_cibil_score": None,
            "final_tier": None,
            "loan_count": 0
        }
    
    total_weight = sum(l.get("loan_amount_requested", 1) for l in loans)
    weighted_score = sum(l["alt_cibil_score"] * l.get("loan_amount_requested", 1) for l in loans) / total_weight

    # Map aggregated score back into tier
    if weighted_score >= 750:
        final_tier = "A+"
    elif weighted_score >= 700:
        final_tier = "A"
    elif weighted_score >= 650:
        final_tier = "B"
    elif weighted_score >= 600:
        final_tier = "C"
    else:
        final_tier = "D"

    return {
        "final_cibil_score": round(weighted_score, 2),
        "final_tier": final_tier,
        "loan_count": len(loans)
    }