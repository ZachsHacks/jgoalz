"use client";

import { useState } from "react";
import Link from "next/link";

type Player = {
  id: string;
  name: string;
  segment: string;
};

type Step =
  | { status: "search" }
  | { status: "searching" }
  | { status: "results"; players: Player[] }
  | { status: "setPassword"; player: Player }
  | { status: "saving" }
  | { status: "error"; message: string; step: "search" | "setPassword" }
  | { status: "done" };

const SEGMENT_LABELS: Record<string, string> = {
  women: "Women (18+)",
  teens: "Teen (Ages 14-17)",
  girls: "Child (Under 13)",
};

export default function SetupPage() {
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<Step>({ status: "search" });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setStep({ status: "searching" });

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStep({ status: "error", message: data.error ?? "Something went wrong.", step: "search" });
        return;
      }

      setStep({ status: "results", players: data.players ?? [] });
    } catch {
      setStep({ status: "error", message: "Network error. Please try again.", step: "search" });
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (step.status !== "setPassword") return;

    if (password.length < 4) {
      setStep({ ...step, status: "error" as const, message: "Password must be at least 4 characters.", step: "setPassword" });
      // Restore setPassword after error — we need to keep the player ref
      setStep({ status: "error", message: "Password must be at least 4 characters.", step: "setPassword" });
      return;
    }

    if (password !== confirmPassword) {
      setStep({ status: "error", message: "Passwords do not match.", step: "setPassword" });
      return;
    }

    const selectedPlayer = step.player;
    setStep({ status: "saving" });

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastName, playerId: selectedPlayer.id, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStep({ status: "error", message: data.error ?? "Something went wrong.", step: "setPassword" });
        return;
      }

      window.location.href = "/my";
    } catch {
      setStep({ status: "error", message: "Network error. Please try again.", step: "setPassword" });
    }
  }

  function selectPlayer(player: Player) {
    setPassword("");
    setConfirmPassword("");
    setStep({ status: "setPassword", player });
  }

  function goBackToSearch() {
    setStep({ status: "search" });
  }

  const isSearching = step.status === "searching";
  const isSaving = step.status === "saving";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 py-6 px-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-bold text-white">Jgoalz Sports</h1>
          <p className="text-purple-200 text-sm mt-1">Set Up Your Account</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Step 1: Search */}
        {(step.status === "search" || step.status === "searching" || step.status === "results" || (step.status === "error" && step.step === "search")) && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Find Your Account</h2>
            <p className="text-gray-500 text-sm mb-6">Enter your last name to find your account.</p>

            {step.status === "error" && step.step === "search" && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm text-red-700">{step.message}</p>
              </div>
            )}

            <form onSubmit={handleSearch} className="space-y-5">
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your last name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className={`w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  isSearching ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Searching...
                  </>
                ) : (
                  "Find My Account"
                )}
              </button>
            </form>

            {/* Results */}
            {step.status === "results" && (
              <div className="mt-6">
                {step.players.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-600 text-sm mb-3">
                      No accounts found matching that name. Try a different spelling or register as a new player.
                    </p>
                    <Link href="/join" className="text-purple-600 hover:text-purple-700 font-medium text-sm">
                      Register as a new player
                    </Link>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700 mb-3">Select your account:</p>
                    <div className="space-y-2">
                      {step.players.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => selectPlayer(player)}
                          className="w-full flex items-center justify-between rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50 px-4 py-3 transition-colors text-left"
                        >
                          <span className="text-sm font-medium text-gray-900">{player.name}</span>
                          <span className="text-xs text-gray-500">
                            {SEGMENT_LABELS[player.segment] ?? player.segment}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have a password?{" "}
              <Link href="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                Log in
              </Link>
            </p>
          </div>
        )}

        {/* Step 2: Set Password */}
        {(step.status === "setPassword" || step.status === "saving" || (step.status === "error" && step.step === "setPassword")) && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <button
              onClick={goBackToSearch}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {step.status === "setPassword" && (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  Hi {step.player.name.split(" ")[0]}!
                </h2>
                <p className="text-gray-500 text-sm mb-6">Set a password to access your account.</p>
              </>
            )}

            {step.status === "saving" && (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Creating Account</h2>
                <p className="text-gray-500 text-sm mb-6">Please wait...</p>
              </>
            )}

            {step.status === "error" && step.step === "setPassword" && (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Set Your Password</h2>
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-700">{step.message}</p>
                </div>
              </>
            )}

            <form onSubmit={handleSetPassword} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 4 characters"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={4}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className={`w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  isSaving ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
