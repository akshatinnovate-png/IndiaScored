import React, { useState, useCallback, useEffect } from "react";
import { Upload, Camera, FileText, CheckCircle, XCircle, Loader, RefreshCcw } from "lucide-react";

interface AadhaarVerificationProps {
  onAadhaarExtracted: (aadhaar: string, extractedData?: any) => void;
}

interface VerificationResult {
  message: string;
  type: "success" | "error" | "info" | "warning";
}

// State for OCR-extracted data from each side of the card
interface ExtractedData {
  aadhaarNumber?: string;
  name?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  pincode?: string;
  // This is a simplified example; a real-world implementation would have more fields
}

const AadhaarVerification: React.FC<AadhaarVerificationProps> = ({
  onAadhaarExtracted,
}) => {
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontData, setFrontData] = useState<ExtractedData | null>(null);
  const [backData, setBackData] = useState<ExtractedData | null>(null);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [dragOverFront, setDragOverFront] = useState<boolean>(false);
  const [dragOverBack, setDragOverBack] = useState<boolean>(false);

  // Function to extract personal info from OCR text
  const extractPersonalInfo = (text: string, side: 'front' | 'back') => {
    const info: ExtractedData = {};
    const parsedText = text.replace(/[\n\r]/g, ' ').trim();

    if (side === 'front') {
      const nameMatch = parsedText.match(/(?:Name[:\s]+)([A-Za-z\s]+?)(?:S\/O|D\/O|W\/O|Year|DOB|Date of Birth)/i);
      if (nameMatch) info.name = nameMatch[1].trim();

      const dobMatch = parsedText.match(/(?:DOB|Date of Birth)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (dobMatch) info.dateOfBirth = dobMatch[1];

      const genderMatch = parsedText.match(/(?:Male|Female|Transgender)/i);
      if (genderMatch) info.gender = genderMatch[0];
    }

    if (side === 'back') {
      const addressMatch = parsedText.match(/(?:Address|Add):([\s\S]+?)(?:PIN|Pincode|Pin)/i);
      if (addressMatch) info.address = addressMatch[1].trim();

      const pinMatch = parsedText.match(/(?:PIN|Pincode|Pin)[:\s]*(\d{6})/i);
      if (pinMatch) info.pincode = pinMatch[0];
    }
    
    const aadhaarPatterns = [
      /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g,
      /(?:UID|Aadhaar|आधार)[\s:]*(\d{4}[\s-]?\d{4}[\s-]?\d{4})/gi,
      /(\d{12})/g
    ];
    let aadhaarMatch = null;
    for (const pattern of aadhaarPatterns) {
      const matches = parsedText.match(pattern);
      if (matches) {
        const validNumbers = matches.filter(num => num.replace(/[\s-]/g, '').length === 12);
        if (validNumbers.length > 0) {
          aadhaarMatch = validNumbers[0];
          break;
        }
      }
    }
    if (aadhaarMatch) {
      info.aadhaarNumber = aadhaarMatch.replace(/[\s-]/g, "");
    }

    return info;
  };

  const processOCRResult = useCallback(async (file: File, side: 'front' | 'back') => {
    setOcrLoading(true);
    setResult({ message: `Processing ${side} side...`, type: "info" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", "eng");
      formData.append("apikey", "K82469512788957");
      formData.append("isOverlayRequired", "false");
      formData.append("detectOrientation", "true");
      formData.append("scale", "true");
      formData.append("isTable", "false");

      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("OCR service unavailable");

      const data = await res.json();
      if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage || "OCR processing failed");

      const parsedText = data?.ParsedResults?.[0]?.ParsedText || "";
      if (!parsedText || parsedText.trim().length < 50) {
        setResult({
          message: `Unable to extract text from ${side} side. Please ensure the card is clear.`,
          type: "error",
        });
        return;
      }
      
      const extractedInfo = extractPersonalInfo(parsedText, side);

      if (side === 'front') {
        setFrontImage(file);
        setFrontData(extractedInfo);
      } else {
        setBackImage(file);
        setBackData(extractedInfo);
      }

      setResult({
        message: `${side.charAt(0).toUpperCase() + side.slice(1)} side processed successfully.`,
        type: "success",
      });
      
    } catch (error: any) {
      console.error("OCR Error:", error);
      setResult({
        message: `Failed to process ${side} side: ${error.message}. Please try again.`,
        type: "error",
      });
    } finally {
      setOcrLoading(false);
    }
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setResult({
        message: "File size too large. Please select an image under 5MB.",
        type: "error",
      });
      return;
    }

    await processOCRResult(file, side);
  };

  const handleDrop = useCallback(async (e: React.DragEvent, side: 'front' | 'back') => {
    e.preventDefault();
    if (side === 'front') setDragOverFront(false);
    else setDragOverBack(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      setResult({ message: "Please drop a valid image file.", type: "error" });
      return;
    }

    const file = imageFiles[0];
    await processOCRResult(file, side);
  }, [processOCRResult]);

  const handleDragOver = useCallback((e: React.DragEvent, side: 'front' | 'back') => {
    e.preventDefault();
    if (side === 'front') setDragOverFront(true);
    else setDragOverBack(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, side: 'front' | 'back') => {
    e.preventDefault();
    if (side === 'front') setDragOverFront(false);
    else setDragOverBack(false);
  }, []);

  // Effect to combine data from both sides and populate the parent form
  useEffect(() => {
    if (frontData || backData) {
      const combinedData = {
        aadhaarNumber: frontData?.aadhaarNumber || backData?.aadhaarNumber,
        name: frontData?.name,
        dateOfBirth: frontData?.dateOfBirth,
        gender: frontData?.gender,
        address: backData?.address,
        pincode: backData?.pincode,
      };
      
      onAadhaarExtracted(combinedData.aadhaarNumber || "", combinedData);
      
      if (combinedData.aadhaarNumber) {
        setResult({
          message: "Aadhaar details have been extracted and are populating the form.",
          type: "success",
        });
      } else if (frontData || backData) {
        setResult({
          message: "Could not extract Aadhaar number from either image. Please try a clearer image.",
          type: "error",
        });
      }
    }
  }, [frontData, backData, onAadhaarExtracted]);

  const clearResults = () => {
    setFrontImage(null);
    setBackImage(null);
    setFrontData(null);
    setBackData(null);
    setResult(null);
    onAadhaarExtracted("", {});
  };

  const getResultIcon = () => {
    if (!result) return null;
    switch (result.type) {
      case "success": return <CheckCircle className="w-5 h-5" />;
      case "error": return <XCircle className="w-5 h-5" />;
      case "info": return <FileText className="w-5 h-5" />;
      case "warning": return <Camera className="w-5 h-5" />;
      default: return null;
    }
  };

  const renderUploadArea = (side: 'front' | 'back', image: File | null, dragOver: boolean) => {
    const sideText = side.charAt(0).toUpperCase() + side.slice(1);
    const imageUrl = image ? URL.createObjectURL(image) : null;

    return (
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        }`}
        onDrop={(e) => handleDrop(e, side)}
        onDragOver={(e) => handleDragOver(e, side)}
        onDragLeave={(e) => handleDragLeave(e, side)}
      >
        {ocrLoading && (frontImage || backImage) ? (
          <div className="flex flex-col items-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Processing...</p>
          </div>
        ) : imageUrl ? (
          <div className="space-y-4">
            <img src={imageUrl} alt={`${sideText} of Aadhaar`} className="max-w-xs mx-auto rounded-lg shadow-md" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800 mb-2">
                Upload {sideText} Side
              </p>
              <p className="text-gray-600 text-sm mb-4">
                Drag and drop or click to select
              </p>
            </div>
            <label
              htmlFor={`file-upload-${side}`}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <Camera className="w-5 h-5 mr-2" />
              Choose File
              <input
                id={`file-upload-${side}`}
                type="file"
                className="sr-only"
                onChange={(e) => handleImageUpload(e, side)}
                accept="image/png, image/jpeg, image/jpg"
                disabled={ocrLoading}
              />
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-center">
          <FileText className="w-6 h-6 text-white mr-2" />
          <h2 className="text-xl font-bold text-white">Aadhaar Card Verification</h2>
        </div>
        <p className="text-center text-blue-100 text-sm mt-1">
          Upload both sides of your Aadhaar card for automatic data extraction
        </p>
      </div>

      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1">
            {renderUploadArea('front', frontImage, dragOverFront)}
          </div>
          <div className="flex-1">
            {renderUploadArea('back', backImage, dragOverBack)}
          </div>
        </div>

        {result && (
          <div
            className={`mt-6 p-4 rounded-xl border flex items-start space-x-3 ${
              result.type === "success" ? "bg-green-50 text-green-800 border-green-200" :
              result.type === "info" ? "bg-blue-50 text-blue-800 border-blue-200" :
              result.type === "warning" ? "bg-yellow-50 text-yellow-800 border-yellow-200" :
              "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {getResultIcon()}
            <div className="flex-1">
              <p className="font-medium">{result.message}</p>
            </div>
            {result.type !== "info" && (
                <button onClick={clearResults} className="text-gray-500 hover:text-gray-700">
                    <RefreshCcw className="w-5 h-5" />
                </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AadhaarVerification;