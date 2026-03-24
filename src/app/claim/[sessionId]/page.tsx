"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Game, Player, Session } from "@/types/database";

type ClaimData = {
  session: Session;
  game: Game;
  player: Player;
};

type ClaimState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ClaimData }
  | { status: "claiming" }
  | { status: "done"; gameName: string; date: string }
  | { status: "full" }
  | { status: "already_registered" };

export default function ClaimPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone");

  const [state, setState] = useState<ClaimState>({ status: "loading" });

  const loadData = useCallback(async () => {
    if (!phone) {
      setState({ status: "error", message: "Missing phone number. This link may be invalid." });
      return;
    }

    // Load session + game
    const { data: sessionData, error: sessionErr } = await supabase
      .from("sessions")
      .select("*, game:games(*)")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !sessionData) {
      setState({ status: "error", message: "Session not found. This link may be invalid." });
      return;
    }

    const sessionWithGame = sessionData as Session & { game: Game };
    const session: Session = {
      id: sessionWithGame.id,
      game_id: sessionWithGame.game_id,
      date: sessionWithGame.date,
      status: sessionWithGame.status,
      spots_remaining: sessionWithGame.spots_remaining,
      created_at: sessionWithGame.created_at,
    };
    const game = sessionWithGame.game;

    // Check session is upcoming
    if (session.status !== "upcoming") {
      setState({ status: "error", message: "This session is no longer accepting registrations." });
      return;
    }

    // Check spots remaining
    if (session.spots_remaining <= 0) {
      setState({ status: "full" });
      return;
    }

    // Find player by phone and segment
    const normalizedPhone = phone.replace(/\D/g, "");
    const { data: players } = await supabase
      .from("players")
      .select("*")
      .eq("segment", game.segment);

    const player = (players as Player[] | null)?.find((p) => {
      if (!p.phone) return false;
      return p.phone.replace(/\D/g, "") === normalizedPhone;
    });

    if (!player) {
      setState({
        status: "error",
        message: "We couldn't find your player profile. Please contact the organizer.",
      });
      return;
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from("session_players")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("player_id", player.id)
      .limit(1);

    if (existing && existing.length > 0) {
      const sp = existing[0];
      if (sp.status === "confirmed") {
        setState({ status: "already_registered" });
        return;
      }
    }

    setState({ status: "ready", data: { session, game, player } });
  }, [sessionId, phone]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleClaim() {
    if (state.status !== "ready") return;
    setState({ status: "claiming" });

    const { session, game, player } = state.data;

    // Re-check spots_remaining (race condition guard)
    const { data: freshSession } = await supabase
      .from("sessions")
      .select("spots_remaining")
      .eq("id", session.id)
      .single();

    if (!freshSession || freshSession.spots_remaining <= 0) {
      setState({ status: "full" });
      return;
    }

    // Insert session_player
    const { error: spErr } = await supabase.from("session_players").insert({
      session_id: session.id,
      player_id: player.id,
      source: "drop_in",
      status: "confirmed",
      needs_transport: false,
      cancel_token: crypto.randomUUID(),
    });

    if (spErr) {
      if (spErr.code === "23505") {
        setState({ status: "already_registered" });
        return;
      }
      setState({ status: "error", message: "Something went wrong. Please try again." });
      return;
    }

    // Create payment record
    const sessionDate = new Date(session.date + "T00:00:00");
    const month = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}`;

    await supabase.from("payments").insert({
      session_id: session.id,
      player_id: player.id,
      amount: game.price_per_player,
      status: "pending",
      month,
    });

    // Decrement spots_remaining
    await supabase
      .from("sessions")
      .update({ spots_remaining: freshSession.spots_remaining - 1 })
      .eq("id", session.id);

    setState({
      status: "done",
      gameName: game.name,
      date: session.date,
    });
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 py-6 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white text-center">Jgoalz</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        {state.status === "loading" && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops</h2>
            <p className="text-gray-600">{state.message}</p>
          </div>
        )}

        {state.status === "full" && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Game is Full</h2>
            <p className="text-gray-600">
              Sorry, this game is full! All spots have been claimed.
            </p>
          </div>
        )}

        {state.status === "already_registered" && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Already Registered</h2>
            <p className="text-gray-600">
              You&apos;re already registered for this game. See you there!
            </p>
          </div>
        )}

        {state.status === "ready" && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Hi {state.data.player.name}!
            </h2>
            <p className="text-gray-600 mb-6">
              Claim a spot for <strong>{state.data.game.name}</strong>?
            </p>

            {/* Game details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(state.data.session.date)}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {state.data.game.time}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {state.data.game.location}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {state.data.session.spots_remaining} {state.data.session.spots_remaining === 1 ? "spot" : "spots"} left
              </div>
            </div>

            {/* Price */}
            <div className="bg-purple-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-purple-800">
                <strong>${state.data.game.price_per_player.toFixed(2)}</strong> per session
              </p>
            </div>

            <button
              onClick={handleClaim}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Claim This Spot
            </button>
          </div>
        )}

        {state.status === "claiming" && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Claiming your spot...</p>
          </div>
        )}

        {state.status === "done" && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              You&apos;re In!
            </h2>
            <p className="text-gray-600">
              Your spot for <strong>{state.gameName}</strong> on{" "}
              <strong>{formatDate(state.date)}</strong> has been confirmed. See you there!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
