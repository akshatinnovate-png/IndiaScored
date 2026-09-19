import React, { useCallback, useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react";

import { api } from "@/lib/api";
import type {
  Application,
  Notification,
  PortfolioHeadline,
  Profile,
} from "@/lib/types";
import {
  formatDateTime,
  formatPercent,
  formatRupees,
  scoreBandLabel,
  scorePosition,
} from "@/lib/format";

interface PsychometricStatus {
  completed: boolean;
  score?: number | null;
  taken_at?: string | null;
}

/** Days an applicant must wait before retaking the behavioural assessment. */
const ASSESSMENT_COOLDOWN_DAYS = 30;

/** How often the dashboard polls for an underwriting decision. */
const NOTIFICATION_POLL_MS = 30_000;

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

  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPsychometric, setLoadingPsychometric] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [error, setError] = useState("");

  // The applicant's blended headline score across every application.
  const [headline, setHeadline] = useState<PortfolioHeadline | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setError("");
      const { notifications: incoming } = await api.notifications.list(user.id);

      // Raise a browser notification only for genuinely new items, and never
      // on the first load — otherwise signing in fires a burst of them.
      const isNew = (candidate: Notification) =>
        !notifications.some((existing) => existing.id === candidate.id);

      if (notifications.length > 0 && "Notification" in window && Notification.permission === "granted") {
        incoming.filter(isNew).forEach((notification) => {
          new Notification("Application update", {
            body: notification.message,
            icon: "/favicon.ico",
          });
        });
      }

      setNotifications(incoming);
      setUnreadCount(incoming.filter((notification) => !notification.read).length);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoadingNotifications(false);
    }
    // `notifications` is read only to detect new arrivals, and including it
    // would re-create the poller on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
    }, NOTIFICATION_POLL_MS);
    
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const markNotificationsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      await api.notifications.markRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking notifications as read:", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    api.profile
      .get(user.id)
      .then((data) => data.has_profile && setProfile(data.profile))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingProfile(false));
  }, [user]);

  const fetchApplications = useCallback(async () => {
    if (!user) return;
    try {
      setError("");
      const data = await api.applications.list(user.id);
      setApplications(data.applications);
      setHeadline(data.headline);
    } catch (err) {
      // A brand-new applicant has no applications yet; that is not an error.
      const notFound = err instanceof Error && err.message.toLowerCase().includes("no applications");
      if (!notFound) {
        console.error("Error fetching applications:", err);
        setError(err instanceof Error ? err.message : "Failed to load applications.");
      }
      setApplications([]);
    } finally {
      setLoadingApps(false);
    }
  }, [user]);

  // Fetch applications initially
  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    if (!user) return;

    api.psychometric
      .status(user.id)
      .then(setPsychometric)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingPsychometric(false));
  }, [user]);

  // Helper to check psychometric test eligibility
  const getPsychometricStatus = () => {
    if (!psychometric.completed || !psychometric.taken_at) {
      return { canApply: false, canTakeTest: true, nextEligible: null };
    }

    const lastTest = new Date(`${psychometric.taken_at}Z`);
    const now = new Date();
    const diffDays = (now.getTime() - lastTest.getTime()) / (1000 * 3600 * 24);
    const cooldownMs = ASSESSMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const nextEligible = new Date(lastTest.getTime() + cooldownMs);

    return {
      canApply: true,
      canTakeTest: diffDays >= ASSESSMENT_COOLDOWN_DAYS,
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
    } catch {
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
      case "flagged":
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
      case "flagged":
        return "text-orange-700 bg-orange-50 border-orange-200";
      default:
        return "text-yellow-700 bg-yellow-50 border-yellow-200";
    }
  };

  // Check if application has recent updates
  const hasRecentUpdate = (appCreated: string) => {
    return notifications.some(n => 
      n.submitted_at === appCreated && !n.read
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
                              {notification.remarks && (
                                <div className="bg-gray-100 p-2 rounded text-xs mb-2">
                                  <p className="font-medium text-gray-700 mb-1">
                                    Admin Message:
                                  </p>
                                  <p className="text-gray-600">
                                    {notification.remarks}
                                  </p>
                                </div>
                              )}
                              <p className="text-xs text-gray-500">
                                {formatDateTime(notification.issued_at)}
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
                {psychometric.taken_at
                  ? formatDateTime(psychometric.taken_at)
                  : "N/A"}
              </p>
            </div>
          ) : (
            <p className="text-lg text-red-600">Test not taken yet</p>
          )}
        </div>

        {/* Headline IndiaScore across every application on file */}
        <div className="bg-white bg-opacity-95 shadow-2xl rounded-3xl p-8 sm:p-10 border-4 border-white mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your IndiaScore</h2>
          {loadingApps ? (
            <LoadingState message="Calculating your IndiaScore..." />
          ) : headline && headline.india_score !== null ? (
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-extrabold text-blue-700">
                  {Math.round(headline.india_score)}
                </span>
                <span className="text-lg text-gray-500">/ 900</span>
                <span className="ml-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                  Grade {headline.grade ?? "N/A"}
                </span>
              </div>

              {/* Where the score sits on the 300-900 band. */}
              <div className="mt-4 h-3 w-full rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-orange-400 to-green-500"
                  style={{ width: `${scorePosition(headline.india_score) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {scoreBandLabel(headline.india_score)}
              </p>

              {headline.repayment_confidence !== null && (
                <p className="mt-3 text-lg">
                  Repayment confidence:{" "}
                  <span className="font-bold text-green-700">
                    {formatPercent(headline.repayment_confidence)}
                  </span>
                </p>
              )}
              <p className="text-gray-600 mt-1">
                Weighted across {headline.loan_count} application
                {headline.loan_count === 1 ? "" : "s"} — larger loans count for more.
              </p>
            </div>
          ) : (
            <p className="text-lg text-gray-600">
              No score yet. Apply for a loan and your IndiaScore appears here straight away.
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
                  n.submitted_at === app.submitted_at
                );
                
                const hasUnreadUpdate = hasRecentUpdate(app.submitted_at);
                
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
                        {formatDateTime(app.submitted_at)}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">
                          Current Status:
                        </span>{" "}
                        <span className={`font-bold ${
                          app.status === 'approved' ? 'text-green-700' :
                          app.status === 'rejected' ? 'text-red-700' :
                          app.status === 'flagged' ? 'text-orange-700' : 'text-yellow-700'
                        }`}>
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </span>
                      </p>
                      {app.score_card && (
                        <>
                          <p>
                            <span className="font-semibold text-gray-900">Risk grade:</span>{" "}
                            <span className="font-bold text-orange-700">
                              {app.score_card.grade}
                            </span>
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">IndiaScore:</span>{" "}
                            <span className="font-bold">{app.score_card.india_score}</span>
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">
                              Eligible under policy:
                            </span>{" "}
                            <span className="font-bold">
                              {formatRupees(app.score_card.sanctioned_amount)}
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
                        app.status === 'flagged' ? 'bg-orange-50 border-orange-400' :
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
                            {matchingNotification.remarks && (
                              <div className="bg-white p-3 rounded border shadow-sm">
                                <p className="text-sm font-medium text-gray-700 mb-1">
                                  Message from Admin:
                                </p>
                                <p className="text-sm text-gray-600">
                                  {matchingNotification.remarks}
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Updated: {formatDateTime(matchingNotification.issued_at)}
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