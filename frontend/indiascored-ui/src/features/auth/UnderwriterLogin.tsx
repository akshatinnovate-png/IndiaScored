import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/PrimaryButton";
import { IS_DEMO_AUTH, useDemoSignIn } from "@/lib/auth";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const signInDemo = useDemoSignIn();

  const handleLogin = () => {
    // Hardcoded credentials
    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "hackathon123";

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      signInDemo();
      navigate("/admin"); // Redirect to Admin Dashboard
    } else {
      setError("Wrong username or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 px-6 py-12">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <Input 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <Input 
              type="password"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter password"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {IS_DEMO_AUTH && (
            <p className="rounded bg-orange-50 px-3 py-2 text-xs text-gray-600">
              Demo credentials: <code>admin</code> / <code>hackathon123</code>
            </p>
          )}

          <Button label="Login" onClick={handleLogin} className="w-full mt-2" />
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
