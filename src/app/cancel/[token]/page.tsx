"use client";

import { use, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Game, Player, Session, SessionPlayer } from "@/types/database";

type CancelData = {
  sessionPlayer: SessionPlayer;
  session: Session;
  game: Game;
  player: Player;
};

type CancelState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CancelData; isLate: boolean }
  | { status: "cancelling" }
  | { status: "done"; wasLate: boolean };

export default function CancelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = useState<CancelState>({ status: "loading" });

  const loadData = useCallback(async () => {
    // Look up session_player by cancel_token
    const { data: sp, error: spErr } = await supabase
      .from("session_players")
      .select("*")
      .eq("cancel_token", token)
      .single();

    if (spErr || !sp) {
      setState({ status: "error", message: "This cancellation link is invalid or has expired." });
      return;
    }

    const sessionPlayer = sp as SessionPlayer;

    if (sessionPlayer.status !== "confirmed") {
      setState({
        status: "error",
        message: "This spot has already been cancelled.",
      });
      return;
    }

    // Load session + game + player
    const [sessionRes, playerRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("*, game:games(*)")
        .eq("id", sessionPlayer.session_id)
        .single(),
      supabase
        .from("players")
        .select("*")
        .eq("id", sessionPlayer.player_id)
        .single(),
    ]);

    if (!sessionRes.data || !playerRes.data) {
      setState({ status: "error", message: "Session or player data not found." });
      return;
    }

    const sessionWithGame = sessionRes.data as Session & { game: Game };
    const session: Session = {
      id: sessionWithGame.id,
      game_id: sessionWithGame.game_id,
      date: sessionWithGame.date,
      status: sessionWithGame.status,
      spots_remaining: sessionWithGame.spots_remaining,
      created_at: sessionWithGame.created_at,
    };
    const game = sessionWithGame.game;
    const player = playerRes.data as Player;

    // Check if within 24 hours
    const sessionDateTime = new Date(session.date + "T" + (game.time || "00:00"));
    const now = new Date();
    const hoursUntil = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLate = hoursUntil <= 24;

    setState({
      status: "ready",
      data: { sessionPlayer, session, game, player },
      isLate,
    });
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCancel() {
    if (state.status !== "ready") return;
    setState({ status: "cancelling" });

    const { sessionPlayer, session, game } = state.data;
    const isLate = state.isLate;
    const newStatus = isLate ? "cancelled_late" : "cancelled_early";

    // 1. Update session_player status
    await supabase
      .from("session_players")
      .update({
        status: newStatus,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", sessionPlayer.id);

    // 2. If cancelled early, refund the credit
    if (!isLate) {
      const { data: creditRows } = await supabase
        .from("player_credits")
        .select("*")
        .eq("player_id", sessionPlayer.player_id)
        .eq("game_id", game.id)
        .limit(1);

      if (creditRows && creditRows.length > 0) {
        const credit = creditRows[0];
        if (credit.credits_used > 0) {
          await supabase
            .from("player_credits")
            .update({ credits_used: credit.credits_used - 1 })
            .eq("id", credit.id);
        }
      }
    }

    // 3. Increment spots_remaining
    await supabase
      .from("sessions")
      .update({ spots_remaining: session.spots_remaining + 1 })
      .eq("id", session.id);

    // 4. Delete payment record
    await supabase
      .from("payments")
      .delete()
      .eq("session_id", session.id)
      .eq("player_id", sessionPlayer.player_id);

    // 5. Notify eligible drop-in players about the open spot
    await notifyDropIns(session, game);

    setState({ status: "done", wasLate: isLate });
  }

  async function notifyDropIns(session: Session, game: Game) {
    try {
      // Find all players in the same segment who are NOT already in this session
      const { data: existingPlayers } = await supabase
        .from("session_players")
        .select("player_id")
        .eq("session_id", session.id);

      const excludeIds = (existingPlayers ?? []).map((sp: { player_id: string }) => sp.player_id);

      let query = supabase
        .from("players")
        .select("*")
        .eq("segment", game.segment);

      if (excludeIds.length > 0) {
        // Use a filter to exclude already-registered players
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }

      const { data: eligiblePlayers } = await query;

      if (!eligiblePlayers || eligiblePlayers.length === 0) return;

      const sessionDate = new Date(session.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      for (const player of eligiblePlayers as Player[]) {
        if (!player.phone) continue;

        const claimUrl = `${baseUrl}/claim/${session.id}?phone=${encodeURIComponent(player.phone)}`;
        const message =
          `A spot just opened up for ${game.name} on ${sessionDate} at ${game.time}! ` +
          `Claim it here: ${claimUrl}`;

        await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: player.phone,
            body: message,
            playerId: player.id,
            sessionId: session.id,
            type: "drop_in_notification",
          }),
        });
      }
    } catch (err) {
      console.error("Failed to notify drop-ins:", err);
    }
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Cancel</h2>
            <p className="text-gray-600">{state.message}</p>
          </div>
        )}

        {state.status === "ready" && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Hi {state.data.player.name},
            </h2>
            <p className="text-gray-600 mb-6">
              Cancel your spot for <strong>{state.data.game.name}</strong>?
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
            </div>

            {/* Policy notice */}
            <div
              className={`rounded-lg p-4 mb-6 ${
                state.isLate
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-green-50 border border-green-200"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  state.isLate ? "text-amber-800" : "text-green-800"
                }`}
              >
                {state.isLate
                  ? "Same-day cancellation: your session credit will be forfeited per our policy."
                  : "Your session credit will be refunded."}
              </p>
            </div>

            <button
              onClick={handleCancel}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Confirm Cancellation
            </button>
          </div>
        )}

        {state.status === "cancelling" && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Processing your cancellation...</p>
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
              You&apos;ve Been Cancelled
            </h2>
            <p className="text-gray-600">
              {state.wasLate
                ? "Your session credit has been forfeited per our same-day cancellation policy."
                : "Your session credit has been refunded."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
