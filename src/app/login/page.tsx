"use client";

import { useState } from "react";
import Link from "next/link";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState({ status: "submitting" });

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormState({ status: "error", message: data.error ?? "Something went wrong." });
        return;
      }

      window.location.href = "/my";
    } catch {
      setFormState({ status: "error", message: "Network error. Please try again." });
    }
  }

  const isSubmitting = formState.status === "submitting";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 py-6 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white text-center">Jgoalz Sports</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Log In</h2>
          <p className="text-gray-500 text-sm mb-6">Enter your phone number and password to access your account.</p>

          {formState.status === "error" && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-700">{formState.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 555-5555"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isSubmitting ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Logging in...
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm text-gray-500">
            <p>
              New player?{" "}
              <Link href="/join" className="text-purple-600 hover:text-purple-700 font-medium">
                Register here
              </Link>
            </p>
            <p>
              Already have an account but no password?{" "}
              <Link href="/setup" className="text-purple-600 hover:text-purple-700 font-medium">
                Set up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
