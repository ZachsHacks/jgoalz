import { NextResponse } from "next/server";
import { getSessionPlayer } from "@/lib/auth";

export async function GET() {
  const player = await getSessionPlayer();

  if (!player) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Return player without password_hash
  const { password_hash: _, ...safePlayer } = player;

  return NextResponse.json(safePlayer);
}
