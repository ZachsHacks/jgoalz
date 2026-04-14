"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  Player,
  Game,
  Session,
  SessionPlayer,
  Segment,
  Sport,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
} from "@/types/database";

// Re-declare constants to avoid import issues with barrel exports
const SEGMENT_LABELS_MAP: Record<Segment, string> = {
  women: "Women (18+)",
  teens: "Teen Girls (13-17)",
  girls: "Girls (Under 12)",
};

const SEGMENT_COLORS_MAP: Record<Segment, { bg: string; text: string; badge: string }> = {
  women: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-800" },
  teens: { bg: "bg-pink-50", text: "text-pink-700", badge: "bg-pink-100 text-pink-800" },
  girls: { bg: "bg-teal-50", text: "text-teal-700", badge: "bg-teal-100 text-teal-800" },
};

const SPORT_COLORS: Record<Sport, { bg: string; text: string }> = {
  soccer: { bg: "bg-green-100", text: "text-green-800" },
  basketball: { bg: "bg-orange-100", text: "text-orange-800" },
};

type SessionWithGame = Session & { game: Game };

type RosterPlayer = {
  name: string;
  status: string;
  source: string;
};

type SessionRoster = {
  confirmed: RosterPlayer[];
  cancelled: RosterPlayer[];
};

export default function CalendarPage() {
  const [phone, setPhone] = useState("");
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [sessions, setSessions] = useState<SessionWithGame[]>([]);
  const [registeredSessionIds, setRegisteredSessionIds] = useState<Set<string>>(new Set());
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Per-session join UI state
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [policyAccepted, setPolicyAccepted] = useState<Record<string, boolean>>({});
  const [claimingSessionId, setClaimingSessionId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<Record<string, string>>({});
  const [justJoined, setJustJoined] = useState<Set<string>>(new Set());
  const [rosters, setRosters] = useState<Record<string, SessionRoster>>({});
  const [cancelTokens, setCancelTokens] = useState<Record<string, string>>({});

  const getWeekRange = useCallback(() => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - day);
    sunday.setHours(0, 0, 0, 0);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    return { sundayStr: fmt(sunday), saturdayStr: fmt(saturday) };
  }, []);

  const loadSessions = useCallback(
    async (matchedPlayers: Player[]) => {
      setSessionsLoading(true);
      const { sundayStr, saturdayStr } = getWeekRange();

      // Load all upcoming sessions this week
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*, game:games(*)")
        .eq("status", "upcoming")
        .gte("date", sundayStr)
        .lte("date", saturdayStr)
        .order("date", { ascending: true });

      if (!sessionData) {
        setSessions([]);
        setSessionsLoading(false);
        return;
      }

      const allSessions = sessionData as SessionWithGame[];

      // Filter to matching segments
      const playerSegments = new Set(matchedPlayers.map((p) => p.segment));
      const filtered = allSessions.filter((s) => playerSegments.has(s.game.segment));

      // Load registrations for these sessions
      const sessionIds = filtered.map((s) => s.id);
      const playerIds = matchedPlayers.map((p) => p.id);

      if (sessionIds.length > 0 && playerIds.length > 0) {
        const { data: spData } = await supabase
          .from("session_players")
          .select("session_id, player_id, status, cancel_token")
          .in("session_id", sessionIds)
          .in("player_id", playerIds);

        const registered = new Set<string>();
        const tokens: Record<string, string> = {};
        if (spData) {
          for (const sp of spData as { session_id: string; player_id: string; status: string; cancel_token: string }[]) {
            if (sp.status === "confirmed") {
              registered.add(sp.session_id);
              if (sp.cancel_token) {
                tokens[sp.session_id] = sp.cancel_token;
              }
            }
          }
        }
        setRegisteredSessionIds(registered);
        setCancelTokens(tokens);
      }

      // Load rosters for all filtered sessions (player names + status)
      if (sessionIds.length > 0) {
        const { data: rosterData } = await supabase
          .from("session_players")
          .select("session_id, status, source, player:players(name)")
          .in("session_id", sessionIds)
          .in("status", ["confirmed", "cancelled_early", "cancelled_late"]);

        const rosterMap: Record<string, SessionRoster> = {};
        for (const sid of sessionIds) {
          rosterMap[sid] = { confirmed: [], cancelled: [] };
        }
        if (rosterData) {
          for (const sp of rosterData as { session_id: string; status: string; source: string; player: { name: string } | { name: string }[] | null }[]) {
            const playerObj = Array.isArray(sp.player) ? sp.player[0] : sp.player;
            const entry: RosterPlayer = {
              name: playerObj?.name ?? "Unknown",
              status: sp.status,
              source: sp.source,
            };
            if (sp.status === "confirmed") {
              rosterMap[sp.session_id].confirmed.push(entry);
            } else {
              rosterMap[sp.session_id].cancelled.push(entry);
            }
          }
        }
        setRosters(rosterMap);
      }

      setSessions(filtered);
      setSessionsLoading(false);
    },
    [getWeekRange]
  );

  async function handleLookup() {
    if (!phone.trim()) return;
    setLookupLoading(true);
    setLookupDone(false);
    setPlayers(null);
    setSessions([]);
    setRegisteredSessionIds(new Set());
    setJoiningSessionId(null);
    setPolicyAccepted({});
    setJoinError({});
    setJustJoined(new Set());

    const normalized = phone.replace(/\D/g, "");

    // Query all players, then filter by normalized phone
    const { data: allPlayers } = await supabase.from("players").select("*");

    const matched = (allPlayers as Player[] | null)?.filter((p) => {
      if (!p.phone) return false;
      return p.phone.replace(/\D/g, "") === normalized;
    });

    setLookupDone(true);
    setLookupLoading(false);

    if (matched && matched.length > 0) {
      setPlayers(matched);
      await loadSessions(matched);
    } else {
      setPlayers([]);
    }
  }

  // Find the correct player for a given session's segment
  function playerForSession(session: SessionWithGame): Player | undefined {
    if (!players) return undefined;
    return players.find((p) => p.segment === session.game.segment);
  }

  async function handleJoin(session: SessionWithGame) {
    const player = playerForSession(session);
    if (!player) return;

    setClaimingSessionId(session.id);
    setJoinError((prev) => ({ ...prev, [session.id]: "" }));

    // Re-check spots_remaining
    const { data: freshSession } = await supabase
      .from("sessions")
      .select("spots_remaining")
      .eq("id", session.id)
      .single();

    if (!freshSession || freshSession.spots_remaining <= 0) {
      setJoinError((prev) => ({ ...prev, [session.id]: "Sorry, this game just filled up." }));
      setClaimingSessionId(null);
      // Update local spots
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, spots_remaining: 0 } : s))
      );
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
      policy_accepted: true,
    });

    if (spErr) {
      if (spErr.code === "23505") {
        // Already registered
        setRegisteredSessionIds((prev) => new Set([...prev, session.id]));
        setJoiningSessionId(null);
        setClaimingSessionId(null);
        return;
      }
      setJoinError((prev) => ({ ...prev, [session.id]: "Something went wrong. Please try again." }));
      setClaimingSessionId(null);
      return;
    }

    // Create payment record
    const sessionDate = new Date(session.date + "T00:00:00");
    const month = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}`;

    await supabase.from("payments").insert({
      session_id: session.id,
      player_id: player.id,
      amount: session.game.price_per_player,
      status: "pending",
      month,
    });

    // Decrement spots_remaining
    await supabase
      .from("sessions")
      .update({ spots_remaining: freshSession.spots_remaining - 1 })
      .eq("id", session.id);

    // Update local state
    setRegisteredSessionIds((prev) => new Set([...prev, session.id]));
    setJustJoined((prev) => new Set([...prev, session.id]));
    setSessions((prev) =>
      prev.map((s) =>
        s.id === session.id ? { ...s, spots_remaining: freshSession.spots_remaining - 1 } : s
      )
    );
    // Add player to roster display
    setRosters((prev) => ({
      ...prev,
      [session.id]: {
        ...prev[session.id],
        confirmed: [
          ...(prev[session.id]?.confirmed ?? []),
          { name: player.name, status: "confirmed", source: "drop_in" },
        ],
      },
    }));
    setJoiningSessionId(null);
    setPolicyAccepted((prev) => ({ ...prev, [session.id]: false }));
    setClaimingSessionId(null);
  }

  const formatDayHeader = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  // Group sessions by date
  const sessionsByDate: Record<string, SessionWithGame[]> = {};
  for (const s of sessions) {
    if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
    sessionsByDate[s.date].push(s);
  }
  const sortedDates = Object.keys(sessionsByDate).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 py-6 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white text-center">Jgoalz Sports</h1>
        </div>
      </div>

      {/* Phone input bar */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLookup();
              }}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={handleLookup}
              disabled={lookupLoading || !phone.trim()}
              className={`bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors ${
                lookupLoading || !phone.trim() ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {lookupLoading ? "..." : "Go"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* No player found */}
        {lookupDone && players && players.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <p className="text-gray-700 mb-3">No profile found for this number.</p>
            <a
              href="/join"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors"
            >
              Register Here
            </a>
          </div>
        )}

        {/* Loading sessions */}
        {sessionsLoading && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
            </div>
          </div>
        )}

        {/* No sessions this week */}
        {lookupDone && players && players.length > 0 && !sessionsLoading && sessions.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-600">No games scheduled this week.</p>
          </div>
        )}

        {/* Calendar */}
        {!sessionsLoading && sortedDates.length > 0 && (
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <div key={date}>
                {/* Day header */}
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{formatDayHeader(date)}</h2>

                <div className="space-y-3">
                  {sessionsByDate[date].map((session) => {
                    const isRegistered = registeredSessionIds.has(session.id);
                    const isFull = session.spots_remaining <= 0;
                    const isJoining = joiningSessionId === session.id;
                    const isClaiming = claimingSessionId === session.id;
                    const wasJustJoined = justJoined.has(session.id);
                    const error = joinError[session.id];
                    const segColors = SEGMENT_COLORS_MAP[session.game.segment];
                    const sportColors = SPORT_COLORS[session.game.sport];

                    return (
                      <div key={session.id} className="bg-white rounded-lg shadow-sm p-4">
                        {/* Game name */}
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900">{session.game.name}</h3>
                          {/* Status badge */}
                          {(isRegistered || wasJustJoined) && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                You&apos;re In
                              </span>
                              {cancelTokens[session.id] && (
                                <a
                                  href={`/cancel/${cancelTokens[session.id]}`}
                                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                                >
                                  Cancel
                                </a>
                              )}
                            </div>
                          )}
                          {!isRegistered && !wasJustJoined && isFull && (
                            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              Full
                            </span>
                          )}
                        </div>

                        {/* Time + Location */}
                        <p className="text-sm text-gray-600 mb-2">
                          {session.game.time} &middot; {session.game.location}
                        </p>

                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sportColors.bg} ${sportColors.text}`}>
                            {session.game.sport.charAt(0).toUpperCase() + session.game.sport.slice(1)}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${segColors.badge}`}>
                            {SEGMENT_LABELS_MAP[session.game.segment]}
                          </span>
                        </div>

                        {/* Spots remaining */}
                        {!isRegistered && !wasJustJoined && !isFull && (
                          <p className="text-sm text-gray-500 mb-3">
                            {session.spots_remaining} {session.spots_remaining === 1 ? "spot" : "spots"} left
                          </p>
                        )}

                        {/* Roster */}
                        {rosters[session.id] && (rosters[session.id].confirmed.length > 0 || rosters[session.id].cancelled.length > 0) && (
                          <div className="border-t pt-3 mt-3 mb-3">
                            {rosters[session.id].confirmed.length > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                  Playing ({rosters[session.id].confirmed.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {rosters[session.id].confirmed.map((rp, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"
                                    >
                                      {rp.name.split(" ")[0]}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {rosters[session.id].cancelled.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                                  Cancelled ({rosters[session.id].cancelled.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {rosters[session.id].cancelled.map((rp, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center text-xs bg-red-50 text-red-400 px-2 py-0.5 rounded-full line-through"
                                    >
                                      {rp.name.split(" ")[0]}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Join button / flow */}
                        {!isRegistered && !wasJustJoined && !isFull && !isJoining && (
                          <button
                            onClick={() => {
                              setJoiningSessionId(session.id);
                              setPolicyAccepted((prev) => ({ ...prev, [session.id]: false }));
                              setJoinError((prev) => ({ ...prev, [session.id]: "" }));
                            }}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm py-2 px-4 rounded-lg transition-colors"
                          >
                            Join
                          </button>
                        )}

                        {/* Inline join confirmation */}
                        {isJoining && !isClaiming && (
                          <div className="mt-2 border-t pt-3">
                            <div className="flex items-start gap-3 mb-3">
                              <Checkbox
                                id={`policy-${session.id}`}
                                checked={policyAccepted[session.id] || false}
                                onCheckedChange={(v) =>
                                  setPolicyAccepted((prev) => ({ ...prev, [session.id]: v === true }))
                                }
                                className="mt-0.5"
                              />
                              <label
                                htmlFor={`policy-${session.id}`}
                                className="text-sm text-gray-700 leading-tight cursor-pointer"
                              >
                                I understand the cancellation policy: cancellations within 24 hours of game time
                                forfeit the session credit.
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleJoin(session)}
                                disabled={!policyAccepted[session.id]}
                                className={`flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm py-2 px-4 rounded-lg transition-colors ${
                                  !policyAccepted[session.id] ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setJoiningSessionId(null)}
                                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Claiming spinner */}
                        {isClaiming && (
                          <div className="mt-2 flex items-center justify-center gap-2 py-2">
                            <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full" />
                            <span className="text-sm text-gray-600">Claiming your spot...</span>
                          </div>
                        )}

                        {/* Error message */}
                        {error && (
                          <p className="mt-2 text-sm text-red-600">{error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
