import React, { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react";

interface Prediction {
  risk_tier: string;
  pd: number;
  prediction: string;
}

interface Application {
  created: string;
  status: string;
  prediction?: Prediction;
}

interface Profile {
  name: string;
  gender: string;
  state: string;
  occupation: string;
}

interface PsychometricStatus {
  completed: boolean;
  score?: number;
  last_test_date?: string | null;
}

interface Notification {
  message: string;
  timestamp: string;
  read: boolean;
  status: string;
  application_date: string;
  admin_remarks: string;
}

const Dashboard = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [psychometric, setPsychometric] = useState<PsychometricStatus>({
    completed: false,
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPsychometric, setLoadingPsychometric] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [error, setError] = useState("");

  // Alternative CIBIL Score states
  const [altCibilScore, setAltCibilScore] = useState<number | null>(null);
  const [finalTier, setFinalTier] = useState<string | null>(null);
  const [loanCount, setLoanCount] = useState<number | null>(null);

  // FIXED: Improved error handling for notifications
  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      setError(""); // Clear previous errors
      const res = await fetch(
        `http://127.0.0.1:8000/user/notifications?clerk_user_id=${user.id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      if (data.error) {
        console.error("API Error:", data.error);
        setError(`Failed to load notifications: ${data.error}`);
        return;
      }
      
      if (data.notifications) {
        // Check if there are new notifications
        const newNotifications = data.notifications.filter((n: Notification) => 
          !notifications.some(existing => 
            existing.timestamp === n.timestamp && existing.message === n.message
          )
        );
        
        // Show browser notification for new updates
        if (newNotifications.length > 0 && 'Notification' in window && notifications.length > 0) {
          newNotifications.forEach((notification: Notification) => {
            if (Notification.permission === 'granted') {
              new Notification('Application Update', {
                body: notification.message,
                icon: '/favicon.ico'
              });
            }
          });
        }
        
        setNotifications(data.notifications);
        const unread = data.notifications.filter((n: Notification) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(`Failed to load notifications: ${err.message}`);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // FIXED: Auto-refresh notifications with better error handling
  useEffect(() => {
    if (!user) return;
    
    // Initial load
    fetchNotifications();
    
    // Set up interval for real-time updates (every 30 seconds)
    const interval = setInterval(() => {
      // Only fetch if page is visible to reduce server load
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user]);

  // FIXED: Mark notifications as read with error handling
  const markNotificationsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/user/notifications/mark-read?clerk_user_id=${user.id}`,
        { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      } else {
        console.error("Failed to mark notifications as read");
      }
    } catch (err) {
      console.error("Error marking notifications as read:", err);
    }
  };

  // FIXED: Fetch profile with better error handling
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        setError("");
        const res = await fetch(
          `http://127.0.0.1:8000/profile?clerk_user_id=${user.id}`
        );
        
        if (!res.ok) {
          throw new Error(`Failed to fetch profile: ${res.status}`);
        }
        
        const data = await res.json();
        if (data.has_profile) setProfile(data.profile);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(`Failed to load profile: ${err.message}`);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [user]);

  // FIXED: Fetch applications with better error handling
  const fetchApplications = async () => {
    if (!user) return;
    try {
      setError("");
      const res = await fetch(
        `http://127.0.0.1:8000/users?clerk_user_id=${user.id}`
      );
      
      if (!res.ok) {
        throw new Error(`Failed to fetch applications: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.error) {
        setError(`API Error: ${data.error}`);
        return;
      }
      
      if (data.applications) setApplications(data.applications);
      if (data.final_cibil_score) setAltCibilScore(data.final_cibil_score);
      if (data.final_tier) setFinalTier(data.final_tier);
      if (data.loan_count) setLoanCount(data.loan_count);
      
    } catch (err) {
      console.error("Error fetching applications:", err);
      setError(`Failed to load applications: ${err.message}`);
    } finally {
      setLoadingApps(false);
    }
  };

  // Fetch applications initially
  useEffect(() => {
    fetchApplications();
  }, [user]);

  // FIXED: Fetch psychometric status with error handling
  useEffect(() => {
    if (!user) return;
    const fetchStatus = async () => {
      try {
        setError("");
        const res = await fetch(
          `http://127.0.0.1:8000/psychometric-status?clerk_user_id=${user.id}`
        );
        
        if (!res.ok) {
          throw new Error(`Failed to fetch psychometric status: ${res.status}`);
        }
        
        const data = await res.json();
        setPsychometric(data);
      } catch (err) {
        console.error("Error fetching psychometric status:", err);
        setError(`Failed to load test status: ${err.message}`);
      } finally {
        setLoadingPsychometric(false);
      }
    };
    fetchStatus();
  }, [user]);

  // Helper to check psychometric test eligibility
  const getPsychometricStatus = () => {
    if (!psychometric.completed || !psychometric.last_test_date) {
      return { canApply: false, canTakeTest: true, nextEligible: null };
    }

    const lastTest = new Date(psychometric.last_test_date);
    const now = new Date();
    const diffDays = (now.getTime() - lastTest.getTime()) / (1000 * 3600 * 24);
    const nextEligible = new Date(lastTest.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      canApply: true,
      canTakeTest: diffDays >= 30,
      nextEligible,
    };
  };

  const { canApply, canTakeTest, nextEligible } = getPsychometricStatus();

  // FIXED: Manual refresh function
  const handleManualRefresh = async () => {
    setLoadingNotifications(true);
    setLoadingApps(true);
    setError("");
    
    try {
      await Promise.all([
        fetchNotifications(),
        fetchApplications()
      ]);
    } catch (err) {
      setError("Failed to refresh data. Please try again.");
    }
    
    setLoadingNotifications(false);
    setLoadingApps(false);
  };

  const LoadingState = ({ message }: { message: string }) => (
    <div className="flex items-center justify-center p-8 text-gray-600">
      <RefreshCw className="animate-spin h-5 w-5 mr-2" />
      <p>{message}</p>
    </div>
  );

  // Helper to color-code score
  const getScoreColor = (score?: number) => {
    if (!score) return "text-gray-500";
    if (score < 40) return "text-red-600";
    if (score < 70) return "text-yellow-600";
    return "text-green-700";
  };

  // Helper to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "issue":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  // Helper to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-700 bg-green-50 border-green-200";
      case "rejected":
        return "text-red-700 bg-red-50 border-red-200";
      case "issue":
        return "text-orange-700 bg-orange-50 border-orange-200";
      default:
        return "text-yellow-700 bg-yellow-50 border-yellow-200";
    }
  };

  // Check if application has recent updates
  const hasRecentUpdate = (appCreated: string) => {
    return notifications.some(n => 
      n.application_date === appCreated && !n.read
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with Notifications */}
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            {/* Manual Refresh Button */}
            <button
              onClick={handleManualRefresh}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-full hover:bg-white"
              title="Refresh notifications"
              disabled={loadingNotifications || loadingApps}
            >
              <RefreshCw className={`h-5 w-5 ${(loadingNotifications || loadingApps) ? 'animate-spin' : ''}`} />
            </button>
            
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && unreadCount > 0) {
                    markNotificationsRead();
                  }
                }}
                className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b bg-gray-50 sticky top-0">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Notifications
                      </h3>
                      <span className="text-sm text-gray-500">
                        Auto-refreshing
                      </span>
                    </div>
                  </div>
                  {loadingNotifications ? (
                    <div className="p-4">
                      <LoadingState message="Loading notifications..." />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No notifications yet</p>
                      <p className="text-xs mt-1">Updates will appear here automatically</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.map((notification, index) => (
                        <div
                          key={index}
                          className={`p-4 border-b last:border-b-0 ${
                            !notification.read ? 'bg-blue-50 border-blue-100' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {getStatusIcon(notification.status)}
                            <div className="flex-1 min-w-0">
                              {!notification.read && (
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    New
                                  </span>
                                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                </div>
                              )}
                              <p className="text-sm font-medium text-gray-900 mb-1">
                                Application Status Update
                              </p>
                              <p className="text-sm text-gray-700 mb-2">
                                {notification.message}
                              </p>
                              {notification.admin_remarks && (
                                <div className="bg-gray-100 p-2 rounded text-xs mb-2">
                                  <p className="font-medium text-gray-700 mb-1">
                                    Admin Message:
                                  </p>
                                  <p className="text-gray-600">
                                    {notification.admin_remarks}
                                  </p>
                                </div>
                              )}
                              <p className="text-xs text-gray-500">
                                {new Date(notification.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-900">{error}</span>
            </div>
          </div>
        )}

        {/* Real-time Status Banner */}
        {unreadCount > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <Bell className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                You have {unreadCount} new update{unreadCount === 1 ? '' : 's'} on your applications
              </span>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white bg-opacity-95 shadow-2xl rounded-3xl p-8 sm:p-10 border-4 border-white mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold text-gray-900">Your Profile</h2>
            <button
              onClick={() => navigate("/profile")}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-semibold transition-colors shadow"
            >
              Edit Profile
            </button>
          </div>
          {loadingProfile ? (
            <LoadingState message="Loading profile details..." />
          ) : profile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg text-gray-700">
              <p>
                <span className="font-semibold text-gray-900">Name:</span>{" "}
                {profile.name}
              </p>
              <p>
                <span className="font-semibold text-gray-900">Gender:</span>{" "}
                {profile.gender}
              </p>
              <p>
                <span className="font-semibold text-gray-900">State:</span>{" "}
                {profile.state}
              </p>
              <p>
                <span className="font-semibold text-gray-900">Occupation:</span>{" "}
                {profile.occupation}
              </p>
            </div>
          ) : (
            <div className="text-center text-lg text-gray-600">
              <p className="mb-4">
                No profile found. Please create one to continue.
              </p>
              <button
                onClick={() => navigate("/profile")}
                className="text-orange-600 underline font-semibold"
              >
                Create Profile
              </button>
            </div>
          )}
        </div>

        {/* Psychometric Score Card */}
        <div className="bg-white bg-opacity-95 shadow-2xl rounded-3xl p-8 sm:p-10 border-4 border-white mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Psychometric Test
          </h2>
          {loadingPsychometric ? (
            <LoadingState message="Loading psychometric status..." />
          ) : psychometric.completed ? (
            <div>
              <p className="text-lg">
                Current Score:{" "}
                <span
                  className={`font-extrabold text-2xl ${getScoreColor(
                    psychometric.score
                  )}`}
                >
                  {psychometric.score ?? "N/A"} / 1
                </span>
              </p>
              <p className="mt-2 text-gray-600">
                Last taken:{" "}
                {psychometric.last_test_date
                  ? new Date(psychometric.last_test_date).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          ) : (
            <p className="text-lg text-red-600">Test not taken yet</p>
          )}
        </div>

        {/* Final Bharat CIBIL Score Card */}
        <div className="bg-white bg-opacity-95 shadow-2xl rounded-3xl p-8 sm:p-10 border-4 border-white mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Your Bharat CIBIL Score
          </h2>
          {loadingApps ? (
            <LoadingState message="Calculating your Bharat Score..." />
          ) : altCibilScore !== null ? (
            <div>
              <p className="text-lg">
                Final Score:{" "}
                <span className="font-extrabold text-2xl text-blue-700">
                  {Math.round(altCibilScore)}
                </span>
              </p>
              <p className="text-lg mt-2">
                Tier:{" "}
                <span className="font-bold text-orange-600">
                  {finalTier ?? "N/A"}
                </span>
              </p>
              <p className="text-gray-600 mt-1">
                Based on the data of {loanCount} loan application{loanCount === 1 ? "" : "s"} & data uploaded.
              </p>
            </div>
          ) : (
            <p className="text-lg text-gray-600">
              No score available yet. Please apply for a loan.
            </p>
          )}
        </div>

        {/* Applications Section with Real-time Status */}
        <div className="bg-white bg-opacity-95 shadow-2xl rounded-3xl p-8 sm:p-10 border-4 border-white">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">
              Your Applications
            </h2>
            <div className="flex space-x-4">
              <button
                onClick={() => navigate("/apply")}
                disabled={!canApply}
                className={`px-6 py-2 rounded-full font-semibold transition-colors shadow ${
                  !canApply
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                Apply Now
              </button>
              <button
                onClick={() => navigate("/psychometric-test")}
                disabled={!canTakeTest}
                className={`px-6 py-2 rounded-full font-semibold transition-colors shadow ${
                  !canTakeTest
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {psychometric.completed ? "Retake Test" : "Take Test"}
              </button>
            </div>
          </div>

          {!canTakeTest && nextEligible && (
            <p className="text-sm text-gray-600 mb-4">
              You can retake the Psychometric Test after{" "}
              {nextEligible.toLocaleDateString()}.
            </p>
          )}

          {loadingApps ? (
            <LoadingState message="Loading your applications..." />
          ) : applications.length === 0 ? (
            <div className="text-center text-lg text-gray-600">
              <p>You have not submitted any applications yet.</p>
            </div>
          ) : (
            <ul className="space-y-6">
              {applications.map((app, idx) => {
                // Find matching notification for this application
                const matchingNotification = notifications.find(n => 
                  n.application_date === app.created
                );
                
                const hasUnreadUpdate = hasRecentUpdate(app.created);
                
                return (
                  <li
                    key={idx}
                    className={`p-6 rounded-2xl shadow-md border-2 transition-all duration-300 ${
                      hasUnreadUpdate
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200 transform scale-[1.01]'
                        : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(app.status)}
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            Application #{idx + 1}
                          </h3>
                          {hasUnreadUpdate && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                New Update
                              </span>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(app.status)}`}>
                        {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base text-gray-800 mb-4">
                      <p>
                        <span className="font-semibold text-gray-900">
                          Application Date:
                        </span>{" "}
                        {new Date(app.created).toLocaleString()}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">
                          Current Status:
                        </span>{" "}
                        <span className={`font-bold ${
                          app.status === 'approved' ? 'text-green-700' :
                          app.status === 'rejected' ? 'text-red-700' :
                          app.status === 'issue' ? 'text-orange-700' : 'text-yellow-700'
                        }`}>
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </span>
                      </p>
                      {app.prediction && (
                        <>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Risk Tier:
                            </span>{" "}
                            <span className="font-bold text-orange-700">
                              {app.prediction.risk_tier}
                            </span>
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Bharat Score:
                            </span>{" "}
                            <span className="font-bold">
                              {Math.round(app.prediction.pd * 1000)}
                            </span>
                          </p>
                        </>
                      )}
                    </div>

                    {/* Show recent admin updates */}
                    {matchingNotification && (
                      <div className={`mt-4 p-4 rounded-lg border-l-4 ${
                        app.status === 'approved' ? 'bg-green-50 border-green-400' :
                        app.status === 'rejected' ? 'bg-red-50 border-red-400' :
                        app.status === 'issue' ? 'bg-orange-50 border-orange-400' :
                        'bg-yellow-50 border-yellow-400'
                      }`}>
                        <div className="flex items-start gap-3">
                          {getStatusIcon(matchingNotification.status)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-900">
                                Latest Update
                              </p>
                              {!matchingNotification.read && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                                  Just now
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 mb-2">
                              {matchingNotification.message}
                            </p>
                            {matchingNotification.admin_remarks && (
                              <div className="bg-white p-3 rounded border shadow-sm">
                                <p className="text-sm font-medium text-gray-700 mb-1">
                                  Message from Admin:
                                </p>
                                <p className="text-sm text-gray-600">
                                  {matchingNotification.admin_remarks}
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Updated: {new Date(matchingNotification.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;