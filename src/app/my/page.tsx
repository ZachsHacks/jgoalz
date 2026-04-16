"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Game, Session, SessionPlayer } from "@/types/database";
import { SEGMENT_COLORS, SEGMENT_LABELS, DAY_NAMES } from "@/types/database";

type Player = {
  id: string;
  name: string;
  segment: string;
  phone: string;
  is_admin: boolean;
};

type UpcomingSession = Session & {
  game: Game;
  cancel_token: string;
};

function formatTime(time: string) {
  // time is like "19:00:00" or "19:00"
  const [hourStr, minStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const min = minStr ?? "00";
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${min} ${suffix}`;
}

function formatDate(dateStr: string) {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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

const SPORT_LABELS: Record<string, string> = {
  soccer: "Soccer",
  basketball: "Basketball",
};

export default function MyPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
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
        const p = data.player ?? data;
        setPlayer(p);

        // Load permanent games
        const { data: gamePlayers } = await supabase
          .from("game_players")
          .select("*, game:games(*)")
          .eq("player_id", p.id)
          .eq("status", "active");

        setGames(
          (gamePlayers ?? [])
            .filter((gp: { game: Game | null }) => gp.game?.active && !gp.game?.archived)
            .map((gp: { game: Game }) => gp.game)
        );

        // Load upcoming session registrations
        const today = new Date().toISOString().split("T")[0];
        const { data: sessionPlayers } = await supabase
          .from("session_players")
          .select("*, session:sessions(*, game:games(*))")
          .eq("player_id", p.id)
          .eq("status", "confirmed");

        const upcoming = (sessionPlayers ?? [])
          .filter((sp: { session: (Session & { game: Game }) | null }) => {
            if (!sp.session) return false;
            return sp.session.date >= today;
          })
          .sort((a: { session: Session }, b: { session: Session }) =>
            a.session.date.localeCompare(b.session.date)
          )
          .slice(0, 10)
          .map((sp: { session: Session & { game: Game }; cancel_token: string }) => ({
            ...sp.session,
            cancel_token: sp.cancel_token,
          }));

        setUpcomingSessions(upcoming);
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
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
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
          <>
            {/* Admin shortcut */}
            {player.is_admin && (
              <Link
                href="/admin"
                className="flex items-center justify-between w-full bg-purple-700 hover:bg-purple-800 text-white font-semibold py-3 px-5 rounded-xl transition-colors text-sm"
              >
                <span>Admin Dashboard</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}

            {/* Profile card */}
            <div className="bg-white rounded-xl shadow-sm p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-purple-700 font-bold text-xl">
                    {player.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Welcome, {player.name.split(" ")[0]}!
                  </h2>
                  <p className="text-sm text-purple-600 font-medium">
                    {SEGMENT_LABELS[player.segment as keyof typeof SEGMENT_LABELS] ?? player.segment}
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
                      {SEGMENT_LABELS[player.segment as keyof typeof SEGMENT_LABELS] ?? player.segment}
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

            {/* My Games section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">My Games</h3>
              {games.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center text-sm text-gray-500">
                  You&apos;re not on any permanent rosters yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {games.map((game) => {
                    const seg = game.segment as keyof typeof SEGMENT_COLORS;
                    const colors = SEGMENT_COLORS[seg] ?? SEGMENT_COLORS.women;
                    const dayName = DAY_NAMES[game.day_of_week];
                    return (
                      <div key={game.id} className="bg-white rounded-xl shadow-sm p-5">
                        <p className="font-bold text-gray-900 mb-2">{game.name}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {SPORT_LABELS[game.sport] ?? game.sport}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {SEGMENT_LABELS[seg] ?? game.segment}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{dayName}s, {formatTime(game.time)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{game.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>${game.price_per_player} / session</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Sessions section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Upcoming Games</h3>
              {upcomingSessions.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-6 text-center text-sm text-gray-500">
                  No upcoming sessions registered.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <div key={session.id} className="bg-white rounded-xl shadow-sm p-5 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-gray-900 text-sm">{session.game.name}</p>
                        <p className="text-sm text-gray-600">{formatDate(session.date)}</p>
                        <p className="text-sm text-gray-500">{formatTime(session.game.time)}</p>
                      </div>
                      <Link
                        href={`/cancel/${session.cancel_token}`}
                        className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0 mt-0.5"
                      >
                        Cancel
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
