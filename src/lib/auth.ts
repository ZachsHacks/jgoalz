import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { supabase } from "./supabase";
import type { Player } from "@/types/database";

const JWT_SECRET = process.env.JWT_SECRET || "jgoalz-dev-secret-change-in-prod";
const COOKIE_NAME = "jgoalz_session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(playerId: string): string {
  return jwt.sign({ playerId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { playerId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { playerId: string };
  } catch {
    return null;
  }
}

export async function setSessionCookie(playerId: string) {
  const token = createToken(playerId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionPlayer(): Promise<Player | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("id", payload.playerId)
    .single();

  return (data as Player) ?? null;
}
