import { NextRequest, NextResponse } from "next/server";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { lastName, playerId, password } = await req.json();

  // Step 1 - Lookup by lastName
  if (lastName && !playerId) {
    const { data: players, error } = await supabase
      .from("players")
      .select("id, name, segment")
      .ilike("name", `%${lastName}%`)
      .is("password_hash", null);

    if (error) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ players: players ?? [] });
  }

  // Step 2 - Claim with playerId + password
  if (playerId && password) {
    const { data: player, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();

    if (error || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (player.password_hash) {
      return NextResponse.json(
        { error: "Account already has a password set" },
        { status: 400 }
      );
    }

    const hash = await hashPassword(password);

    const { error: updateError } = await supabase
      .from("players")
      .update({ password_hash: hash })
      .eq("id", playerId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to save password" }, { status: 500 });
    }

    await setSessionCookie(player.id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
