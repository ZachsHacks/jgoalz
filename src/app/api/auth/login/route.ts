import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function POST(req: NextRequest) {
  const { phone, password } = await req.json();

  if (!phone || !password) {
    return NextResponse.json({ error: "Phone and password are required" }, { status: 400 });
  }

  const normalized = normalizePhone(phone);

  const { data: players, error } = await supabase.from("players").select("*");

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const player = players?.find(
    (p) => normalizePhone(p.phone ?? "") === normalized
  );

  if (!player) {
    return NextResponse.json({ error: "No account found" }, { status: 401 });
  }

  if (!player.password_hash) {
    return NextResponse.json(
      { error: "Account not set up yet. Go to /setup to create a password." },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, player.password_hash);

  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  await setSessionCookie(player.id);

  return NextResponse.json({
    success: true,
    player: {
      id: player.id,
      name: player.name,
      segment: player.segment,
    },
  });
}
