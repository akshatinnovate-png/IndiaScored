# test_imports.py - Run this to test your setup
import sys
import os

print("Current directory:", os.getcwd())
print("Python path:", sys.path)

try:
    from models import InferenceModel
    print("✓ Successfully imported InferenceModel")
except ImportError as e:
    print("✗ Failed to import InferenceModel:", e)

try:
    from inference_utils import infer_user, pd_to_tier
    print("✓ Successfully imported inference_utils")
except ImportError as e:
    print("✗ Failed to import inference_utils:", e)

# Test loading individual pickle files
import joblib

try:
    bundle = joblib.load("artifacts/bharatscore_pipeline_bundle.pkl")
    print("✓ Successfully loaded bundle")
    print("Bundle keys:", bundle.keys() if isinstance(bundle, dict) else "Not a dict")
except Exception as e:
    print("✗ Failed to load bundle:", e)

try:
    inference = joblib.load("artifacts/inference_wrapper.pkl")
    print("✗ Still failing to load inference_wrapper.pkl:", "This is expected")
except Exception as e:
    print("✗ Failed to load inference_wrapper.pkl:", e)