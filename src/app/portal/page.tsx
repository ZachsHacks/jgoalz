"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Announcement, ReviewWithPlayer, Segment, Player } from "@/types/database";
import { SEGMENT_LABELS, SEGMENT_COLORS } from "@/types/database";

export default function PortalPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [reviews, setReviews] = useState<ReviewWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [foundPlayer, setFoundPlayer] = useState<Player | null>(null);
  const [playerLookupError, setPlayerLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      const [announcementsRes, reviewsRes] = await Promise.all([
        supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("reviews")
          .select("*, player:players(name)")
          .eq("approved", true)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (announcementsRes.data) {
        setAnnouncements(announcementsRes.data as Announcement[]);
      }
      if (reviewsRes.data) {
        setReviews(reviewsRes.data as ReviewWithPlayer[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handlePhoneLookup() {
    if (!phone.trim()) return;
    setLookingUp(true);
    setPlayerLookupError("");
    setFoundPlayer(null);

    const normalized = phone.replace(/\D/g, "");

    const { data: players } = await supabase.from("players").select("*");

    const match = (players as Player[] | null)?.find((p) => {
      if (!p.phone) return false;
      return p.phone.replace(/\D/g, "") === normalized;
    });

    if (match) {
      setFoundPlayer(match);
    } else {
      setPlayerLookupError("No profile found for this phone number.");
    }
    setLookingUp(false);
  }

  async function handleSubmitReview() {
    if (!foundPlayer || rating === 0 || !comment.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from("reviews").insert({
      player_id: foundPlayer.id,
      body: comment.trim(),
      rating,
      approved: false,
    });

    if (error) {
      setPlayerLookupError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  function resetReviewForm() {
    setShowReviewForm(false);
    setPhone("");
    setFoundPlayer(null);
    setPlayerLookupError("");
    setRating(0);
    setComment("");
    setSubmitted(false);
  }

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const firstName = (name: string) => name.split(" ")[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      {/* Quick Links */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/calendar" className="block">
            <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Weekly Schedule</h3>
              </div>
              <p className="text-sm text-gray-500">Check this week&apos;s games and claim open spots.</p>
            </div>
          </Link>

          <Link href="/join" className="block">
            <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Register to Play</h3>
              </div>
              <p className="text-sm text-gray-500">New player? Sign up here.</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Announcements */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Announcements</h2>
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
            No announcements yet.
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => (
              <div key={a.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900">{a.title}</h3>
                  {a.segment && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${SEGMENT_COLORS[a.segment].badge}`}>
                      {SEGMENT_LABELS[a.segment]}
                    </span>
                  )}
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-wrap mb-3">{a.body}</p>
                <p className="text-xs text-gray-400">{formatTimestamp(a.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Reviews</h2>
          {!showReviewForm && !submitted && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              Leave a Review
            </button>
          )}
        </div>

        {/* Review Form */}
        {showReviewForm && !submitted && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Leave a Review</h3>

            {!foundPlayer ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Your phone number
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePhoneLookup()}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    onClick={handlePhoneLookup}
                    disabled={lookingUp || !phone.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {lookingUp ? "Looking up..." : "Find Me"}
                  </button>
                </div>
                {playerLookupError && (
                  <p className="text-sm text-red-600">{playerLookupError}</p>
                )}
                <button
                  onClick={resetReviewForm}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Hi, <strong>{firstName(foundPlayer.name)}</strong>!
                </p>

                {/* Star Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rating
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`text-2xl transition-colors ${
                          star <= rating ? "text-yellow-400" : "text-gray-300"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comment
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Tell us about your experience..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitReview}
                    disabled={submitting || rating === 0 || !comment.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Submitting..." : "Submit Review"}
                  </button>
                  <button
                    onClick={resetReviewForm}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submitted confirmation */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 text-center">
            <p className="text-green-800 font-medium">
              Thanks! Your review will appear after approval.
            </p>
            <button
              onClick={resetReviewForm}
              className="text-sm text-green-600 hover:text-green-700 mt-2"
            >
              Done
            </button>
          </div>
        )}

        {/* Review List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 && !submitted ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">
            No reviews yet. Be the first!
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">
                    {r.player ? firstName(r.player.name) : "Anonymous"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTimestamp(r.created_at)}
                  </span>
                </div>
                {r.rating && (
                  <div className="flex gap-0.5 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-sm ${
                          star <= r.rating! ? "text-yellow-400" : "text-gray-300"
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-700">{r.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
