export type Segment = "women" | "teens" | "girls";
export type Sport = "soccer" | "basketball";
export type SessionStatus = "upcoming" | "in_progress" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "reminded";
export type PlayerSource = "permanent" | "drop_in";
export type SessionPlayerStatus = "confirmed" | "cancelled_early" | "cancelled_late" | "no_show";
export type GamePlayerStatus = "active" | "paused" | "dropped";
export type Commitment = "permanent" | "sub";

export type Player = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  segment: Segment;
  emergency_contact: string | null;
  notes: string | null;
  commitment: Commitment;
  play_day: number | null;
  play_time: string | null;
  location_preference: string | null;
  phone2: string | null;
  active: boolean;
  school: string | null;
  age: number | null;
  experience_level: string | null;
  waiver_accepted_at: string | null;
  created_at: string;
};

export type Game = {
  id: string;
  name: string;
  sport: Sport;
  segment: Segment;
  day_of_week: number;
  time: string;
  location: string;
  capacity: number;
  price_per_player: number;
  transport_fee: number | null;
  active: boolean;
  created_at: string;
};

export type GamePlayer = {
  id: string;
  game_id: string;
  player_id: string;
  status: GamePlayerStatus;
  joined_at: string;
};

export type Session = {
  id: string;
  game_id: string;
  date: string;
  status: SessionStatus;
  spots_remaining: number;
  created_at: string;
};

export type SessionPlayer = {
  id: string;
  session_id: string;
  player_id: string;
  source: PlayerSource;
  status: SessionPlayerStatus;
  needs_transport: boolean;
  cancel_token: string;
  policy_accepted: boolean;
  cancelled_at: string | null;
  created_at: string;
};

export type PlayerCredit = {
  id: string;
  player_id: string;
  game_id: string;
  credits_purchased: number;
  credits_used: number;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  session_id: string;
  player_id: string;
  amount: number;
  status: PaymentStatus;
  reminded_at: string | null;
  paid_at: string | null;
  month: string | null;
  notes: string | null;
  created_at: string;
};

export type Driver = {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  capacity: number;
  default_segment: Segment | null;
  created_at: string;
};

export type DriverAssignment = {
  id: string;
  session_id: string;
  driver_id: string;
  player_id: string;
  sort_order: number;
  created_at: string;
};

export type Expense = {
  id: string;
  session_id: string | null;
  description: string;
  amount: number;
  month: string;
  created_at: string;
};

// Joined types for UI
export type GamePlayerWithPlayer = GamePlayer & { player: Player };
export type SessionPlayerWithPlayer = SessionPlayer & { player: Player };
export type SessionWithGame = Session & { game: Game };
export type PaymentWithDetails = Payment & { player: Player; session: SessionWithGame };

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

// Day of week helper
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

// Segment display helpers
export const SEGMENT_LABELS: Record<Segment, string> = {
  women: "Women (18+)",
  teens: "Teen Girls (13-17)",
  girls: "Girls (Under 12)",
};

export const SEGMENT_COLORS: Record<Segment, { bg: string; text: string; badge: string }> = {
  women: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-800" },
  teens: { bg: "bg-pink-50", text: "text-pink-700", badge: "bg-pink-100 text-pink-800" },
  girls: { bg: "bg-teal-50", text: "text-teal-700", badge: "bg-teal-100 text-teal-800" },
};

export const COMMITMENT_LABELS: Record<Commitment, string> = {
  permanent: "Permanent",
  sub: "Sub / Fill-in",
};
