import { supabase } from "@/lib/supabase";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import type { Player } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, phone, email, address, segment, emergency_contact,
      commitment, play_day, play_time, location_preference,
      experience_level, school, age, marital_status, password,
    } = body;

    if (!name || !phone || !segment || !commitment || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, "");

    // Duplicate check
    const { data: existing } = await supabase
      .from("players")
      .select("id, phone")
      .eq("segment", segment);

    const duplicate = (existing ?? []).find((p: { id: string; phone?: string | null }) => {
      if (!p.phone) return false;
      return p.phone.replace(/\D/g, "") === normalizedPhone;
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "A player with this phone number is already registered in this group." },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Build insert object
    const insertData: Record<string, unknown> = {
      name: name.trim(),
      phone: normalizedPhone,
      email: email?.trim() || null,
      address: address?.trim() || null,
      segment,
      emergency_contact: emergency_contact?.trim() || null,
      commitment,
      play_day: commitment === "permanent" && play_day != null ? play_day : null,
      play_time: commitment === "permanent" && play_time ? play_time.trim() : null,
      location_preference: location_preference || null,
      experience_level: experience_level || null,
      active: true,
      password_hash,
      waiver_accepted_at: new Date().toISOString(),
      policy_accepted_at: new Date().toISOString(),
    };

    if (segment === "girls" || segment === "teens") {
      insertData.school = school?.trim() || null;
      insertData.age = age != null ? age : null;
    }

    if (segment === "women") {
      insertData.age = age != null ? age : null;
      insertData.marital_status = marital_status || null;
    }

    const { data, error } = await supabase
      .from("players")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Set session cookie
    await setSessionCookie(data.id);

    return NextResponse.json({ success: true, playerId: data.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
