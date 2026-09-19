import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

const REFERENCE_EMBEDDING_KEY = 'interview_reference_face_embedding';
const SIMILARITY_THRESHOLD = 0.75;
const MIN_CONSECUTIVE_MATCHES = 5;
const MAX_CONSECUTIVE_FAILS = 2;
const CHECK_INTERVAL = 1500;
const STRICTNESS_FACTOR = 1.2;

const useFaceMatching = (videoRef) => {
  const [state, setState] = useState({
    isMatching: false,
    similarity: 0,
    isReady: false,
    isLoading: true,
    error: null,
    confidence: 0
  });

  const referenceDescriptor = useRef(null);
  const detectionInterval = useRef(null);
  const isProcessing = useRef(false);
  const modelsLoaded = useRef(false);
  const matchHistory = useRef([]);

  // Enhanced cosine similarity with strictness adjustment
  const getStrictSimilarity = (desc1, desc2) => {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return 0;
    
    let dot = 0, mag1 = 0, mag2 = 0;
    for (let i = 0; i < desc1.length; i++) {
      dot += desc1[i] * desc2[i];
      mag1 += desc1[i] * desc1[i];
      mag2 += desc2[i] * desc2[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    const rawSimilarity = mag1 && mag2 ? dot / (mag1 * mag2) : 0;
    
    // Apply strictness factor to reduce false positives
    return Math.pow(rawSimilarity, STRICTNESS_FACTOR);
  };

  // More rigorous verification logic
  const verifyMatch = (similarity) => {
    // Update match history
    const isMatch = similarity >= SIMILARITY_THRESHOLD;
    matchHistory.current = [...matchHistory.current.slice(-10), isMatch];
    
    // Calculate confidence based on recent matches
    const recentMatches = matchHistory.current.slice(-MIN_CONSECUTIVE_MATCHES);
    const matchCount = recentMatches.filter(m => m).length;
    const confidence = matchCount / MIN_CONSECUTIVE_MATCHES;
    
    // Only confirm match after multiple consecutive verifications
    const verified = matchCount === MIN_CONSECUTIVE_MATCHES;
    
    // Check for consecutive failures
    const recentFails = matchHistory.current.slice(-MAX_CONSECUTIVE_FAILS);
    const failed = recentFails.length === MAX_CONSECUTIVE_FAILS && 
                  recentFails.every(m => !m);
    
    return {
      isMatch: verified ? true : (failed ? false : state.isMatching),
      confidence,
      error: failed ? "Face verification failed" : null
    };
  };

  // Load models and initialize
  useEffect(() => {
    console.log("Starting to load face recognition models...");
    
    const loadModels = async () => {
      try {
        // First, let's check if we can access the models
        console.log("Checking model accessibility...");
        
        // Try to load models from a CDN instead of local files
        // This avoids the path issues with local model files
        const MODEL_URL = process.env.NODE_ENV === 'development' 
          ? '/models' 
          : 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        
        console.log("Using model URL:", MODEL_URL);
        
        console.log("Loading SSD Mobilenet model...");
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        console.log("SSD Mobilenet model loaded successfully");
        
        console.log("Loading Face Landmark model...");
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        console.log("Face Landmark model loaded successfully");
        
        console.log("Loading Face Recognition model...");
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log("Face Recognition model loaded successfully");
        
        // Load saved reference if exists
        const saved = localStorage.getItem(REFERENCE_EMBEDDING_KEY);
        if (saved) {
          console.log("Found saved reference face embedding");
          referenceDescriptor.current = new Float32Array(JSON.parse(saved));
        } else {
          console.log("No saved reference face embedding found");
        }

        console.log("All models loaded successfully, face recognition is ready");
        setState(prev => ({ ...prev, isReady: true, isLoading: false }));
        modelsLoaded.current = true;
      } catch (error) {
        console.error("Error loading face recognition models:", error);
        
        // Provide more helpful error message
        let errorMessage = 'Failed to load face models. ';
        
        if (error.message.includes('Unexpected token')) {
          errorMessage += 'This usually means the model files are not accessible. ';
          errorMessage += 'Please make sure the models are placed in the public/models directory. ';
          errorMessage += 'You can download them from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights';
        } else {
          errorMessage += error.message;
        }
        
        setState({
          isMatching: false,
          similarity: 0,
          isReady: false,
          isLoading: false,
          error: errorMessage,
          confidence: 0
        });
      }
    };

    loadModels();
    return () => stopFaceMatching();
  }, []);

  // Capture reference face with additional validation
  const captureReference = useCallback(async () => {
    console.log("Attempting to capture reference face...");
    
    // Check if models are loaded first
    if (!modelsLoaded.current) {
      const errorMsg = "Face models not loaded yet. Please wait and try again.";
      console.error(errorMsg);
      setState(prev => ({ ...prev, error: errorMsg }));
      return false;
    }
    
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      console.log("Face detection result:", detection);

      if (!detection) {
        console.warn("No face detected during reference capture");
        throw new Error("No face detected");
      }

      // Additional validation - check face orientation
      const landmarks = detection.landmarks;
      const jawOutline = landmarks.getJawOutline();
      const left = jawOutline[0].x;
      const right = jawOutline[16].x;
      const width = right - left;
      
      // Simple check for frontal face
      if (width < 100) { // Adjust based on your video size
        console.warn("Face not frontal enough for reference capture");
        throw new Error("Please face directly forward");
      }

      // Save reference
      referenceDescriptor.current = detection.descriptor;
      localStorage.setItem(
        REFERENCE_EMBEDDING_KEY,
        JSON.stringify(Array.from(detection.descriptor))
      );

      console.log("Reference face captured and saved successfully");
      setState(prev => ({ ...prev, error: null }));
      return true;
    } catch (error) {
      console.error("Error capturing reference face:", error);
      setState(prev => ({ ...prev, error: error.message }));
      return false;
    }
  }, [videoRef]);

  // Face matching process
  const startFaceMatching = useCallback(() => {
    console.log("Starting face matching process...");
    
    // Check if models are loaded first
    if (!modelsLoaded.current) {
      const errorMsg = "Face models not loaded yet. Please wait and try again.";
      console.error(errorMsg);
      setState(prev => ({ ...prev, error: errorMsg }));
      return;
    }
    
    stopFaceMatching();
    matchHistory.current = [];

    if (!referenceDescriptor.current) {
      console.error("No reference descriptor available for face matching");
      setState(prev => ({ ...prev, error: "No reference face available" }));
      return;
    }

    detectionInterval.current = setInterval(async () => {
      if (isProcessing.current || !videoRef.current) return;
      isProcessing.current = true;

      try {
        console.log("Attempting face detection for matching...");
        const detection = await faceapi
          .detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          console.log("No face detected in current frame");
          const { isMatch, confidence, error } = verifyMatch(0);
          setState(prev => ({
            ...prev,
            isMatching: isMatch,
            similarity: 0,
            confidence,
            error
          }));
          return;
        }

        console.log("Face detected, calculating similarity...");
        const similarity = getStrictSimilarity(
          referenceDescriptor.current,
          detection.descriptor
        );
        
        console.log(`Similarity score: ${similarity.toFixed(4)}`);
        const { isMatch, confidence, error } = verifyMatch(similarity);

        console.log(`Match result: ${isMatch}, Confidence: ${confidence.toFixed(4)}`);
        setState(prev => ({
          ...prev,
          isMatching: isMatch,
          similarity,
          confidence,
          error
        }));
      } catch (error) {
        console.error("Face matching error:", error);
      } finally {
        isProcessing.current = false;
      }
    }, CHECK_INTERVAL);
  }, [videoRef]);

  const stopFaceMatching = useCallback(() => {
    console.log("Stopping face matching process");
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
  }, []);

  const clearReference = useCallback(() => {
    console.log("Clearing reference face");
    localStorage.removeItem(REFERENCE_EMBEDDING_KEY);
    referenceDescriptor.current = null;
    setState(prev => ({
      ...prev,
      isMatching: false,
      similarity: 0,
      confidence: 0,
      error: null
    }));
  }, []);

  return {
    ...state,
    captureReference,
    startFaceMatching,
    stopFaceMatching,
    clearReference,
    hasReference: !!referenceDescriptor.current,
    modelsLoaded: modelsLoaded.current
  };
};

export default useFaceMatching;