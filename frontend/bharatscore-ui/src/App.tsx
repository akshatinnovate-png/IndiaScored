import { Routes, Route, useParams } from "react-router-dom";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignedIn } from "@clerk/clerk-react";

// User's existing component imports
import LandingPage from "./components/LandingPage";
import SignUpPage from "./components/SignUpPage";
import SignInPage from "./components/SignInPage";
import ProfileForm from "./components/ProfileForm";
import Dashboard from "./components/Dashboard";
import Redirector from "./components/Redirector";
import ApplyForm from "./components/ApplyForm";
import BehavioralPsychometricTest from "./components/psychometricTest";
import AadhaarVerification from "./components/AdharVerification";


// Admin components
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import CreditRiskDashboard from "./components/CreditRiskDashboard"; // Add this import

// Other pages
import Applications from "./components/Applications";
import Support from "./components/Support";
import NotFound from "./components/NotFound";

const queryClient = new QueryClient();

// Wrapper component to extract route parameters
function CreditRiskDashboardWrapper() {
  const { clerkUserId } = useParams();
  return <CreditRiskDashboard clerkUserId={clerkUserId!} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Global toasts */}
        <Toaster />
        <Sonner />
        
        <Routes>
          {/* Public and Clerk Auth Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/redirector" element={<Redirector />} />

          {/* Protected Routes (require Clerk sign-in) */}
          <Route
            path="/profile"
            element={
              <SignedIn>
                <ProfileForm />
              </SignedIn>
            }
          />
          <Route
            path="/dashboard"
            element={
              <SignedIn>
                <Dashboard />
              </SignedIn>
            }
          />
          <Route
            path="/apply"
            element={
              <SignedIn>
                <ApplyForm />
              </SignedIn>
            }
          />
          <Route
            path="/psychometric-test"
            element={
              <SignedIn>
                <BehavioralPsychometricTest />
              </SignedIn>
            }
          />
          <Route
            path="/applications"
            element={
              <SignedIn>
                <Applications />
              </SignedIn>
            }
          />
          <Route
            path="/support"
            element={
              <SignedIn>
                <Support />
              </SignedIn>
            }
          />
          <Route
            path="/admin"
            element={
              <SignedIn>
                <AdminDashboard />
              </SignedIn>
            }
          />
          <Route
            path="/adhar"
            element={
              <SignedIn>
                <AadhaarVerification/>
              </SignedIn>
            }
          />
          
          {/* Credit Risk Dashboard Route */}
          <Route
            path="/credit-risk/:clerkUserId"
            element={
              <SignedIn>
                <CreditRiskDashboardWrapper />
              </SignedIn>
            }
          />

          {/* Admin Routes */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />

          {/* Catch-all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;