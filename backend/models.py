import numpy as np

class InferenceModel:
    def __init__(self, preprocessor, calibrated_clf):
        self.pre = preprocessor
        self.clf = calibrated_clf

    def predict_proba(self, X):
        X_enc = self.pre.transform(X)
        return self.clf.predict_proba(X_enc)

    def predict(self, X, thr=0.5):
        return (self.predict_proba(X)[:,1] >= thr).astype(int)