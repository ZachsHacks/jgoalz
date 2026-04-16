"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Phone,
  MapPin,
  Mail,
  Trash2,
  AlertTriangle,
  StickyNote,
  Calendar,
} from "lucide-react";
import type { Player, Segment, Commitment, Location } from "@/types/database";
import {
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  COMMITMENT_LABELS,
  DAY_NAMES,
} from "@/types/database";

function PlayerForm({
  onSubmit,
  defaultValues,
  segment,
  setSegment,
  commitment,
  setCommitment,
  active,
  setActive,
  playDay,
  setPlayDay,
  locationPreference,
  setLocationPreference,
  maritalStatus,
  setMaritalStatus,
  locations,
  submitLabel,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  defaultValues?: Player;
  segment: Segment;
  setSegment: (s: Segment) => void;
  commitment: Commitment;
  setCommitment: (c: Commitment) => void;
  active: boolean;
  setActive: (a: boolean) => void;
  playDay: string;
  setPlayDay: (v: string) => void;
  locationPreference: string;
  setLocationPreference: (v: string) => void;
  maritalStatus: string;
  setMaritalStatus: (v: string) => void;
  locations: Location[];
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name ?? ""}
          required
        />
      </div>
      <div>
        <Label htmlFor="segment">Segment</Label>
        <Select
          value={segment}
          onValueChange={(v) => setSegment(v as Segment)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="women">{SEGMENT_LABELS.women}</SelectItem>
            <SelectItem value="teens">{SEGMENT_LABELS.teens}</SelectItem>
            <SelectItem value="girls">{SEGMENT_LABELS.girls}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="commitment">Commitment</Label>
        <Select
          value={commitment}
          onValueChange={(v) => setCommitment(v as Commitment)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="permanent">{COMMITMENT_LABELS.permanent}</SelectItem>
            <SelectItem value="sub">{COMMITMENT_LABELS.sub}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {commitment === "permanent" && (
        <>
          <div>
            <Label htmlFor="play_day">Play Day</Label>
            <Select
              value={playDay}
              onValueChange={(v) => setPlayDay(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((day, i) => (
                  <SelectItem key={day} value={String(i)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="play_time">Play Time</Label>
            <Input
              id="play_time"
              name="play_time"
              placeholder="e.g. 7:00 PM"
              defaultValue={defaultValues?.play_time ?? ""}
            />
          </div>
        </>
      )}
      <div>
        <Label htmlFor="location_preference">Location</Label>
        <Select
          value={locationPreference}
          onValueChange={(v) => setLocationPreference(v ?? "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="No preference" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No preference</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.name}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={defaultValues?.phone ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="phone2">Second Phone</Label>
        <Input
          id="phone2"
          name="phone2"
          defaultValue={defaultValues?.phone2 ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          defaultValue={defaultValues?.address ?? ""}
        />
      </div>
      {(segment === "girls" || segment === "teens") && (
        <>
          <div>
            <Label htmlFor="school">School</Label>
            <Input
              id="school"
              name="school"
              defaultValue={defaultValues?.school ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              name="age"
              type="number"
              min={segment === "teens" ? 14 : 1}
              max={segment === "girls" ? 13 : 17}
              defaultValue={defaultValues?.age ?? ""}
            />
          </div>
        </>
      )}
      {segment === "women" && (
        <>
          <div>
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              name="age"
              type="number"
              min={18}
              defaultValue={defaultValues?.age ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="marital_status">Marital Status</Label>
            <Select
              value={maritalStatus}
              onValueChange={(v) => setMaritalStatus(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Single">Single</SelectItem>
                <SelectItem value="Married">Married</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <div>
        <Label htmlFor="emergency_contact">Emergency Contact</Label>
        <Input
          id="emergency_contact"
          name="emergency_contact"
          defaultValue={defaultValues?.emergency_contact ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="notes">Comments</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="active"
          checked={active}
          onCheckedChange={setActive}
        />
        <Label htmlFor="active" className="cursor-pointer">
          {active ? "Active" : "Inactive"}
        </Label>
      </div>
      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<Segment | "all">("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [addSegment, setAddSegment] = useState<Segment>("women");
  const [editSegment, setEditSegment] = useState<Segment>("women");
  const [addCommitment, setAddCommitment] = useState<Commitment>("sub");
  const [editCommitment, setEditCommitment] = useState<Commitment>("sub");
  const [addActive, setAddActive] = useState(true);
  const [editActive, setEditActive] = useState(true);
  const [addPlayDay, setAddPlayDay] = useState("");
  const [editPlayDay, setEditPlayDay] = useState("");
  const [addLocationPreference, setAddLocationPreference] = useState("");
  const [editLocationPreference, setEditLocationPreference] = useState("");
  const [addMaritalStatus, setAddMaritalStatus] = useState("");
  const [editMaritalStatus, setEditMaritalStatus] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);

  async function loadPlayers() {
    const { data } = await supabase
      .from("players")
      .select("*")
      .order("name");
    setPlayers((data as Player[]) ?? []);
    setLoading(false);
  }

  async function loadLocations() {
    const { data } = await supabase
      .from("locations")
      .select("*")
      .eq("active", true)
      .order("name");
    setLocations((data as Location[]) ?? []);
  }

  useEffect(() => {
    loadPlayers();
    loadLocations();
  }, []);

  const filtered = players.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone?.includes(search) ?? false);
    const matchesSegment =
      segmentFilter === "all" || p.segment === segmentFilter;
    const matchesActive =
      activeFilter === "all" ||
      (activeFilter === "active" && p.active) ||
      (activeFilter === "inactive" && !p.active);
    return matchesSearch && matchesSegment && matchesActive;
  });

  async function handleAddPlayer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from("players").insert({
      name: form.get("name") as string,
      phone: (form.get("phone") as string) || null,
      email: (form.get("email") as string) || null,
      address: (form.get("address") as string) || null,
      segment: addSegment,
      emergency_contact: (form.get("emergency_contact") as string) || null,
      notes: (form.get("notes") as string) || null,
      commitment: addCommitment,
      play_day: addCommitment === "permanent" && addPlayDay ? parseInt(addPlayDay) : null,
      play_time: addCommitment === "permanent" ? (form.get("play_time") as string) || null : null,
      location_preference: addLocationPreference || null,
      phone2: (form.get("phone2") as string) || null,
      active: addActive,
      school: (addSegment === "girls" || addSegment === "teens") ? (form.get("school") as string) || null : null,
      age: (form.get("age") as string) ? parseInt(form.get("age") as string) : null,
      marital_status: addSegment === "women" ? addMaritalStatus || null : null,
    });
    if (error) {
      alert("Failed to save player: " + error.message);
      return;
    }
    setShowAddPlayer(false);
    setAddSegment("women");
    setAddCommitment("sub");
    setAddActive(true);
    setAddPlayDay("");
    setAddMaritalStatus("");
    setAddLocationPreference("");
    loadPlayers();
  }

  async function handleUpdatePlayer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPlayer) return;
    const form = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("players")
      .update({
        name: form.get("name") as string,
        phone: (form.get("phone") as string) || null,
        email: (form.get("email") as string) || null,
        address: (form.get("address") as string) || null,
        segment: editSegment,
        emergency_contact: (form.get("emergency_contact") as string) || null,
        notes: (form.get("notes") as string) || null,
        commitment: editCommitment,
        play_day: editCommitment === "permanent" && editPlayDay ? parseInt(editPlayDay) : null,
        play_time: editCommitment === "permanent" ? (form.get("play_time") as string) || null : null,
        location_preference: editLocationPreference || null,
        phone2: (form.get("phone2") as string) || null,
        active: editActive,
        school: (editSegment === "girls" || editSegment === "teens") ? (form.get("school") as string) || null : null,
        age: (form.get("age") as string) ? parseInt(form.get("age") as string) : null,
        marital_status: editSegment === "women" ? editMaritalStatus || null : null,
      })
      .eq("id", editingPlayer.id);
    if (error) {
      alert("Failed to update player: " + error.message);
      return;
    }
    setEditingPlayer(null);
    loadPlayers();
  }

  async function handleDeletePlayer(player: Player) {
    if (
      !confirm(
        `Delete ${player.name}? This will also remove all their game registrations, session history, and payment records.`
      )
    )
      return;

    // Delete related data in order: driver_assignments, session_players, payments, game_players, player_credits, player
    const { data: sessionPlayerIds } = await supabase
      .from("session_players")
      .select("id")
      .eq("player_id", player.id);
    if (sessionPlayerIds && sessionPlayerIds.length > 0) {
      await supabase
        .from("driver_assignments")
        .delete()
        .in(
          "session_player_id",
          sessionPlayerIds.map((sp) => sp.id)
        );
    }
    await supabase.from("session_players").delete().eq("player_id", player.id);
    await supabase.from("payments").delete().eq("player_id", player.id);
    await supabase.from("game_players").delete().eq("player_id", player.id);
    await supabase.from("player_credits").delete().eq("player_id", player.id);
    await supabase.from("players").delete().eq("id", player.id);
    loadPlayers();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Players</h2>
          <p className="text-muted-foreground mt-1">
            {loading ? "\u00a0" : `${players.length} players registered`}
          </p>
        </div>
        <Dialog open={showAddPlayer} onOpenChange={(open) => {
          setShowAddPlayer(open);
          if (!open) {
            setAddSegment("women");
            setAddCommitment("sub");
            setAddActive(true);
            setAddPlayDay("");
            setAddLocationPreference("");
          }
        }}>
          <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "default" }))}>
              <Plus className="w-4 h-4 mr-2" />
              Add Player
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Player</DialogTitle>
            </DialogHeader>
            <PlayerForm
              onSubmit={handleAddPlayer}
              segment={addSegment}
              setSegment={setAddSegment}
              commitment={addCommitment}
              setCommitment={setAddCommitment}
              active={addActive}
              setActive={setAddActive}
              playDay={addPlayDay}
              setPlayDay={setAddPlayDay}
              locationPreference={addLocationPreference}
              setLocationPreference={setAddLocationPreference}
              maritalStatus={addMaritalStatus}
              setMaritalStatus={setAddMaritalStatus}
              locations={locations}
              submitLabel="Save"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={segmentFilter}
          onValueChange={(v) => setSegmentFilter(v as Segment | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Segments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            <SelectItem value="women">{SEGMENT_LABELS.women}</SelectItem>
            <SelectItem value="teens">{SEGMENT_LABELS.teens}</SelectItem>
            <SelectItem value="girls">{SEGMENT_LABELS.girls}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={activeFilter}
          onValueChange={(v) => setActiveFilter(v as "all" | "active" | "inactive")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Player Cards */}
      <div className="space-y-4">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                    <div className="h-5 w-36 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-44 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}

        {!loading &&
          filtered.map((player) => (
            <Card
              key={player.id}
              className={cn(
                "shadow-sm hover:shadow-md transition-shadow",
                !player.active && "opacity-60"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{player.name}</CardTitle>
                      <Badge
                        variant="secondary"
                        className={SEGMENT_COLORS[player.segment].badge}
                      >
                        {SEGMENT_LABELS[player.segment]}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          player.commitment === "permanent"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-gray-100 text-gray-700"
                        }
                      >
                        {COMMITMENT_LABELS[player.commitment]}
                      </Badge>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                          player.active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            player.active ? "bg-green-500" : "bg-red-500"
                          )}
                        />
                        {player.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog
                      open={editingPlayer?.id === player.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setEditingPlayer(player);
                          setEditSegment(player.segment);
                          setEditCommitment(player.commitment);
                          setEditActive(player.active);
                          setEditPlayDay(player.play_day != null ? String(player.play_day) : "");
                          setEditLocationPreference(player.location_preference ?? "");
                          setEditMaritalStatus(player.marital_status ?? "");
                        } else {
                          setEditingPlayer(null);
                        }
                      }}
                    >
                      <DialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                          Edit
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Player</DialogTitle>
                        </DialogHeader>
                        <PlayerForm
                          onSubmit={handleUpdatePlayer}
                          defaultValues={player}
                          segment={editSegment}
                          setSegment={setEditSegment}
                          commitment={editCommitment}
                          setCommitment={setEditCommitment}
                          active={editActive}
                          setActive={setEditActive}
                          playDay={editPlayDay}
                          setPlayDay={setEditPlayDay}
                          locationPreference={editLocationPreference}
                          setLocationPreference={setEditLocationPreference}
                          maritalStatus={editMaritalStatus}
                          setMaritalStatus={setEditMaritalStatus}
                          locations={locations}
                          submitLabel="Update"
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePlayer(player)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1.5">
                  {player.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{player.phone}</span>
                    </div>
                  )}
                  {player.phone2 && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{player.phone2}</span>
                    </div>
                  )}
                  {player.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{player.email}</span>
                    </div>
                  )}
                  {player.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{player.address}</span>
                    </div>
                  )}
                  {player.location_preference && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{player.location_preference}</span>
                    </div>
                  )}
                  {player.commitment === "permanent" && (player.play_day != null || player.play_time) && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {player.play_day != null ? DAY_NAMES[player.play_day] : ""}
                        {player.play_day != null && player.play_time ? " " : ""}
                        {player.play_time ?? ""}
                      </span>
                    </div>
                  )}
                  {(player.segment === "girls" || player.segment === "teens") && player.school && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">School: {player.school}</span>
                    </div>
                  )}
                  {player.age != null && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">Age: {player.age}</span>
                    </div>
                  )}
                  {player.segment === "women" && player.marital_status && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{player.marital_status}</span>
                    </div>
                  )}
                  {player.emergency_contact && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Emergency: {player.emergency_contact}</span>
                    </div>
                  )}
                  {player.notes && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <StickyNote className="w-3.5 h-3.5 mt-0.5" />
                      <span className="italic">{player.notes}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

        {!loading && filtered.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">
                {search || segmentFilter !== "all" || activeFilter !== "all"
                  ? "No players match your search."
                  : "No players yet. Add one to get started."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
