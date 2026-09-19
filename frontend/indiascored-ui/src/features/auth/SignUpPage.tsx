import { SignUp, useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SignUpPage = () => {
  const { isSignedIn, userId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn && userId) {
      navigate("/redirector");
    }
  }, [isSignedIn, userId, navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100">
      <div className="w-full max-w-md">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          afterSignUpUrl="/redirector"  
          appearance={{
            elements: {
              formButtonPrimary: "bg-green-500 hover:bg-green-600 text-white",
              card: "shadow-xl rounded-2xl p-8 bg-white",
              headerTitle: "text-2xl font-bold text-gray-900",
              headerSubtitle: "text-gray-600",
            },
          }}
        />
      </div>
    </div>
  );
};

export default SignUpPage;