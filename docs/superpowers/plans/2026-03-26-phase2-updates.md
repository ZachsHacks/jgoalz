# Jgoalz Phase 2: Player Profiles, Calendar, Waivers, Client Portal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand player profiles with commitment/location/status fields, add a weekly calendar for spot selection, implement waivers and cancellation policy acknowledgment, and build a client-facing portal with blast announcements and reviews.

**Architecture:** Four independent subsystems that share the same Supabase backend: (1) schema + type extensions for new player fields, (2) public-facing weekly calendar page, (3) waiver/onboarding registration flow, (4) client portal with announcements and reviews. Each builds on the previous but can be committed independently.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL), Twilio SMS

---

## File Structure

### New files
- `schema-v2.sql` -- migration SQL for new columns and tables
- `src/app/join/page.tsx` -- public registration/onboarding form
- `src/app/calendar/page.tsx` -- public weekly check-in calendar
- `src/app/portal/page.tsx` -- client-facing portal (announcements + reviews)
- `src/app/portal/layout.tsx` -- portal layout with nav
- `src/app/api/announcements/route.ts` -- CRUD for announcements
- `src/app/api/reviews/route.ts` -- CRUD for reviews
- `src/app/admin/announcements/page.tsx` -- admin blast announcement composer
- `src/components/ui/checkbox.tsx` -- shadcn checkbox (needed for waiver)
- `src/components/ui/switch.tsx` -- shadcn switch (needed for active toggle)

### Modified files
- `src/types/database.ts` -- new types + updated Player type
- `src/app/admin/players/page.tsx` -- new fields in PlayerForm, active/inactive filter
- `src/app/claim/[sessionId]/page.tsx` -- cancellation policy checkbox
- `src/components/admin-nav.tsx` -- add Announcements nav item
- `schema.sql` -- append v2 migration reference comment

---

## Task 1: Database Schema Migration

**Files:**
- Create: `schema-v2.sql`
- Modify: `src/types/database.ts`

This task adds all new columns and tables needed for every feature in this phase.

- [ ] **Step 1: Write the migration SQL**

Create `schema-v2.sql`:

```sql
-- Jgoalz Phase 2 Schema Migration
-- Run this in Supabase SQL Editor AFTER the initial schema

-- 1. Player profile enhancements
ALTER TABLE players ADD COLUMN IF NOT EXISTS commitment text NOT NULL DEFAULT 'sub'
  CHECK (commitment IN ('permanent', 'sub'));
ALTER TABLE players ADD COLUMN IF NOT EXISTS play_day integer
  CHECK (play_day IS NULL OR play_day BETWEEN 0 AND 6);
ALTER TABLE players ADD COLUMN IF NOT EXISTS play_time text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS location_preference text;  -- stores location name (text), not FK; enforced at app layer
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone2 text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS school text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS waiver_accepted_at timestamptz;

-- 2. Locations reference table (extensible)
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed current locations
INSERT INTO locations (name) VALUES ('Boro Park'), ('Williamsburg')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access" ON locations FOR ALL USING (true) WITH CHECK (true);

-- 3. Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  segment text CHECK (segment IS NULL OR segment IN ('women', 'teens', 'girls')),
  sent_via_sms boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access" ON announcements FOR ALL USING (true) WITH CHECK (true);

-- 4. Reviews / comments table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  body text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access" ON reviews FOR ALL USING (true) WITH CHECK (true);

-- 5. Cancellation policy acknowledgments (per session signup)
ALTER TABLE session_players ADD COLUMN IF NOT EXISTS policy_accepted boolean NOT NULL DEFAULT false;

-- 6. Add sms_log types for new features
-- (existing check constraint needs to be replaced)
ALTER TABLE sms_log DROP CONSTRAINT IF EXISTS sms_log_type_check;
ALTER TABLE sms_log ADD CONSTRAINT sms_log_type_check
  CHECK (type IN ('spot_open', 'credit_low', 'payment_reminder',
    'cancellation_confirm', 'driver_roster', 'drop_in_notification',
    'announcement', 'welcome'));
```

- [ ] **Step 2: Update TypeScript types**

Modify `src/types/database.ts`:

Add to the `Player` type:
```typescript
commitment: "permanent" | "sub";
play_day: number | null;
play_time: string | null;
location_preference: string | null;
phone2: string | null;
active: boolean;
school: string | null;
age: number | null;
waiver_accepted_at: string | null;
```

Add new types:
```typescript
export type Location = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  segment: Segment | null;
  sent_via_sms: boolean;
  created_at: string;
};

export type Review = {
  id: string;
  player_id: string | null;
  body: string;
  rating: number | null;
  approved: boolean;
  created_at: string;
};

export type ReviewWithPlayer = Review & { player: Player | null };
```

Add to `SessionPlayer` type:
```typescript
policy_accepted: boolean;
```

Add commitment type and label helper:
```typescript
export type Commitment = "permanent" | "sub";

export const COMMITMENT_LABELS: Record<Commitment, string> = {
  permanent: "Permanent",
  sub: "Sub / Fill-in",
};
```

Update `Player.commitment` field to use the `Commitment` type:
```typescript
commitment: Commitment;
```

- [ ] **Step 3: Add a reference comment to schema.sql**

Append to the end of `schema.sql`:
```sql
-- Phase 2 migration: see schema-v2.sql
```

- [ ] **Step 4: Commit**

```bash
git add schema-v2.sql src/types/database.ts schema.sql
git commit -m "feat: phase 2 schema migration + updated types"
```

---

## Task 2: Install Missing shadcn Components

**Files:**
- Create: `src/components/ui/checkbox.tsx`
- Create: `src/components/ui/switch.tsx`

- [ ] **Step 1: Install checkbox and switch**

```bash
cd /Users/zachweiss/Documents/programs/consulting/clients/libby-schiff/jgoalz
npx shadcn@latest add checkbox switch -y
```

- [ ] **Step 2: Verify files exist**

```bash
ls src/components/ui/checkbox.tsx src/components/ui/switch.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/checkbox.tsx src/components/ui/switch.tsx
git commit -m "feat: add shadcn checkbox and switch components"
```

---

## Task 3: Player Profile Enhancements (Admin)

**Files:**
- Modify: `src/app/admin/players/page.tsx`

Update the PlayerForm and player cards to include all new fields.

- [ ] **Step 1: Update PlayerForm to include new fields**

Add the following fields to the `PlayerForm` component inside `src/app/admin/players/page.tsx`, after the existing fields:

1. **Commitment** -- Select with "Permanent" and "Sub / Fill-in" options
2. **Play Day** -- Select with day names (only visible when commitment is "permanent")
3. **Play Time** -- Text input (only visible when commitment is "permanent")
4. **Location Preference** -- Select, fetched from `locations` table at page load
5. **Second Phone** -- Text input
6. **Active** -- Switch toggle
7. **School** -- Text input (only visible when segment is "girls")
8. **Age** -- Number input (only visible when segment is "girls")

Form state additions needed:
- Add `commitment` state variable (like the existing `segment` pattern)
- Fetch locations from Supabase on mount, store in state
- Conditionally render fields based on segment/commitment

- [ ] **Step 2: Update handleAddPlayer and handleUpdatePlayer**

Both functions need to include the new fields in their Supabase insert/update calls:

```typescript
commitment: commitmentState,
play_day: commitmentState === "permanent" ? parseInt(form.get("play_day") as string) || null : null,
play_time: commitmentState === "permanent" ? (form.get("play_time") as string) || null : null,
location_preference: (form.get("location_preference") as string) || null,
phone2: (form.get("phone2") as string) || null,
active: activeState,
school: segmentState === "girls" ? (form.get("school") as string) || null : null,
age: segmentState === "girls" ? parseInt(form.get("age") as string) || null : null,
```

- [ ] **Step 3: Update player card display**

Add to the card's info section:
- Commitment badge (purple for permanent, gray for sub)
- Active/Inactive badge (green dot for active, red for inactive)
- Location preference if set
- Second phone if set
- School + age for girls segment
- Play day + time for permanent players

- [ ] **Step 4: Add active/inactive filter**

Add a third filter dropdown next to the existing segment filter:
- "All Status" / "Active" / "Inactive"
- Filter the `filtered` array by `player.active`

- [ ] **Step 5: Verify the form works end-to-end**

Run the dev server, navigate to `/admin/players`, test:
1. Create a new player with all new fields
2. Edit an existing player, add new fields
3. Filter by active/inactive
4. Verify girls segment shows school/age fields
5. Verify permanent commitment shows play day/time

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/players/page.tsx
git commit -m "feat: player profile enhancements - commitment, location, active status, girls fields"
```

---

## Task 4: Public Registration / Onboarding Form

**Files:**
- Create: `src/app/join/page.tsx`

This is a public-facing page where new players fill out their profile and accept the waiver.

- [ ] **Step 1: Build the registration page**

Create `src/app/join/page.tsx` as a client component with the Jgoalz branded header (same purple gradient as claim/cancel pages).

The form collects:
- Name (required)
- Phone (required)
- Email
- Address
- Segment (required) -- radio buttons: Women (18+), Teen Girls (13-17), Girls (Under 12)
- Emergency Contact
- School (required if segment is "girls")
- Age (required if segment is "girls")
- Location Preference -- dropdown from `locations` table
- Commitment -- radio: "I play every week (Permanent)" / "I'm a sub / fill-in"
- Play Day + Play Time (if permanent)
- Waiver checkbox (required): "I have read and agree to the Jgoalz waiver and liability release."
- Cancellation policy checkbox (required): "I understand the cancellation policy: cancellations within 24 hours of game time forfeit the session credit."

On submit:
1. Normalize phone (strip non-digits)
2. Check for duplicate player (same phone + segment)
3. Insert into `players` table with `waiver_accepted_at: new Date().toISOString()`
4. Show success screen: "You're registered! The organizer will be in touch."

- [ ] **Step 2: Test the form**

Navigate to `/join`, fill out the form for each segment:
1. Women player with permanent commitment
2. Teen sub player
3. Girls player (verify school/age fields appear and are required)
4. Try submitting without waiver checkbox (should fail)
5. Verify player appears in admin Players page

- [ ] **Step 3: Commit**

```bash
git add src/app/join/page.tsx
git commit -m "feat: public registration form with waiver acceptance"
```

---

## Task 5: Cancellation Policy Acknowledgment on Claim Page

**Files:**
- Modify: `src/app/claim/[sessionId]/page.tsx`

- [ ] **Step 1: Add cancellation policy checkbox**

In the "ready" state UI, before the "Claim This Spot" button, add:

```tsx
<div className="flex items-start gap-3 mb-6">
  <Checkbox
    id="policy"
    checked={policyAccepted}
    onCheckedChange={(v) => setPolicyAccepted(v === true)}
  />
  <label htmlFor="policy" className="text-sm text-gray-700 leading-tight cursor-pointer">
    I understand the cancellation policy: cancellations within 24 hours of
    game time forfeit the session credit.
  </label>
</div>
```

Disable the "Claim This Spot" button when `!policyAccepted`.

- [ ] **Step 2: Save policy_accepted to session_players**

In the `handleClaim` function, add `policy_accepted: true` to the session_players insert.

- [ ] **Step 3: Test**

1. Navigate to a claim link
2. Verify button is disabled until checkbox is checked
3. Claim a spot, verify `policy_accepted` is `true` in the database

- [ ] **Step 4: Commit**

```bash
git add src/app/claim/[sessionId]/page.tsx
git commit -m "feat: mandatory cancellation policy checkbox on claim page"
```

---

## Task 6: Weekly Check-in Calendar

**Files:**
- Create: `src/app/calendar/page.tsx`

A public-facing calendar showing this week's sessions with open spots. Players identify themselves by phone, then can join games. This task reuses the same claim logic pattern from Task 5.

- [ ] **Step 1: Build the calendar page**

Create `src/app/calendar/page.tsx` as a client component.

**Player identification:**
1. Player enters phone number
2. Normalize phone (strip non-digits), query `players` table for ALL players matching that phone (there may be multiple across segments)
3. Store matched player(s) in state -- the calendar will show sessions only for the matched players' segments
4. If no player found, show error: "No profile found. Register at /join first."

**Session display:**
1. Load all `upcoming` sessions for the current week (Sunday-Saturday) with their game details via `sessions.select("*, game:games(*)")`
2. Filter to only show sessions whose `game.segment` matches one of the identified player's segments
3. Display as a day-by-day calendar grid:
   - Each day shows cards for games happening that day
   - Each card shows: game name, time, location, sport badge, spots remaining
   - Check `session_players` for each session to determine if player is already registered
   - If player is already registered: show green "You're In" badge
   - If spots available and player not registered: show "Join" button
   - If full: show "Full" badge (grayed out)

**Join flow (reuses claim page pattern):**
1. "Join" button opens inline cancellation policy checkbox (same as Task 5)
2. Must check `policy_accepted` checkbox before confirming
3. On confirm:
   - Re-fetch `spots_remaining` (race condition guard)
   - Insert `session_player` with `source: "drop_in"`, `status: "confirmed"`, `policy_accepted: true`, `cancel_token: crypto.randomUUID()`
   - Create payment record with month field
   - Decrement `spots_remaining`
   - Update UI to show "You're In" badge (no full page reload needed)

**Layout:**
- Mobile-first: stack days vertically
- Desktop: 7-column grid for the week
- Purple gradient header with "Jgoalz Weekly Schedule"
- Phone lookup bar at the top (sticky)

- [ ] **Step 2: Test the calendar**

1. Generate sessions for the current week first (via admin)
2. Navigate to `/calendar`
3. Enter a known player's phone
4. Verify only sessions matching the player's segment are shown
5. Verify sessions display by day with correct spots
6. Join a game, verify spot count decreases and "You're In" appears
7. Verify cancellation policy checkbox blocks join without acceptance
8. Refresh, verify "You're In" persists for the joined game

- [ ] **Step 3: Commit**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat: weekly check-in calendar with spot claiming"
```

---

## Task 7: Blast Announcements (Admin + API)

**Files:**
- Create: `src/app/api/announcements/route.ts`
- Create: `src/app/admin/announcements/page.tsx`
- Modify: `src/components/admin-nav.tsx`

- [ ] **Step 1: Create the announcements API route**

Create `src/app/api/announcements/route.ts`:

- `GET`: fetch all announcements, ordered by created_at desc
- `POST`: create announcement + optionally SMS blast
  - Body: `{ title, body, segment?, sendSms: boolean }`
  - If `sendSms`:
    - Query all players matching segment (or all if null), where `active = true` and `phone IS NOT NULL`
    - Send SMS to each via `/api/sms/send` with type `announcement`
    - Set `sent_via_sms = true` on the announcement record

- [ ] **Step 2: Build the admin announcements page**

Create `src/app/admin/announcements/page.tsx`:

- List of past announcements (cards with title, body preview, segment badge, SMS sent badge, timestamp)
- "New Announcement" button opens dialog with:
  - Title (text input, required)
  - Body (textarea, required)
  - Segment filter (optional): "All Players", "Women", "Teens", "Girls"
  - "Also send via SMS" switch toggle
  - Preview count: "This will reach X players" (fetched dynamically)
  - "Send" button with confirmation: "Are you sure? This will send SMS to X players."
- After sending, show success toast and reload list

- [ ] **Step 3: Add nav item**

In `src/components/admin-nav.tsx`, add after Finances:
```typescript
{ href: "/admin/announcements", label: "Announcements", icon: Megaphone },
```

Import `Megaphone` from lucide-react.

- [ ] **Step 4: Test**

1. Navigate to `/admin/announcements`
2. Create an announcement targeting "Women" segment without SMS
3. Verify it appears in the list
4. Create one with SMS enabled, verify SMS log entries created

- [ ] **Step 5: Commit**

```bash
git add src/app/api/announcements/route.ts src/app/admin/announcements/page.tsx src/components/admin-nav.tsx
git commit -m "feat: blast announcements with optional SMS delivery"
```

---

## Task 8: Client-Facing Portal

**Files:**
- Create: `src/app/portal/layout.tsx`
- Create: `src/app/portal/page.tsx`
- Create: `src/app/api/reviews/route.ts`

This is the public-facing hub linking calendar, announcements, and reviews.

- [ ] **Step 1: Create the portal layout**

Create `src/app/portal/layout.tsx`:
- Purple gradient header with "Jgoalz" branding
- Sticky nav bar with tabs: "Schedule" (links to `/calendar`), "Announcements" (in-page), "Reviews" (in-page)
- Footer with "Powered by Jgoalz"

- [ ] **Step 2: Build the portal page**

Create `src/app/portal/page.tsx`:

**Announcements section:**
- Fetch all announcements from Supabase (most recent 20, ordered by created_at desc) -- all announcements are admin-created and published immediately, no approval needed
- Display as timeline cards with title, body, timestamp
- Filter by segment if player is identified (via phone in query param or localStorage): show announcements where `segment IS NULL` (all-segment) OR `segment` matches the player's segment

**Reviews section:**
- Display approved reviews with player name (first name only), rating stars, body, timestamp
- "Leave a Review" button:
  - Phone lookup to identify player
  - Rating (1-5 stars, clickable)
  - Comment textarea
  - Submit inserts into `reviews` table with `approved: false` (admin must approve)
  - Success: "Thanks! Your review will appear after approval."

**Links:**
- "View Weekly Schedule" card linking to `/calendar`
- "Register to Play" card linking to `/join`

- [ ] **Step 3: Create the reviews API route**

Create `src/app/api/reviews/route.ts`:
- `GET`: fetch approved reviews with player names, ordered by created_at desc
- `POST`: create review (player_id, body, rating) with `approved: false`

- [ ] **Step 4: Test the portal**

1. Navigate to `/portal`
2. Verify announcements display
3. Submit a review, verify it does NOT appear until approved
4. In Supabase, set `approved = true`, verify it appears on refresh
5. Verify calendar and registration links work

- [ ] **Step 5: Commit**

```bash
git add src/app/portal/layout.tsx src/app/portal/page.tsx src/app/api/reviews/route.ts
git commit -m "feat: client-facing portal with announcements and reviews"
```

---

## Task 9: Final Integration + Push

**Files:**
- Modify: `src/app/page.tsx` (root redirect)

- [ ] **Step 1: Update root page**

Currently redirects to `/admin`. Add a simple landing page or keep the redirect, but also add a visible link to `/portal` for players and `/join` for new signups in the portal.

- [ ] **Step 2: Verify all pages build**

```bash
cd /Users/zachweiss/Documents/programs/consulting/clients/libby-schiff/jgoalz
npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 3: Final commit and push**

```bash
git status
git add src/ schema-v2.sql schema.sql docs/
git commit -m "feat: phase 2 complete - profiles, calendar, waivers, portal"
git push origin main
```

---

## Human Setup Steps (Before Executing)

Zach needs to run `schema-v2.sql` in the Supabase SQL Editor after Task 1 creates the file, before Task 3+ can work. The plan will pause after Task 1 to confirm this is done.

---

## Summary of Public URLs Created

| URL | Purpose |
|-----|---------|
| `/join` | New player registration with waiver |
| `/calendar` | Weekly schedule with spot claiming |
| `/portal` | Client hub: announcements + reviews |
| `/claim/[sessionId]` | Existing - now with policy checkbox |
| `/cancel/[token]` | Existing - unchanged |
| `/admin/announcements` | Admin blast composer |
