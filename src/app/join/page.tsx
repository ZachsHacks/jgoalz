"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";
import type { Segment, Commitment, Location } from "@/types/database";
import { SEGMENT_LABELS, COMMITMENT_LABELS, DAY_NAMES } from "@/types/database";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "done" };

export default function JoinPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [segment, setSegment] = useState<Segment | "">("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [school, setSchool] = useState("");
  const [age, setAge] = useState("");
  const [locationPreference, setLocationPreference] = useState("");
  const [commitment, setCommitment] = useState<Commitment | "">("");
  const [playDay, setPlayDay] = useState("");
  const [playTime, setPlayTime] = useState("");
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  useEffect(() => {
    async function loadLocations() {
      const { data } = await supabase
        .from("locations")
        .select("*")
        .eq("active", true)
        .order("name");
      if (data) setLocations(data as Location[]);
    }
    loadLocations();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!segment) {
      setFormState({ status: "error", message: "Please select a group." });
      return;
    }
    if (!commitment) {
      setFormState({ status: "error", message: "Please select your commitment level." });
      return;
    }
    if (!waiverAccepted) {
      setFormState({ status: "error", message: "You must accept the waiver to register." });
      return;
    }
    if (!policyAccepted) {
      setFormState({ status: "error", message: "You must acknowledge the cancellation policy to register." });
      return;
    }

    setFormState({ status: "submitting" });

    const normalizedPhone = phone.replace(/\D/g, "");

    // Duplicate check
    const { data: existing } = await supabase
      .from("players")
      .select("id")
      .eq("segment", segment);

    const duplicate = (existing ?? []).find((p: { id: string } & Record<string, unknown>) => {
      const existingPhone = (p as unknown as { phone?: string }).phone;
      if (!existingPhone) return false;
      return existingPhone.replace(/\D/g, "") === normalizedPhone;
    });

    if (duplicate) {
      setFormState({
        status: "error",
        message: "A player with this phone number is already registered in this group.",
      });
      return;
    }

    const insertData: Record<string, unknown> = {
      name: name.trim(),
      phone: normalizedPhone,
      email: email.trim() || null,
      address: address.trim() || null,
      segment,
      emergency_contact: emergencyContact.trim() || null,
      commitment,
      play_day: commitment === "permanent" && playDay !== "" ? parseInt(playDay, 10) : null,
      play_time: commitment === "permanent" && playTime.trim() ? playTime.trim() : null,
      location_preference: locationPreference || null,
      active: true,
      waiver_accepted_at: new Date().toISOString(),
    };

    if (segment === "girls") {
      insertData.school = school.trim() || null;
      insertData.age = age !== "" ? parseInt(age, 10) : null;
    }

    const { error } = await supabase.from("players").insert(insertData);

    if (error) {
      setFormState({ status: "error", message: "Something went wrong. Please try again." });
      return;
    }

    setFormState({ status: "done" });
  }

  const isSubmitting = formState.status === "submitting";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 py-6 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white text-center">Jgoalz</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        {formState.status === "done" ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">You&apos;re registered!</h2>
            <p className="text-gray-600">
              The organizer will be in touch about upcoming games.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Join Jgoalz</h2>
            <p className="text-gray-500 text-sm mb-6">Fill out the form below to register as a player.</p>

            {formState.status === "error" && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm text-red-700">{formState.message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Brooklyn, NY"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Segment */}
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">
                  Group <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(SEGMENT_LABELS) as Segment[]).map((seg) => (
                    <label
                      key={seg}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                        segment === seg
                          ? "border-purple-600 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="segment"
                        value={seg}
                        checked={segment === seg}
                        onChange={() => setSegment(seg)}
                        className="accent-purple-600"
                      />
                      <span className="text-sm text-gray-800">{SEGMENT_LABELS[seg]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Girls-only fields */}
              {segment === "girls" && (
                <>
                  <div>
                    <label htmlFor="school" className="block text-sm font-medium text-gray-700 mb-1">
                      School <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="school"
                      type="text"
                      required
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="School name"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                      Age <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="age"
                      type="number"
                      required
                      min={1}
                      max={11}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="Age"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}

              {/* Emergency Contact */}
              <div>
                <label htmlFor="emergency_contact" className="block text-sm font-medium text-gray-700 mb-1">
                  Emergency Contact
                </label>
                <input
                  id="emergency_contact"
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Name and phone number"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Location Preference */}
              {locations.length > 0 && (
                <div>
                  <label htmlFor="location_preference" className="block text-sm font-medium text-gray-700 mb-1">
                    Location Preference
                  </label>
                  <select
                    id="location_preference"
                    value={locationPreference}
                    onChange={(e) => setLocationPreference(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">No preference</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Commitment */}
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">
                  Commitment <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(COMMITMENT_LABELS) as Commitment[]).map((c) => (
                    <label
                      key={c}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                        commitment === c
                          ? "border-purple-600 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="commitment"
                        value={c}
                        checked={commitment === c}
                        onChange={() => setCommitment(c)}
                        className="accent-purple-600"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">
                          {c === "permanent" ? "I play every week" : "I\u2019m a sub / fill-in"}
                        </span>
                        {c === "permanent" && (
                          <span className="block text-xs text-gray-500">Permanent player</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Permanent-only fields */}
              {commitment === "permanent" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="play_day" className="block text-sm font-medium text-gray-700 mb-1">
                      Play Day
                    </label>
                    <select
                      id="play_day"
                      value={playDay}
                      onChange={(e) => setPlayDay(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select day</option>
                      {DAY_NAMES.map((day, idx) => (
                        <option key={day} value={idx}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="play_time" className="block text-sm font-medium text-gray-700 mb-1">
                      Play Time
                    </label>
                    <input
                      id="play_time"
                      type="text"
                      value={playTime}
                      onChange={(e) => setPlayTime(e.target.value)}
                      placeholder="e.g. 7:00 PM"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Waiver */}
              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="waiver"
                  checked={waiverAccepted}
                  onCheckedChange={(checked) => setWaiverAccepted(checked)}
                  className="mt-0.5"
                />
                <label htmlFor="waiver" className="text-sm text-gray-700 leading-tight cursor-pointer">
                  I have read and agree to the Jgoalz waiver and liability release.
                </label>
              </div>

              {/* Cancellation Policy */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="policy"
                  checked={policyAccepted}
                  onCheckedChange={(checked) => setPolicyAccepted(checked)}
                  className="mt-0.5"
                />
                <label htmlFor="policy" className="text-sm text-gray-700 leading-tight cursor-pointer">
                  I understand the cancellation policy: cancellations within 24 hours of game time forfeit the session credit.
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors mt-2 flex items-center justify-center gap-2 ${
                  isSubmitting ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Submitting...
                  </>
                ) : (
                  "Register"
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
