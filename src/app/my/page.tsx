"use client";

import { useEffect, useState } from "react";

type Player = {
  id: string;
  name: string;
  segment: string;
  phone: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  women: "Women (18+)",
  teens: "Teen (Ages 14-17)",
  girls: "Child (Under 13)",
};

export default function MyPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          window.location.href = "/login";
          return;
        }
        const data = await res.json();
        setPlayer(data);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  function formatPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === "1") {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 py-6 px-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold text-white">Jgoalz Sports</h1>
          <p className="text-purple-200 text-sm mt-1">My Account</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
            </div>
          </div>
        )}

        {!loading && player && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-purple-700 font-bold text-xl">
                  {player.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Welcome, {player.name.split(" ")[0]}!</h2>
                <p className="text-sm text-purple-600 font-medium">
                  {SEGMENT_LABELS[player.segment] ?? player.segment}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-sm text-gray-900 font-medium">{player.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-sm text-gray-900 font-medium">{formatPhone(player.phone)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Group</p>
                  <p className="text-sm text-gray-900 font-medium">
                    {SEGMENT_LABELS[player.segment] ?? player.segment}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                disabled
                className="w-full border border-gray-200 text-gray-400 font-semibold py-3 px-6 rounded-lg cursor-not-allowed text-sm"
              >
                Edit Profile (coming soon)
              </button>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className={`w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 ${
                  loggingOut ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loggingOut ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full" />
                    Logging out...
                  </>
                ) : (
                  "Log Out"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
