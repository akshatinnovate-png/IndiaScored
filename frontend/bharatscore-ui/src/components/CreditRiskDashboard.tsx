import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface UserData {
  name: string;
  creditScore: number;
  riskTier: string;
  probabilityOfDefault: number;
}

interface CreditRiskDashboardProps {
  userData: UserData;
  onClose: () => void;
}

const CreditRiskDashboard: React.FC<CreditRiskDashboardProps> = ({
  userData,
  onClose,
}) => {
  const [aiReport, setAiReport] = useState<string>("Loading AI report...");
  const [language, setLanguage] = useState("English");

  const languages = ["English", "Hindi", "Tamil", "Bengali", "Gujarati"];

  // Function to get AI Report from Gemini
  const fetchAiReport = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/ai-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      let report = data.report;

      // If language selected is not English, call Microsoft Translator API
      if (language !== "English") {
        const translationRes = await fetch(
          `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${
            language === "Hindi"
              ? "hi"
              : language === "Tamil"
              ? "ta"
              : language === "Bengali"
              ? "bn"
              : language === "Gujarati"
              ? "gu"
              : "en"
          }`,
          {
            method: "POST",
            headers: {
              "Ocp-Apim-Subscription-Key": "YOUR_TRANSLATOR_KEY",
              "Ocp-Apim-Subscription-Region": "YOUR_TRANSLATOR_REGION",
              "Content-Type": "application/json",
            },
            body: JSON.stringify([{ text: report }]),
          }
        );

        const translationData = await translationRes.json();
        report = translationData[0].translations[0].text;
      }

      setAiReport(report);
    } catch (error) {
      console.error("Error fetching AI report:", error);
      setAiReport("Failed to load AI report.");
    }
  };

  useEffect(() => {
    fetchAiReport();
  }, [userData, language]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-3/4 max-w-4xl">
        {/* Header with Title, Language Selector, and Close */}
        <div className="flex justify-between items-center p-6 border-b">
          <h1 className="text-2xl font-bold">
            Credit Risk Report for {userData.name}
          </h1>

          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="lang" className="text-sm font-medium">
                Language:
              </label>
              <select
                id="lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border rounded p-2"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* User Data Section */}
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="font-semibold">Credit Score</h2>
            <p>{userData.creditScore}</p>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="font-semibold">Risk Tier</h2>
            <p>{userData.riskTier}</p>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg col-span-2">
            <h2 className="font-semibold">Probability of Default</h2>
            <p>{(userData.probabilityOfDefault * 100).toFixed(2)}%</p>
          </div>
        </div>

        {/* AI Report Section */}
        <div className="p-6 border-t">
          <h2 className="text-lg font-semibold mb-2">AI Report</h2>
          <p>{aiReport}</p>
        </div>
      </div>
    </div>
  );
};

export default CreditRiskDashboard;
