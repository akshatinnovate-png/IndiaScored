import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Phone,
  Users,
  CreditCard,
} from 'lucide-react';

import { api } from '@/lib/api';
import type {
  AgeGroup,
  AlternativeData,
  LoanCategory,
  RechargePattern,
  Region,
  ScoreCard,
  UserType,
} from '@/lib/types';

/**
 * The form collects what an applicant can actually answer; the model wants a
 * normalised vector. Everything below is that translation, kept in one place
 * so a wrong mapping shows up here rather than as a 422 at submit time.
 */

/** The form's own categories, mapped onto the four the model was trained on. */
const LOAN_CATEGORY_MAP: Record<string, LoanCategory> = {
  personal: 'personal',
  agriculture: 'farmer',
  business: 'startup',
  education: 'education',
};

/** Four answer options collapse onto the model's three recharge patterns. */
const RECHARGE_PATTERN_MAP: Record<string, RechargePattern> = {
  always: 'always_on_time',
  mostly: 'always_on_time',
  sometimes: 'sometimes_late',
  rarely: 'often_late',
};

/** How regularly a pack is renewed, as a 0-1 score. */
const RECHARGE_REGULARITY_SCORE: Record<RechargePattern, number> = {
  always_on_time: 1.0,
  sometimes_late: 0.5,
  often_late: 0.2,
};

/** Self-reported bill punctuality, as the 0-1 ratio the model expects. */
const BILL_PUNCTUALITY: Record<string, number> = {
  always: 0.95,
  sometimes: 0.6,
  rarely: 0.25,
};

/**
 * Monthly income becomes a 0-1 stability signal. Rs 50,000 a month is treated
 * as the top of the band this product lends into, so anything above it
 * saturates rather than dominating the score.
 */
const INCOME_CEILING = 50_000;
const incomeSignal = (monthlyIncome: number): number =>
  Math.min(Math.max(monthlyIncome / INCOME_CEILING, 0), 1);

export default function ApplyForm() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [currentStep, setCurrentStep] = useState(1);
  const [scoreCard, setScoreCard] = useState<ScoreCard | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loanCategory, setLoanCategory] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    phone_type: '',
    age_group: '',
    region: '',
    monthly_income: '',
    income_source: '',
    loan_amount_requested: '',
    sim_tenure: '',
    recharge_purchase_cycle_months: '',
    recharge_regularity: '',
    bill_payment_history: '',
    address_stability: '',
    aadhaar_verified: false,
    coop_member: false,
    agriculture_land_size: '',
    agriculture_crop_type: '',
    business_gst: '',
    education_institute: '',
    sms_count: 0,
    bill_on_time_ratio: 0,
    location_stability: 0,
    // Additional fields for verification
    aadhaar_number: '',
    address_line1: '',
    address_line2: '',
    address_city: '',
    address_state: '',
    address_pin: '',
    college_admission_slip: '',
    previous_marksheet: '',
    business_reg_id: '',
    gstin: '',
    land_khasra_number: '',
    crop_type: '',
    employment_id: '',
  });

  const [verificationStatus, setVerificationStatus] = useState({
    phone: 'pending',
    aadhaar: 'pending',
    address: 'pending',
    category_specific: 'pending',
  });

  const [uploadedFiles, setUploadedFiles] = useState({
    address_proof: null,
    category_documents: null,
  });

  const [psychometricScore, setPsychometricScore] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { id: 1, title: 'Loan Category', icon: <CreditCard size={20} /> },
    { id: 2, title: 'Personal Info', icon: <Users size={20} /> },
    { id: 3, title: 'Financial Details', icon: <FileText size={20} /> },
    { id: 4, title: 'Verification', icon: <Phone size={20} /> },
  ];

  const loanCategories = {
    personal: { name: 'Personal Loan', description: 'For personal expenses, medical bills, or emergencies', max_amount: 500000 },
    agriculture: { name: 'Agriculture Loan', description: 'For farming equipment, seeds, or land improvement', max_amount: 1000000 },
    business: { name: 'Business Loan', description: 'For small shops, vendors, and entrepreneurs', max_amount: 2000000 },
    education: { name: 'Education Loan', description: 'For higher education and skill development', max_amount: 1500000 },
  };

  const categoryFields = {
    education: [
      { key: 'college_admission_slip', label: 'College admission slip / registration number' },
      { key: 'previous_marksheet', label: 'Last qualifying exam marksheet / roll number' },
    ],
    business: [
      { key: 'business_reg_id', label: 'Business / Shop registration ID / UDYAM number' },
      { key: 'gstin', label: 'GSTIN (if registered)' },
    ],
    agriculture: [
      { key: 'land_khasra_number', label: 'Land khasra / survey number' },
      { key: 'crop_type', label: 'Primary crop cultivated' },
    ],
    personal: [{ key: 'employment_id', label: 'Employee ID / Offer letter number (if salaried)' }],
  };

  const requiredFields = (step) => {
    switch (step) {
      case 2:
        return ['full_name', 'phone_number', 'phone_type', 'age_group', 'region'];
      case 3:
        return [
          'monthly_income',
          'income_source',
          'loan_amount_requested',
          'sim_tenure',
          'recharge_purchase_cycle_months',
          'recharge_regularity',
          'bill_payment_history',
        ];
      default:
        return [];
    }
  };

  const isStepValid = () => {
    const fields = requiredFields(currentStep);
    return fields.every((f) => formData[f] !== '' && formData[f] != null);
  };

  // Fetch psychometric score on mount
  useEffect(() => {
    if (!user) return;

    // A neutral 0.5 stands in for an applicant who has not taken the
    // assessment yet, rather than blocking the application outright.
    api.psychometric
      .status(user.id)
      .then((data) => setPsychometricScore(data.completed ? data.score : 0.5))
      .catch((error) => {
        console.error('Error fetching psychometric score:', error);
        setPsychometricScore(0.5);
      });
  }, [user]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (type, event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFiles(prev => ({
        ...prev,
        [type]: file
      }));
      
      // Simulate file upload process
      setTimeout(() => {
        if (type === 'address_proof') {
          setVerificationStatus(prev => ({ ...prev, address: 'verified' }));
        } else if (type === 'category_documents') {
          setVerificationStatus(prev => ({ ...prev, category_specific: 'verified' }));
        }
      }, 2000);
    }
  };

  const initiatePhoneVerification = () => {
    setVerificationStatus((prev) => ({ ...prev, phone: 'verifying' }));
    setTimeout(() => {
      setVerificationStatus((prev) => ({ ...prev, phone: 'verified' }));
      setFormData((prev) => ({
        ...prev,
        sms_count: Math.floor(Math.random() * 200) + 50,
        bill_on_time_ratio: 0.6 + Math.random() * 0.4,
        location_stability: 0.6 + Math.random() * 0.4,
      }));
    }, 2000);
  };

  const initiateAadhaarVerification = () => {
    setVerificationStatus((prev) => ({ ...prev, aadhaar: 'verifying' }));
    setTimeout(() => {
      setVerificationStatus((prev) => ({ ...prev, aadhaar: 'verified' }));
      setFormData((prev) => ({ ...prev, aadhaar_verified: true }));
    }, 3000);
  };

  const calculateCoopScore = () => {
    let score = 0.5;
    if (formData.coop_member) score += 0.2;
    if (verificationStatus.phone === 'verified') score += 0.1;
    if (verificationStatus.aadhaar === 'verified') score += 0.2;
    return Math.min(score, 1.0);
  };

  const buildAlternativeData = (): AlternativeData => {
    const rechargePattern =
      RECHARGE_PATTERN_MAP[formData.recharge_regularity] ?? 'sometimes_late';

    return {
      user_type: (formData.phone_type || 'feature_phone') as UserType,
      region: (formData.region || 'urban') as Region,
      age_group: (formData.age_group || '31-50') as AgeGroup,

      sms_count: Number(formData.sms_count) || 0,
      bill_on_time_ratio: BILL_PUNCTUALITY[formData.bill_payment_history] ?? 0.6,
      recharge_pattern: rechargePattern,
      recharge_freq: RECHARGE_REGULARITY_SCORE[rechargePattern],
      sim_tenure: Number(formData.sim_tenure) || 0,
      location_stability: Number(formData.location_stability) || 0.5,
      income_signal: incomeSignal(Number(formData.monthly_income) || 0),
      coop_score: calculateCoopScore() * 100,
      land_verified: loanCategory === 'agriculture' && formData.agriculture_land_size ? 1 : 0,
      psychometric_score: Number(psychometricScore ?? 0.5),

      loan_amount_requested: Number(formData.loan_amount_requested) || 0,
      loan_category: LOAN_CATEGORY_MAP[loanCategory] ?? 'personal',
    };
  };

  const handleSubmit = async () => {
    if (!user) {
      setSubmitError('You must be signed in to submit an application.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // The application is scored in the same call it is stored, so the
      // decision is already in hand by the time the success screen renders.
      const result = await api.applications.submit(user.id, buildAlternativeData());
      setScoreCard(result.score_card);
      setShowSuccessMessage(true);
      setTimeout(() => navigate('/dashboard'), 4000);
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'Error submitting application. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'verifying':
        return <Clock className="text-yellow-500" size={20} />;
      case 'failed':
        return <AlertCircle className="text-red-500" size={20} />;
      default:
        return <Clock className="text-gray-400" size={20} />;
    }
  };

  // Success Message Screen
  if (showSuccessMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Submitted</h2>
          <p className="text-gray-600 mb-6">
            Your application has been scored. An underwriter reviews every file before disbursal.
          </p>

          {/* The model has already run, so the applicant sees their result now
              rather than waiting for a dashboard refresh. */}
          {scoreCard && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">Your IndiaScore</span>
                <span className="text-3xl font-bold text-gray-900">{scoreCard.india_score}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Risk grade</p>
                  <p className="font-semibold text-gray-900">{scoreCard.grade}</p>
                </div>
                <div>
                  <p className="text-gray-500">Indicative rate</p>
                  <p className="font-semibold text-gray-900">{scoreCard.indicative_apr}% p.a.</p>
                </div>
                <div>
                  <p className="text-gray-500">Requested</p>
                  <p className="font-semibold text-gray-900">
                    ₹{scoreCard.requested_amount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Eligible under policy</p>
                  <p className="font-semibold text-gray-900">
                    ₹{scoreCard.sanctioned_amount.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
            <ul className="text-sm text-blue-800 text-left space-y-1">
              <li>• Your application will be reviewed by our team</li>
              <li>• You'll receive updates on your dashboard</li>
              <li>• Check your application status regularly</li>
              <li>• We may contact you for additional documents</li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">Redirecting to your dashboard…</p>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress Bar */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center ${
                  step.id < currentStep
                    ? 'text-green-600'
                    : step.id === currentStep
                    ? 'text-blue-600'
                    : 'text-gray-400'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    step.id < currentStep
                      ? 'bg-green-600 border-green-600 text-white'
                      : step.id === currentStep
                      ? 'border-blue-600'
                      : 'border-gray-300'
                  }`}
                >
                  {step.id < currentStep ? <CheckCircle size={16} /> : step.icon}
                </div>
                <span className="ml-2 text-sm font-medium hidden md:block">{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* STEP 1 - Loan Category */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Select Loan Category</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(loanCategories).map(([key, category]) => (
                <div
                  key={key}
                  onClick={() => {
                    setLoanCategory(key);
                    setCurrentStep(2);
                  }}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    loanCategory === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <h3 className="font-semibold text-lg mb-2">{category.name}</h3>
                  <p className="text-gray-600 text-sm mb-3">{category.description}</p>
                  <p className="text-green-600 font-medium">Max: ₹{category.max_amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 - Personal Information */}
        {currentStep === 2 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Personal Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  />
                  <button
                    onClick={initiatePhoneVerification}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Phone size={16} />
                  </button>
                </div>
                {verificationStatus.phone === 'verifying' && (
                  <p className="text-sm text-yellow-600 mt-1">Verifying phone number...</p>
                )}
                {verificationStatus.phone === 'verified' && (
                  <p className="text-sm text-green-600 mt-1">Phone verified ✓</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Type</label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.phone_type}
                  onChange={(e) => handleInputChange('phone_type', e.target.value)}
                >
                  <option value="">Select type</option>
                  <option value="smartphone">Smartphone</option>
                  <option value="feature_phone">Feature Phone</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Age Group</label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.age_group}
                  onChange={(e) => handleInputChange('age_group', e.target.value)}
                >
                  <option value="">Select age group</option>
                  <option value="18-24">18-24</option>
                  <option value="25-35">25-35</option>
                  <option value="36-50">36-50</option>
                  <option value="50+">50+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Region</label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.region}
                  onChange={(e) => handleInputChange('region', e.target.value)}
                >
                  <option value="">Select region</option>
                  <option value="urban">Urban</option>
                  <option value="rural">Rural</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                disabled={!isStepValid()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 - Financial Details */}
        {currentStep === 3 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Financial & Behavioral Data</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Monthly Income (₹)
                  <span className="block text-xs text-gray-500 mt-0.5">
                    (If you do not earn, enter your parents' monthly income)
                  </span>
                </label>
                <input
                  type="number"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.monthly_income}
                  onChange={(e) => handleInputChange('monthly_income', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Income Source</label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.income_source}
                  onChange={(e) => handleInputChange('income_source', e.target.value)}
                >
                  <option value="">Select income source</option>
                  <option value="salary">Salary</option>
                  <option value="business">Business</option>
                  <option value="agriculture">Agriculture</option>
                  <option value="freelance">Freelance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Loan Amount Requested (₹)</label>
                <input
                  type="number"
                  max={loanCategories[loanCategory]?.max_amount}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.loan_amount_requested}
                  onChange={(e) => handleInputChange('loan_amount_requested', e.target.value)}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Max: ₹{loanCategories[loanCategory]?.max_amount.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">SIM Tenure (months)</label>
                <input
                  type="number"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.sim_tenure}
                  onChange={(e) => handleInputChange('sim_tenure', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  How often do you purchase a recharge?
                </label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.recharge_purchase_cycle_months}
                  onChange={(e) => handleInputChange('recharge_purchase_cycle_months', e.target.value)}
                >
                  <option value="">Select cycle</option>
                  <option value="1">Every month</option>
                  <option value="2">Every 2 months</option>
                  <option value="3">Every 3 months</option>
                  <option value="6">Every 6 months</option>
                  <option value="12">Once a year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Regularity of recharge
                </label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.recharge_regularity}
                  onChange={(e) => handleInputChange('recharge_regularity', e.target.value)}
                >
                  <option value="">Select regularity</option>
                  <option value="always">Always on time</option>
                  <option value="mostly">Mostly on time</option>
                  <option value="sometimes">Sometimes late</option>
                  <option value="rarely">Rarely on time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Bill Payment History</label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.bill_payment_history}
                  onChange={(e) => handleInputChange('bill_payment_history', e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="always">Always on time</option>
                  <option value="sometimes">Sometimes</option>
                  <option value="rarely">Rarely</option>
                </select>
              </div>

              {/* Category specific fields */}
              {loanCategory === 'agriculture' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Land Size (acres)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={formData.agriculture_land_size}
                      onChange={(e) => handleInputChange('agriculture_land_size', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Primary Crop</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={formData.agriculture_crop_type}
                      onChange={(e) => handleInputChange('agriculture_crop_type', e.target.value)}
                    />
                  </div>
                </>
              )}

              {loanCategory === 'business' && (
                <div>
                  <label className="block text-sm font-medium mb-2">GST Number (if applicable)</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.business_gst}
                    onChange={(e) => handleInputChange('business_gst', e.target.value)}
                  />
                </div>
              )}

              {loanCategory === 'education' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Educational Institute</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.education_institute}
                    onChange={(e) => handleInputChange('education_institute', e.target.value)}
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.coop_member}
                    onChange={(e) => handleInputChange('coop_member', e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium">
                    Are you a member of any Cooperative or Self-Help Group (SHG)?
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                disabled={!isStepValid()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 - Verification & Submit */}
        {currentStep === 4 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Final Verification & Submit</h2>

            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold">Verification Status:</h3>

              {/* Phone Verification Status */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Phone Verification</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(verificationStatus.phone)}
                  <span className="capitalize text-sm">{verificationStatus.phone}</span>
                </div>
              </div>

              {/* Aadhaar Verification */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium mb-1">Aadhaar Number</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={12}
                    pattern="\d{12}"
                    className="flex-1 p-2 border border-gray-300 rounded"
                    placeholder="1234 5678 9012"
                    value={formData.aadhaar_number || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      handleInputChange('aadhaar_number', val);
                    }}
                  />
                  <button
                    disabled={!formData.aadhaar_number || formData.aadhaar_number.length !== 12}
                    onClick={initiateAadhaarVerification}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50 hover:bg-blue-700"
                  >
                    Verify
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusIcon(verificationStatus.aadhaar)}
                  <span className="capitalize text-sm">{verificationStatus.aadhaar}</span>
                </div>
              </div>

              {/* Address Verification */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium mb-2">Current Address</label>
                <div className="grid md:grid-cols-2 gap-2 text-sm mb-2">
                  <input
                    placeholder="Address Line 1"
                    value={formData.address_line1 || ''}
                    onChange={(e) => handleInputChange('address_line1', e.target.value)}
                    className="p-2 border rounded"
                  />
                  <input
                    placeholder="Address Line 2"
                    value={formData.address_line2 || ''}
                    onChange={(e) => handleInputChange('address_line2', e.target.value)}
                    className="p-2 border rounded"
                  />
                  <input
                    placeholder="City"
                    value={formData.address_city || ''}
                    onChange={(e) => handleInputChange('address_city', e.target.value)}
                    className="p-2 border rounded"
                  />
                  <input
                    placeholder="State"
                    value={formData.address_state || ''}
                    onChange={(e) => handleInputChange('address_state', e.target.value)}
                    className="p-2 border rounded"
                  />
                  <input
                    placeholder="PIN Code"
                    maxLength={6}
                    value={formData.address_pin || ''}
                    onChange={(e) => handleInputChange('address_pin', e.target.value.replace(/\D/g, ''))}
                    className="p-2 border rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="address-proof"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => handleFileUpload('address_proof', e)}
                    />
                    <label
                      htmlFor="address-proof"
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer"
                    >
                      Upload Address Proof
                    </label>
                    {uploadedFiles.address_proof && (
                      <span className="text-sm text-green-600">
                        {uploadedFiles.address_proof.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(verificationStatus.address)}
                    <span className="capitalize text-sm">{verificationStatus.address}</span>
                  </div>
                </div>
              </div>

              {/* Category-specific Documents */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">
                  {loanCategories[loanCategory]?.name} Documents
                </h4>
                {categoryFields[loanCategory]?.map((field) => (
                  <div key={field.key} className="mb-2">
                    <label className="block text-xs mb-0.5">{field.label}</label>
                    <input
                      className="w-full p-1 border rounded text-sm"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="category-documents"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => handleFileUpload('category_documents', e)}
                    />
                    <label
                      htmlFor="category-documents"
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer"
                    >
                      Upload Document(s)
                    </label>
                    {uploadedFiles.category_documents && (
                      <span className="text-sm text-green-600">
                        {uploadedFiles.category_documents.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(verificationStatus.category_specific)}
                    <span className="capitalize text-sm">{verificationStatus.category_specific}</span>
                  </div>
                </div>
              </div>

              {/* Psychometric Score Display */}
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="font-medium">Psychometric Assessment</span>
                <div className="flex items-center gap-2">
                  {psychometricScore === null ? (
                    <Clock className="text-yellow-500" size={20} />
                  ) : (
                    <CheckCircle className="text-green-500" size={20} />
                  )}
                  <span className="text-sm font-medium">
                    {psychometricScore !== null
                      ? `${(psychometricScore * 100).toFixed(0)}%`
                      : 'Loading...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Application Summary */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-3">Application Summary:</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Name:</strong> {formData.full_name || 'Not provided'}</p>
                  <p><strong>Phone:</strong> {formData.phone_number || 'Not provided'}</p>
                  <p><strong>Loan Category:</strong> {loanCategories[loanCategory]?.name || 'Not selected'}</p>
                  <p><strong>Amount:</strong> ₹{Number(formData.loan_amount_requested || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p><strong>Monthly Income:</strong> ₹{Number(formData.monthly_income || 0).toLocaleString()}</p>
                  <p><strong>Psychometric Score:</strong> {psychometricScore ? (psychometricScore * 100).toFixed(0) : 'N/A'}%</p>
                  <p><strong>Coop Member:</strong> {formData.coop_member ? 'Yes' : 'No'}</p>
                  <p><strong>Phone Type:</strong> {formData.phone_type || 'Not specified'}</p>
                </div>
              </div>
            </div>

            {/* Next Steps Info */}
            <div className="p-4 bg-green-50 rounded-lg mb-6">
              <h3 className="font-medium text-green-800 mb-2">What happens next?</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Your application will be submitted for review</li>
                <li>• Our team will evaluate your application</li>
                <li>• You'll receive updates on your dashboard</li>
                <li>• Additional verification may be required</li>
                <li>• Approval status will be communicated via dashboard</li>
              </ul>
            </div>

            {submitError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Could not submit your application</p>
                <p className="mt-1 text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}