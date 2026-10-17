"""Export the trained bundle to JSON so the browser can score without a server.

Writes the fitted preprocessor parameters, every LightGBM tree (the five
calibration folds plus the raw model SHAP explains), the isotonic
calibrators and a copy of the feature knowledge base. Also writes a fixture of reference outputs computed by the real
Python pipeline, which the frontend's model test checks itself against.

    python scripts/export_browser_model.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from indiascored.core.state import get_engine  # noqa: E402
from indiascored.training.synthesis import SynthesisConfig, generate_dataset  # noqa: E402

FRONTEND = BACKEND.parent / "frontend" / "indiascored-ui"
MODEL_OUT = FRONTEND / "public" / "model" / "indiascored-model.json"
FIXTURE_OUT = FRONTEND / "src" / "lib" / "local" / "__fixtures__" / "reference-scores.json"
KB_SOURCE = BACKEND / "indiascored" / "explain" / "feature_knowledge_base.json"
KB_OUT = FRONTEND / "src" / "lib" / "local" / "feature-knowledge-base.json"


def _num(x: float) -> float:
    return float(f"{float(x):.10g}")


def _export_trees(booster, with_counts: bool) -> list[dict]:
    trees = []
    for info in booster.dump_model()["tree_info"]:
        feature, threshold, left, right, value, count = [], [], [], [], [], []

        def walk(node: dict) -> int:
            index = len(feature)
            for column in (feature, threshold, left, right, value, count):
                column.append(0)
            if "split_index" in node:
                assert node["decision_type"] == "<=" and node["missing_type"] == "None"
                feature[index] = node["split_feature"]
                threshold[index] = _num(node["threshold"])
                count[index] = node["internal_count"]
                left[index] = walk(node["left_child"])
                right[index] = walk(node["right_child"])
            else:
                feature[index] = -1
                left[index] = right[index] = -1
                value[index] = _num(node["leaf_value"])
                count[index] = node.get("leaf_count", 0)
            return index

        walk(info["tree_structure"])
        tree = {"f": feature, "t": threshold, "l": left, "r": right, "v": value}
        if with_counts:
            tree["c"] = count
        trees.append(tree)
    return trees


def export() -> None:
    bundle = joblib.load(BACKEND / "artifacts" / "indiascored_pipeline_bundle.pkl")
    pre = bundle["preprocessor"]
    num_pipe, num_cols = pre.named_transformers_["num"], pre.transformers_[0][2]
    cat_pipe, cat_cols = pre.named_transformers_["cat"], pre.transformers_[1][2]

    folds = []
    for calibrated in bundle["calibrated_clf"].calibrated_classifiers_:
        iso = calibrated.calibrators[0]
        folds.append(
            {
                "trees": _export_trees(calibrated.estimator.booster_, with_counts=False),
                "iso_x": [_num(v) for v in iso.X_thresholds_],
                "iso_y": [_num(v) for v in iso.y_thresholds_],
            }
        )

    payload = {
        "format": 1,
        "feature_names": [str(n) for n in bundle["feature_names"]],
        "numeric": {
            "columns": list(num_cols),
            "median": [_num(v) for v in num_pipe.named_steps["impute"].statistics_],
            "mean": [_num(v) for v in num_pipe.named_steps["scale"].mean_],
            "scale": [_num(v) for v in num_pipe.named_steps["scale"].scale_],
        },
        "categorical": {
            "columns": list(cat_cols),
            "most_frequent": [str(v) for v in cat_pipe.named_steps["impute"].statistics_],
            "categories": [[str(c) for c in cats] for cats in cat_pipe.named_steps["encode"].categories_],
        },
        "folds": folds,
        "explainer": {
            "expected_value": _num(np.ravel(bundle["explainer"].expected_value)[0]),
            "trees": _export_trees(bundle["raw_model"].booster_, with_counts=True),
        },
        "metrics": bundle.get("metrics"),
    }
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    MODEL_OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {MODEL_OUT} ({MODEL_OUT.stat().st_size / 1e6:.2f} MB)")
    KB_OUT.write_text(KB_SOURCE.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"wrote {KB_OUT}")

    # Reference outputs from the real pipeline, for the browser port's test.
    engine = get_engine()
    sample = generate_dataset(SynthesisConfig(n_applicants=60, random_seed=7))
    columns = [c for c in sample.columns if c not in ("applicant_id", "true_pd", "defaulted")]
    cases = []
    for row in sample[columns].to_dict(orient="records"):
        record = {k: (v.item() if hasattr(v, "item") else v) for k, v in row.items()}
        card = engine.score(record, top_k=26).as_dict()
        cases.append({"input": record, "score_card": card})
    FIXTURE_OUT.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_OUT.write_text(json.dumps(cases), encoding="utf-8")
    print(f"wrote {FIXTURE_OUT} ({len(cases)} cases)")


if __name__ == "__main__":
    export()
