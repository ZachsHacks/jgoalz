import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { Game, GamePlayer } from "@/types/database";

export async function POST() {
  try {
    // Get all active games
    const { data: games, error: gamesErr } = await supabase
      .from("games")
      .select("*")
      .eq("active", true);

    if (gamesErr) {
      return NextResponse.json({ error: gamesErr.message }, { status: 500 });
    }

    const created: { session_id: string; game_name: string; date: string; players_added: number }[] = [];

    for (const game of (games ?? []) as Game[]) {
      // Find next occurrence of game.day_of_week from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDow = today.getDay(); // 0=Sun
      let daysUntil = game.day_of_week - todayDow;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0) daysUntil = 0; // today counts

      // Get all active game_players once per game (outside week loop)
      const { data: gamePlayers } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", game.id)
        .eq("status", "active");

      const activePlayers = (gamePlayers ?? []) as GamePlayer[];

      for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
        const sessionDate = new Date(today);
        sessionDate.setDate(today.getDate() + daysUntil + weekOffset * 7);
        const dateStr = sessionDate.toISOString().split("T")[0];

        // Check if session already exists
        const { data: existing } = await supabase
          .from("sessions")
          .select("id")
          .eq("game_id", game.id)
          .eq("date", dateStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Create the session
        const { data: newSession, error: sessionErr } = await supabase
          .from("sessions")
          .insert({
            game_id: game.id,
            date: dateStr,
            status: "upcoming",
            spots_remaining: game.capacity,
          })
          .select()
          .single();

        if (sessionErr || !newSession) continue;

        let playersAdded = 0;
        const month = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}`;

        for (const gp of activePlayers) {
          const cancelToken = randomUUID();

          // Create session_player
          const { error: spErr } = await supabase.from("session_players").insert({
            session_id: newSession.id,
            player_id: gp.player_id,
            source: "permanent",
            status: "confirmed",
            needs_transport: false,
            cancel_token: cancelToken,
          });

          if (spErr) continue;
          playersAdded++;

          // Deduct 1 credit if available
          const { data: creditRows } = await supabase
            .from("player_credits")
            .select("*")
            .eq("player_id", gp.player_id)
            .eq("game_id", game.id)
            .limit(1);

          let paidByCredit = false;
          if (creditRows && creditRows.length > 0) {
            const credit = creditRows[0];
            if (credit.credits_used < credit.credits_purchased) {
              await supabase
                .from("player_credits")
                .update({ credits_used: credit.credits_used + 1 })
                .eq("id", credit.id);
              paidByCredit = true;
            }
          }

          // Create payment record
          const amount = game.price_per_player;
          await supabase.from("payments").insert({
            session_id: newSession.id,
            player_id: gp.player_id,
            amount,
            status: paidByCredit ? "paid" : "pending",
            paid_at: paidByCredit ? new Date().toISOString() : null,
            month,
            notes: paidByCredit ? "Auto-paid from prepaid credits" : null,
          });
        }

        // Update spots_remaining
        const spotsRemaining = game.capacity - playersAdded;
        await supabase
          .from("sessions")
          .update({ spots_remaining: spotsRemaining })
          .eq("id", newSession.id);

        created.push({
          session_id: newSession.id,
          game_name: game.name,
          date: dateStr,
          players_added: playersAdded,
        });
      }
    }

    return NextResponse.json({ success: true, sessions: created });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
