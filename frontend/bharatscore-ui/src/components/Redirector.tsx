import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

export default function Redirector() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirection = async () => {
      // If not signed in, redirect to sign-in
      if (!isSignedIn || !user) {
        navigate("/sign-in");
        return;
      }

      try {
        console.log("Checking user profile for:", user.id);

        const response = await fetch(`http://127.0.0.1:8000/profile?clerk_user_id=${user.id}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Backend response:", data);
        
        // Check if user has a profile
        const hasProfile = data.users && data.users.length > 0;
        
        if (hasProfile) {
          console.log("User has profile, redirecting to dashboard");
          navigate("/dashboard");
        } else {
          console.log("User has no profile, redirecting to profile form");
          navigate("/profile");
        }
      } catch (error) {
        console.error("Error checking user profile:", error);
        setError("Failed to check user profile");
        navigate("/profile");
      } finally {
        setLoading(false);
      }
    };

    handleRedirection();
  }, [isSignedIn, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">Error: {error}</p>
          <button 
            onClick={() => navigate("/profile")}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg"
          >
            Continue to Profile
          </button>
        </div>
      </div>
    );
  }

  return null;
}