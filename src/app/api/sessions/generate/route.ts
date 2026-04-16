import { supabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { Game, GamePlayer, Player } from "@/types/database";

export async function POST() {
  try {
    const { data: games, error: gamesErr } = await supabase
      .from("games")
      .select("*")
      .eq("active", true)
      .eq("archived", false);

    if (gamesErr) {
      return NextResponse.json({ error: gamesErr.message }, { status: 500 });
    }

    const created: { session_id: string; game_name: string; date: string; players_added: number; players_blocked: number }[] = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    for (const game of (games ?? []) as Game[]) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDow = today.getDay();
      let daysUntil = game.day_of_week - todayDow;
      if (daysUntil < 0) daysUntil += 7;

      const { data: gamePlayers } = await supabase
        .from("game_players")
        .select("*, player:players(*)")
        .eq("game_id", game.id)
        .eq("status", "active");

      const activePlayers = (gamePlayers ?? []) as (GamePlayer & { player: Player })[];

      for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
        const sessionDate = new Date(today);
        sessionDate.setDate(today.getDate() + daysUntil + weekOffset * 7);
        const dateStr = sessionDate.toISOString().split("T")[0];

        const { data: existing } = await supabase
          .from("sessions")
          .select("id")
          .eq("game_id", game.id)
          .eq("date", dateStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

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
        let playersBlocked = 0;
        const month = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}`;

        for (const gp of activePlayers) {
          // Check credit balance BEFORE enrolling
          const { data: creditRows } = await supabase
            .from("player_credits")
            .select("*")
            .eq("player_id", gp.player_id)
            .eq("game_id", game.id)
            .limit(1);

          const credit = creditRows?.[0];
          const hasCredits = credit && credit.credits_purchased > credit.credits_used;

          // Block permanent player auto-enrollment if no credits
          if (!hasCredits) {
            playersBlocked++;

            // Send SMS notification (once per week per game to avoid spam)
            const player = gp.player;
            if (player?.phone && weekOffset === 0) {
              const alreadyReminded = credit?.last_reminded_at
                ? (Date.now() - new Date(credit.last_reminded_at).getTime()) < 1000 * 60 * 60 * 24 * 7
                : false;

              if (!alreadyReminded) {
                const message = `Hi ${player.name}, your Jgoalz Sports credits for ${game.name} are used up. Please top up to continue playing. Log in at ${baseUrl}/my to manage your account.`;

                await sendSMS(player.phone, message);

                await supabase.from("sms_log").insert({
                  player_id: player.id,
                  type: "credit_low",
                  sent_at: new Date().toISOString(),
                });

                // Upsert last_reminded_at so we don't spam them
                if (credit) {
                  await supabase
                    .from("player_credits")
                    .update({ last_reminded_at: new Date().toISOString() })
                    .eq("id", credit.id);
                } else {
                  await supabase.from("player_credits").insert({
                    player_id: gp.player_id,
                    game_id: game.id,
                    credits_purchased: 0,
                    credits_used: 0,
                    last_reminded_at: new Date().toISOString(),
                  });
                }
              }
            }
            continue;
          }

          // Has credits - enroll them
          const cancelToken = randomUUID();
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

          // Deduct 1 credit
          await supabase
            .from("player_credits")
            .update({ credits_used: credit.credits_used + 1 })
            .eq("id", credit.id);

          // Create payment record (paid from credits)
          await supabase.from("payments").insert({
            session_id: newSession.id,
            player_id: gp.player_id,
            amount: game.price_per_player,
            status: "paid",
            paid_at: new Date().toISOString(),
            month,
            notes: "Auto-paid from prepaid credits",
          });
        }

        await supabase
          .from("sessions")
          .update({ spots_remaining: game.capacity - playersAdded })
          .eq("id", newSession.id);

        created.push({
          session_id: newSession.id,
          game_name: game.name,
          date: dateStr,
          players_added: playersAdded,
          players_blocked: playersBlocked,
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
