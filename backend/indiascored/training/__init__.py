"""Data generation and model training.

Imported by ``notebooks/IndiaScored_Model_Development.ipynb`` so the notebook
stays readable and the training code stays testable and re-runnable from a
terminal.
"""

from .synthesis import SynthesisConfig, generate_dataset
from .pipeline import TrainingConfig, build_preprocessor, train_bundle

__all__ = [
    "SynthesisConfig",
    "generate_dataset",
    "TrainingConfig",
    "build_preprocessor",
    "train_bundle",
]
