import { supabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import { NextRequest } from "next/server";
import type { Segment } from "@/types/database";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data ?? []);
  } catch (err) {
    console.error("GET /api/announcements error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, body, segment, sendSms } = await request.json();

    if (!title || !body) {
      return Response.json(
        { error: "Missing required fields: title, body" },
        { status: 400 }
      );
    }

    // Insert the announcement
    const { data: announcement, error: insertError } = await supabase
      .from("announcements")
      .insert({
        title,
        body,
        segment: segment ?? null,
        sent_via_sms: false,
      })
      .select()
      .single();

    if (insertError || !announcement) {
      return Response.json(
        { error: insertError?.message ?? "Failed to insert announcement" },
        { status: 500 }
      );
    }

    let smsCount = 0;

    if (sendSms) {
      // Build player query
      let query = supabase
        .from("players")
        .select("id, name, phone")
        .eq("active", true)
        .not("phone", "is", null);

      if (segment) {
        query = query.eq("segment", segment as Segment);
      }

      const { data: players } = await query;

      if (players && players.length > 0) {
        for (const player of players) {
          if (!player.phone) continue;

          const result = await sendSMS(player.phone, body);

          // Log to sms_log
          await supabase.from("sms_log").insert({
            player_id: player.id,
            session_id: null,
            type: "announcement",
            sent_at: new Date().toISOString(),
          });

          if (result.success) {
            smsCount++;
          }
        }

        // Update announcement to mark SMS as sent
        await supabase
          .from("announcements")
          .update({ sent_via_sms: true })
          .eq("id", announcement.id);

        announcement.sent_via_sms = true;
      }
    }

    return Response.json({ announcement, smsCount });
  } catch (err) {
    console.error("POST /api/announcements error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
