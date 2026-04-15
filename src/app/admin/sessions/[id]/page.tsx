"use client";

import { use, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  UserPlus,
  Search,
  Trash2,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Truck,
} from "lucide-react";
import Link from "next/link";
import type {
  Session,
  Game,
  Player,
  SessionPlayerWithPlayer,
  Payment,
  Driver,
  DriverAssignment,
  Segment,
  PlayerCredit,
} from "@/types/database";
import { SEGMENT_COLORS, SEGMENT_LABELS } from "@/types/database";

type SessionWithGame = Session & { game: Game };

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [session, setSession] = useState<SessionWithGame | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<SessionPlayerWithPlayer[]>([]);
  const [paymentMap, setPaymentMap] = useState<Record<string, Payment>>({});
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([]);
  const [creditMap, setCreditMap] = useState<Record<string, PlayerCredit>>({});
  const [loading, setLoading] = useState(true);

  // Add drop-in player state
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [addNeedsTransport, setAddNeedsTransport] = useState(false);

  const loadData = useCallback(async () => {
    const [sessionRes, spRes, driversRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("*, game:games(*)")
        .eq("id", id)
        .single(),
      supabase
        .from("session_players")
        .select("*, player:players(*)")
        .eq("session_id", id)
        .order("created_at"),
      supabase.from("drivers").select("*").order("name"),
    ]);

    const sess = sessionRes.data as SessionWithGame;
    setSession(sess);
    const sps = (spRes.data as SessionPlayerWithPlayer[]) ?? [];
    setSessionPlayers(sps);
    setDrivers((driversRes.data as Driver[]) ?? []);

    // Load payments
    if (sps.length > 0) {
      const playerIds = sps.map((sp) => sp.player_id);
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("session_id", id)
        .in("player_id", playerIds);

      const pMap: Record<string, Payment> = {};
      for (const p of (payments ?? []) as Payment[]) {
        pMap[p.player_id] = p;
      }
      setPaymentMap(pMap);
    }

    // Load driver assignments
    const { data: assignData } = await supabase
      .from("driver_assignments")
      .select("*")
      .eq("session_id", id)
      .order("sort_order");
    setDriverAssignments((assignData ?? []) as DriverAssignment[]);

    // Load player credits for this game
    if (sess?.game?.id) {
      const { data: creditsData } = await supabase
        .from("player_credits")
        .select("*")
        .eq("game_id", sess.game.id);
      const cMap: Record<string, PlayerCredit> = {};
      for (const c of (creditsData ?? []) as PlayerCredit[]) {
        cMap[c.player_id] = c;
      }
      setCreditMap(cMap);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function updateSessionStatus(status: string) {
    await supabase.from("sessions").update({ status }).eq("id", id);
    loadData();
  }

  async function searchPlayers(query: string) {
    setPlayerSearch(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    if (!session) return;
    const segment = session.game.segment;
    const digits = query.replace(/\D/g, "");
    const isPhoneSearch = digits.length >= 2;

    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("segment", segment)
      .or(
        isPhoneSearch
          ? `name.ilike.%${query}%,phone.ilike.%${digits}%`
          : `name.ilike.%${query}%`
      )
      .order("name")
      .limit(10);

    // Filter out players already in the session
    const existingIds = new Set(sessionPlayers.map((sp) => sp.player_id));
    setSearchResults(
      ((data as Player[]) ?? []).filter((p) => !existingIds.has(p.id))
    );
  }

  async function addDropInPlayer(player: Player) {
    if (!session) return;
    const game = session.game;

    // Create session_player
    const { error: spErr } = await supabase.from("session_players").insert({
      session_id: id,
      player_id: player.id,
      source: "drop_in",
      status: "confirmed",
      needs_transport: addNeedsTransport,
      cancel_token: crypto.randomUUID(),
    });
    if (spErr) {
      if (spErr.code === "23505") {
        alert("This player is already in the session.");
      } else {
        alert("Failed to add player.");
      }
      return;
    }

    // Create payment record
    const transportFee =
      addNeedsTransport && game.transport_fee ? game.transport_fee : 0;
    const amount = game.price_per_player + transportFee;
    const sessionDate = new Date(session.date + "T00:00:00");
    const month = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}`;

    await supabase.from("payments").insert({
      session_id: id,
      player_id: player.id,
      amount,
      status: "pending",
      month,
    });

    // Update spots_remaining
    await supabase
      .from("sessions")
      .update({ spots_remaining: (session.spots_remaining ?? 1) - 1 })
      .eq("id", id);

    // Reset and reload
    setShowAddPlayer(false);
    setPlayerSearch("");
    setSearchResults([]);
    setAddNeedsTransport(false);
    loadData();
  }

  async function toggleTransport(sp: SessionPlayerWithPlayer) {
    if (!session) return;
    const newValue = !sp.needs_transport;
    await supabase
      .from("session_players")
      .update({ needs_transport: newValue })
      .eq("id", sp.id);

    // Recalculate payment amount
    const game = session.game;
    const transportFee = newValue && game.transport_fee ? game.transport_fee : 0;
    const newAmount = game.price_per_player + transportFee;
    const payment = paymentMap[sp.player_id];
    if (payment) {
      await supabase
        .from("payments")
        .update({ amount: newAmount })
        .eq("id", payment.id);
    }

    loadData();
  }

  async function markPaid(playerId: string) {
    const payment = paymentMap[playerId];
    if (!payment) return;
    await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", payment.id);
    loadData();
  }

  async function undoPaid(playerId: string) {
    const payment = paymentMap[playerId];
    if (!payment) return;
    await supabase
      .from("payments")
      .update({ status: "pending", paid_at: null })
      .eq("id", payment.id);
    loadData();
  }

  async function adjustCredits(playerId: string, delta: number) {
    if (!session) return;
    const existing = creditMap[playerId];
    if (existing) {
      const newVal = Math.max(0, existing.credits_purchased + delta);
      await supabase
        .from("player_credits")
        .update({ credits_purchased: newVal, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      // Create new record
      const newVal = Math.max(0, delta);
      await supabase.from("player_credits").insert({
        player_id: playerId,
        game_id: session.game.id,
        credits_purchased: newVal,
        credits_used: 0,
      });
    }
    loadData();
  }

  async function removePlayer(sp: SessionPlayerWithPlayer) {
    if (!confirm(`Remove ${sp.player.name} from this session?`)) return;

    // Delete session_player
    await supabase.from("session_players").delete().eq("id", sp.id);

    // Delete payment
    await supabase
      .from("payments")
      .delete()
      .eq("session_id", id)
      .eq("player_id", sp.player_id);

    // Delete driver assignment if any
    await supabase
      .from("driver_assignments")
      .delete()
      .eq("session_id", id)
      .eq("player_id", sp.player_id);

    // Update spots remaining
    if (session) {
      await supabase
        .from("sessions")
        .update({ spots_remaining: session.spots_remaining + 1 })
        .eq("id", id);
    }

    loadData();
  }

  async function markNoShow(sp: SessionPlayerWithPlayer) {
    await supabase
      .from("session_players")
      .update({ status: "no_show" })
      .eq("id", sp.id);
    loadData();
  }

  async function assignDriver(playerId: string, driverId: string) {
    // Remove existing assignment for this player
    await supabase
      .from("driver_assignments")
      .delete()
      .eq("session_id", id)
      .eq("player_id", playerId);

    if (driverId === "none") {
      loadData();
      return;
    }

    // Get max sort_order for this driver
    const { data: existing } = await supabase
      .from("driver_assignments")
      .select("sort_order")
      .eq("session_id", id)
      .eq("driver_id", driverId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder =
      existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    await supabase.from("driver_assignments").insert({
      session_id: id,
      driver_id: driverId,
      player_id: playerId,
      sort_order: nextOrder,
    });

    loadData();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-muted-foreground">Session not found.</p>
        <Link href="/admin/sessions" className={cn(buttonVariants({ variant: "default", size: "default" }), "mt-4")}>Back to Sessions</Link>
      </div>
    );
  }

  const game = session.game;
  const segColors = SEGMENT_COLORS[game.segment as Segment];
  const confirmedPlayers = sessionPlayers.filter(
    (sp) => sp.status === "confirmed"
  );
  const transportPlayers = confirmedPlayers.filter((sp) => sp.needs_transport);
  const isGirlsSegment = game.segment === "girls";

  // Build driver assignment lookup: player_id -> DriverAssignment
  const assignmentByPlayer: Record<string, DriverAssignment> = {};
  for (const da of driverAssignments) {
    assignmentByPlayer[da.player_id] = da;
  }

  // Group transport players by driver for the driver section
  const driverGroups: Record<string, { driver: Driver; players: SessionPlayerWithPlayer[] }> = {};
  for (const da of driverAssignments) {
    const sp = sessionPlayers.find((s) => s.player_id === da.player_id);
    if (!sp || !sp.needs_transport) continue;
    if (!driverGroups[da.driver_id]) {
      const driver = drivers.find((d) => d.id === da.driver_id);
      if (!driver) continue;
      driverGroups[da.driver_id] = { driver, players: [] };
    }
    driverGroups[da.driver_id].players.push(sp);
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin/sessions" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Sessions
      </Link>

      {/* Header card */}
      <Card className="shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{game.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-purple-100 text-sm">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-4 h-4" />
                  {new Date(session.date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {game.time}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {game.location}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  {game.sport.charAt(0).toUpperCase() + game.sport.slice(1)}
                </Badge>
                <Badge className={`${segColors.badge} border-0`}>
                  {SEGMENT_LABELS[game.segment as Segment]}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant={
                  session.status === "upcoming"
                    ? "default"
                    : session.status === "in_progress"
                      ? "secondary"
                      : session.status === "completed"
                        ? "outline"
                        : "destructive"
                }
                className="text-sm px-3 py-1"
              >
                {session.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </div>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span className="font-medium">
                {session.spots_remaining} spots remaining out of {game.capacity}
              </span>
            </div>
            <div className="flex gap-2">
              {session.status === "upcoming" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => updateSessionStatus("in_progress")}
                  >
                    Start Session
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Cancel this session?")) {
                        updateSessionStatus("cancelled");
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {session.status === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => updateSessionStatus("completed")}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Complete Session
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roster */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Roster ({confirmedPlayers.length} players)
            </CardTitle>
            <Dialog open={showAddPlayer} onOpenChange={setShowAddPlayer}>
              <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Drop-In Player
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Drop-In Player</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Search for players in the{" "}
                    <strong>{SEGMENT_LABELS[game.segment as Segment]}</strong>{" "}
                    segment.
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or phone..."
                      value={playerSearch}
                      onChange={(e) => searchPlayers(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="add-transport"
                      checked={addNeedsTransport}
                      onChange={(e) => setAddNeedsTransport(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="add-transport" className="text-sm">
                      Needs transport
                    </label>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      {searchResults.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => addDropInPlayer(player)}
                          className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b last:border-b-0 transition-colors"
                        >
                          <div className="font-medium">{player.name}</div>
                          {player.phone && (
                            <div className="text-sm text-muted-foreground">
                              {player.phone}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {playerSearch.length >= 2 && searchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No matching players found in this segment.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {sessionPlayers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No players in this session yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transport</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionPlayers.map((sp) => {
                    const payment = paymentMap[sp.player_id];
                    const amount = payment?.amount ?? 0;
                    return (
                      <TableRow
                        key={sp.id}
                        className={
                          sp.status === "no_show"
                            ? "opacity-50"
                            : sp.status === "cancelled_early" || sp.status === "cancelled_late"
                              ? "opacity-40 line-through"
                              : ""
                        }
                      >
                        <TableCell className="font-medium">
                          {sp.player.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sp.player.phone ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              sp.source === "permanent"
                                ? "bg-purple-100 text-purple-800 border-0"
                                : "bg-blue-100 text-blue-800 border-0"
                            }
                          >
                            {sp.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              sp.status === "confirmed"
                                ? "default"
                                : sp.status === "no_show"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {sp.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={sp.needs_transport}
                            onChange={() => toggleTransport(sp)}
                            className="rounded border-gray-300"
                            disabled={sp.status !== "confirmed"}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {payment ? (
                            <Badge
                              variant={
                                payment.status === "paid"
                                  ? "default"
                                  : payment.status === "reminded"
                                    ? "secondary"
                                    : "outline"
                              }
                              className={
                                payment.status === "paid"
                                  ? "bg-green-100 text-green-800 border-0"
                                  : payment.status === "reminded"
                                    ? "bg-yellow-100 text-yellow-800 border-0"
                                    : ""
                              }
                            >
                              {payment.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {payment && payment.status !== "paid" && sp.status === "confirmed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => markPaid(sp.player_id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                Paid
                              </Button>
                            )}
                            {payment && payment.status === "paid" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => undoPaid(sp.player_id)}
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              >
                                Undo Paid
                              </Button>
                            )}
                            {sp.status === "confirmed" &&
                              (session.status === "in_progress" ||
                                session.status === "completed") && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => markNoShow(sp)}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  No Show
                                </Button>
                              )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removePlayer(sp)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Management */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Credit Management</CardTitle>
        </CardHeader>
        <CardContent>
          {confirmedPlayers.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No confirmed players in this session.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">Purchased</TableHead>
                    <TableHead className="text-center">Used</TableHead>
                    <TableHead className="text-center">Remaining</TableHead>
                    <TableHead className="text-center">Adjust</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmedPlayers.map((sp) => {
                    const credit = creditMap[sp.player_id];
                    const purchased = credit?.credits_purchased ?? 0;
                    const used = credit?.credits_used ?? 0;
                    const remaining = purchased - used;
                    return (
                      <TableRow key={sp.id}>
                        <TableCell className="font-medium">
                          {sp.player.name}
                        </TableCell>
                        <TableCell className="text-center">{purchased}</TableCell>
                        <TableCell className="text-center">{used}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={
                              remaining < 0
                                ? "text-red-600 font-medium"
                                : remaining === 0
                                  ? "text-muted-foreground"
                                  : "text-green-700 font-medium"
                            }
                          >
                            {remaining}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustCredits(sp.player_id, -1)}
                              disabled={purchased === 0 && !credit}
                              className="w-8 h-8 p-0"
                            >
                              -
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {purchased}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustCredits(sp.player_id, 1)}
                              className="w-8 h-8 p-0"
                            >
                              +
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Assignments - girls segment only */}
      {isGirlsSegment && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-600" />
              Driver Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transportPlayers.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                No players need transport for this session.
              </p>
            ) : (
              <div className="space-y-6">
                {/* Player-by-player assignment */}
                <div>
                  <h4 className="font-medium mb-3">Assign drivers to players</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead>Driver</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transportPlayers.map((sp) => {
                        const currentAssignment = assignmentByPlayer[sp.player_id];
                        return (
                          <TableRow key={sp.id}>
                            <TableCell className="font-medium">
                              {sp.player.name}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={currentAssignment?.driver_id ?? "none"}
                                onValueChange={(val) =>
                                  val !== null && assignDriver(sp.player_id, val)
                                }
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Select driver" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    Unassigned
                                  </SelectItem>
                                  {drivers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name} ({d.vehicle_type}, cap: {d.capacity})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Driver capacity summary */}
                {Object.keys(driverGroups).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3">Driver capacity</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.values(driverGroups).map(({ driver, players }) => (
                          <Card key={driver.id} className="shadow-none border">
                            <CardContent className="pt-4 pb-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{driver.name}</span>
                                <Badge
                                  variant={
                                    players.length > driver.capacity
                                      ? "destructive"
                                      : players.length === driver.capacity
                                        ? "secondary"
                                        : "outline"
                                  }
                                >
                                  {players.length} / {driver.capacity}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {players.map((p) => p.player.name).join(", ")}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
