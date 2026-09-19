# BharatScore – AI-Powered Credit Risk Management Platform

<div align="center">

![BharatScore](https://img.shields.io/badge/BharatScore-AI%20Credit%20Scoring-blue)
![Python](https://img.shields.io/badge/Python-3.8+-green)
![React](https://img.shields.io/badge/React-19.1-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.116-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

**Empowering Financial Inclusion Through Alternative Data and Explainable AI**

[Features](#-key-features) • [Installation](#-installation--setup) • [Usage](#-usage) • [API Documentation](#-api-documentation) • [Architecture](#-architecture)

</div>

---

## Table of Contents

- [About](#-about)
- [Problem Statement](#-problem-statement)
- [Solution Overview](#-solution-overview)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Installation & Setup](#-installation--setup)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Model Performance](#-model-performance)
- [Testing Methodology](#-testing-methodology)
- [Limitations](#-limitations)
- [Future Improvements](#-future-improvements)
- [Contributing](#-contributing)
- [References](#-references)
- [License](#-license)

---

## About

BharatScore is an enterprise-grade, AI-powered credit risk management platform designed to address financial inclusion challenges in India and similar emerging markets. By leveraging alternative data sources—including telecom usage, utility bill payments, psychometric assessments, and behavioral signals—BharatScore generates reliable credit scores for individuals who lack traditional financial records.

The platform utilizes advanced machine learning (LightGBM) coupled with explainability frameworks (SHAP, LIME) to compute Probability of Default (PD) and assign transparent risk tiers. This architecture enables financial institutions to make data-driven, compliant decisions about applicants who would otherwise be excluded from formal credit systems.

---

## Problem Statement

### Current Challenges

**For Users (Underbanked & Unbanked):**
- Lack of formal financial records (credit history, CIBIL scores, bank statements)
- Dependency on informal lending channels with predatory interest rates
- Systematic exclusion from accessing capital for education, healthcare, emergencies, or business expansion

**For Financial Institutions:**
- Inability to accurately assess applicants without traditional, reliable data sources
- Elevated risk of defaults due to incomplete or fragmented borrower profiles
- Strict regulatory pressure mandating transparency, fairness, and bias mitigation in credit scoring algorithms

### The Opportunity

With over **190 million unbanked adults** in India and millions more underbanked, there is a substantial market opportunity to leverage alternative data to estimate Probability of Default (PD) securely and provide fair access to credit.

---

## Solution Overview

BharatScore introduces a comprehensive AI-powered credit risk management infrastructure that:

1. **Aggregates Alternative Data**: Processes telecom metadata, utility bill payments, Aadhaar-based verification, demographic details, and psychometric evaluations
2. **Generates Credit Scores**: Computes Probability of Default (PD) and algorithmically assigns transparent risk tiers (A+ to D)
3. **Provides Deep Explainability**: Utilizes SHAP-based feature importance to help underwriters understand the exact variables driving credit decisions
4. **Ensures Regulatory Compliance**: Implements consent-driven data collection compliant with India's DPDP Act
5. **Enables Continuous Improvement**: Features post-loan monitoring hooks for dynamic, real-time score updates

### Solution Workflow

```
User Onboarding → Data Collection → Model Inference → Risk Scoring → Admin Decision → Post-Loan Monitoring
     ↓                  ↓                 ↓              ↓              ↓                    ↓
Aadhaar OCR    Alternative Data    LightGBM Model   PD & Tier    Admin Dashboard    Repayment Tracking
Phone Verify   + Psychometric      + SHAP Explain  + Score      + AI Insights      + Score Updates
```

---

## Key Features

### Generative AI & RAG Engine Integration
-  **Automated Risk Insights**: Utilizes the Ollama Mistral LLM to translate complex SHAP values and LightGBM outputs into natural language summaries.
-  **Contextual Decision Support**: Provides loan officers with easily digestible, RAG-assisted remarks explaining exactly why a specific probability of default was assigned, bridging the gap between raw statistical data and human decision-making.

### For Users
-  **Seamless Onboarding**: Integrated Aadhaar OCR and phone verification for rapid, secure registration
-  **Psychometric Testing**: Interactive, timed, and randomized behavioral assessments to gauge reliability
-  **Streamlined Application**: Category-based loan origination workflows requiring minimal physical documentation
-  **Transparent Results**: Unified dashboard displaying the proprietary BharatScore, psychometric evaluation, and real-time loan status

### For Admins and Underwriters
-  **Intuitive Dashboard**: Comprehensive administrative view of the application pipeline, approval rates, and risk distribution
-  **AI-Driven Support**: Direct visibility into model-generated PD, risk tiers, and feature-level SHAP explanations
-  **Operational Efficiency**: Drastically reduces manual application review time, lowering operational expenditure

### Technical Capabilities
-  **Explainable AI (XAI)**: Native SHAP integration ensures all algorithmic decisions meet regulatory standards for transparency
-  **Dynamic Scoring Engine**: Architecture supports continuous post-loan data ingestion to update scores over the lifecycle of the borrower
-  **Fraud Mitigation**: Algorithmic assessment pacing and randomized questioning prevent manipulation of psychometric evaluations

---

## Technology Stack

### Backend
- **Framework**: FastAPI 0.116.1
- **Language**: Python 3.8+
- **ML Framework**: LightGBM 4.6.0
- **Explainability**: SHAP 0.48.0, LIME
- **Hyperparameter Tuning**: Optuna
- **Data Processing**: Pandas 2.3.1, NumPy 2.2.6, Scikit-learn 1.6.1
- **Database**: MongoDB (via PyMongo)
- **LLM Integration**: Ollama (Mistral model for RAG-based explanations)

### Frontend
- **Framework**: React 19.1.1 with TypeScript 5.8
- **Build Tool**: Vite 7.1.2
- **UI Library**: Radix UI components, Tailwind CSS
- **Routing**: React Router DOM 7.8.2
- **Authentication**: Clerk (React)
- **State Management**: TanStack Query (React Query) 5.85
- **Charts**: Recharts 3.1.2
- **Face Recognition**: face-api.js 0.22.2

### Infrastructure
- **Cloud**: Cloud-based deployment with microservices architecture
- **Security**: AES-256 encryption, granular role-based access control (RBAC)
- **Compliance**: DPDP Act compliant data handling protocols

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ User Portal  │  │ Admin Panel  │  │ Psychometric │         │
│  │   (Clerk)    │  │  Dashboard   │  │     Test     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────┴────────────────────────────────────┐
│                    Backend (FastAPI)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Profile    │  │  Prediction   │  │   Admin      │         │
│  │  Endpoints   │  │   Endpoints   │  │  Endpoints   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    ML Pipeline Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ LightGBM     │  │    SHAP      │  │   Ollama     │         │
│  │  Model       │  │  Explainer   │  │   (RAG)      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    Data Layer (MongoDB)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   User Data  │  │ Applications │  │  Model       │         │
│  │   Collection │  │  Collection  │  │  Artifacts   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Deployment & Scalability Strategy

The system is architected with production-readiness in mind:

- **Microservices Approach**: Decoupled frontend (React/Vite) and backend (FastAPI), allowing independent scaling of the ML inference engine and the UI layer.
- **Containerization Readiness**: Designed to be fully containerized via Docker, enabling seamless deployment to Kubernetes clusters to handle high-throughput loan origination APIs.
- **Asynchronous Processing**: FastAPI foundation supports asynchronous task execution for handling concurrent AI model inferences and database queries efficiently.

---

## Installation & Setup

### Prerequisites

- **Python**: 3.8 or higher
- **Node.js**: 18.x or higher
- **MongoDB**: 4.4 or higher (local or cloud instance)
- **Ollama**: For LLM-based explanations (optional but recommended)
- **Git**: For cloning the repository

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BharatScore/backend
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   Create a `.env` file in the `backend` directory:
   ```env
   MONGO_URI=mongodb://localhost:27017/bharatscore
   # Or use MongoDB Atlas connection string:
   # MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/bharatscore
   ```

5. **Ensure model artifacts are present**
   The following files must exist in `backend/artifacts/`:
   - `bharatscore_pipeline_bundle.pkl`
   - `calibrated_clf.pkl`
   - `feature_names.pkl`
   - `inference_wrapper.pkl`
   - `lgbm_raw_model.pkl`
   - `preprocessor.pkl`

6. **Install Ollama (Optional, for RAG-based explanations)**
   ```bash
   # Visit https://ollama.ai for installation instructions
   # After installation, pull the Mistral model:
   ollama pull mistral
   ```

7. **Run the backend server**
   ```bash
   uvicorn app:app --reload --port 8000
   ```

   The API will be available at `http://localhost:8000`
   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend/bharatscore-ui
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure Clerk Authentication**
   Update `src/main.tsx` with your Clerk publishable key, or set it via environment variable:
   ```typescript
   // Create .env file in frontend/bharatscore-ui/
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

---

## Configuration

### Environment Variables

#### Backend (`.env` file in `backend/`)
```env
MONGO_URI=mongodb://localhost:27017/bharatscore
# Or MongoDB Atlas
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/bharatscore?retryWrites=true&w=majority
```

#### Frontend (`.env` file in `frontend/bharatscore-ui/`)
```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_BASE_URL=http://localhost:8000
```

### Model Configuration

The model maps Probability of Default (PD) to the following risk tiers:
- **A+**: PD < 0.05 (Excellent)
- **A**: PD 0.05 - 0.10 (Good)
- **B**: PD 0.10 - 0.20 (Fair)
- **C**: PD 0.20 - 0.35 (Moderate Risk)
- **D**: PD ≥ 0.35 (High Risk)

Sanction percentages by tier:
- **A+**: 100% of requested amount
- **A**: 95% of requested amount
- **B**: 80% of requested amount
- **C**: 55% of requested amount
- **D**: 0% (rejection)

---

## Usage

### For Users

1. **Authentication**: Register via Clerk and complete SMS/Aadhaar verification
2. **Profile Completion**: Input demographic data, occupation, and financial footprint details
3. **Behavioral Assessment**: Complete the timed psychometric evaluation
4. **Loan Origination**: Submit the requested loan amount and category
5. **Dashboard**: Monitor the real-time BharatScore calculation and approval status

### For Admins

1. **Access**: Log into the secure Admin portal
2. **Pipeline Monitoring**: Review aggregate statistics and pending applications
3. **AI Evaluation**: Analyze individual applications alongside LightGBM output and SHAP waterfall charts
4. **RAG Insights**: Trigger the Ollama LLM to summarize the risk profile in natural language
5. **Decisioning**: Execute approvals, rejections, or flag for manual review

---

## API Documentation

### Base URL
```
http://localhost:8000
```

### Authentication
Most endpoints require `clerk_user_id` as a query parameter or in the request body.

### Key Endpoints

#### Prediction Endpoints

**Predict Credit Score**
```http
POST /predict
Content-Type: application/json

{
  "user_type": "rural",
  "region": "West",
  "sms_count": 150.0,
  "bill_on_time_ratio": 0.85,
  "recharge_freq": 2.5,
  "sim_tenure": 36.0,
  "location_stability": 0.9,
  "income_signal": 0.7,
  "coop_score": 0.8,
  "land_verified": 1,
  "age_group": "30-40",
  "loan_amount_requested": 50000.0,
  "recharge_pattern": "regular",
  "loan_category": "business",
  "psychometric_score": 0.75
}
```

**Response:**
```json
{
  "pd": 0.12,
  "tier": "B",
  "alt_cibil_score": 675.5,
  "eligible_amount": 40000,
  "decision": "Approved",
  "top_shap": [
    {
      "feature": "num__coop_score",
      "shap": 0.15,
      "value_enc": 0.8
    }
  ],
  "final_cibil_score": 675.5,
  "final_tier": "B",
  "loan_approval_probability": 0.88
}
```

For complete endpoint specifications, refer to the Swagger UI at `http://localhost:8000/docs`.

---

## Model Performance

### Performance Metrics

> **Note**: The metrics below reflect performance on a highly constrained synthetic dataset designed to simulate extreme 'thin-file' applicants. The pipeline is architected to scale these metrics significantly as real-world, high-volume production data is ingested.

- **ROC-AUC**: 0.64 (Moderate baseline discrimination)
- **PR-AUC**: 0.32 (Crucial for evaluating highly imbalanced default data)
- **Brier Score**: 0.19 (Indicates strong probability calibration)
- **Precision (defaults)**: 0.87
- **Recall (defaults)**: 0.60
- **F1-Score**: 0.71

### Key Predictive Features (SHAP Analysis)

1. **Cooperative Score**: Community/behavioral trust index
2. **Psychometric Results**: Quantitative mapping of behavioral traits
3. **SMS Activity & Punctuality**: Core indicators of financial discipline and communication stability
4. **SIM Tenure & Land Verification**: Indicators of geographical and asset stability

---

## Testing Methodology

- **Data Engineering**: Processed a synthetic dataset of ~5,000 borrower profiles simulating edge-case behaviors
- **Sampling Strategy**: Stratified random splitting (70% Train, 10% Validation, 20% Test) to preserve class balance for default events
- **Class Imbalance Management**: Deployed SMOTE (Synthetic Minority Over-sampling Technique) combined with class-weight algorithmic adjustments
- **Optimization**: Conducted hyperparameter tuning via Optuna utilizing Bayesian Optimization

---

## Future Improvements

- **Algorithmic Expansion**: Integration of deep learning architectures (e.g., LSTMs) to capture sequential, time-series behavioral patterns in repayment cycles
- **Adaptive Psychometrics**: Transitioning to dynamic question banks powered by generative AI to eliminate test predictability and gaming
- **Scalability**: Implementing Apache Kafka for real-time streaming of telecom metadata and migrating model training to distributed GPU clusters

---

## References

1. T. Aslam and A. Aslam, "Social-Credit+: AI Driven Social Media Credit Scoring Platform," arXiv preprint arXiv:2506.12099, 2025.

2. P. Gupta, "A Comprehensive Guide on Psychometric Credit Scoring," Nected.ai Blog, Feb. 26, 2024. [Online]. Available: https://www.nected.ai/blog/psychometric-credit-scoring

3. J. A. Kumar and S. R. Babu, "Enhancing Credit Scoring with Alternative Data and Machine Learning for Financial Inclusion," South Eastern European Journal of Public Health, 2025.

4. World Bank, "The Use of Alternative Data in Credit Risk Assessment: The Opportunities, Risks, and Challenges," 2023. [Online]. Available: https://documents1.worldbank.org

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

## Team Squirtle – BharatScore Development Team

| Name | Role | Institution | Location |
|------|------|-------------|----------|
| **Krishna** | Lead AIML Engineer | Maharaja Agrasen Institute of Technology | Delhi |
| **Gauri** | Full Stack Engineer | Maharaja Agrasen Institute of Technology | Delhi |
| **Mohit Taneja** | Frontend Developer | Maharaja Agrasen Institute of Technology | Delhi |

---

## Acknowledgments

- LightGBM team for the powerful gradient boosting framework
- SHAP library developers for explainability tools
- Clerk for authentication infrastructure
- All open-source contributors whose libraries made this project possible

---

<div align="center">

**Built with  for Financial Inclusion**

*Empowering millions to access credit through AI and alternative data*

</div>
