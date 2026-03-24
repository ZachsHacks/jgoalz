import { supabase } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { to, body, playerId, sessionId, type } = await request.json();

    if (!to || !body || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: to, body, type" },
        { status: 400 }
      );
    }

    const result = await sendSMS(to, body);

    // Log to sms_log
    if (playerId || sessionId) {
      await supabase.from("sms_log").insert({
        player_id: playerId ?? null,
        session_id: sessionId ?? null,
        type,
        sent_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: result.success, error: result.error });
  } catch (err) {
    console.error("SMS send route error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
