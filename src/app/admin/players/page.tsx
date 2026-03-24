"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import type { Player, Segment } from "@/types/database";
import { SEGMENT_LABELS, SEGMENT_COLORS } from "@/types/database";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<Segment | "all">("all");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [addSegment, setAddSegment] = useState<Segment>("women");
  const [editSegment, setEditSegment] = useState<Segment>("women");

  async function loadPlayers() {
    const { data } = await supabase
      .from("players")
      .select("*")
      .order("name");
    setPlayers((data as Player[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  const filtered = players.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone?.includes(search) ?? false);
    const matchesSegment =
      segmentFilter === "all" || p.segment === segmentFilter;
    return matchesSearch && matchesSegment;
  });

  async function handleAddPlayer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await supabase.from("players").insert({
      name: form.get("name") as string,
      phone: (form.get("phone") as string) || null,
      email: (form.get("email") as string) || null,
      address: (form.get("address") as string) || null,
      segment: addSegment,
      emergency_contact: (form.get("emergency_contact") as string) || null,
      notes: (form.get("notes") as string) || null,
    });
    setShowAddPlayer(false);
    setAddSegment("women");
    loadPlayers();
  }

  async function handleUpdatePlayer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPlayer) return;
    const form = new FormData(e.currentTarget);
    await supabase
      .from("players")
      .update({
        name: form.get("name") as string,
        phone: (form.get("phone") as string) || null,
        email: (form.get("email") as string) || null,
        address: (form.get("address") as string) || null,
        segment: editSegment,
        emergency_contact: (form.get("emergency_contact") as string) || null,
        notes: (form.get("notes") as string) || null,
      })
      .eq("id", editingPlayer.id);
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

  function PlayerForm({
    onSubmit,
    defaultValues,
    segment,
    setSegment,
    submitLabel,
  }: {
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    defaultValues?: Player;
    segment: Segment;
    setSegment: (s: Segment) => void;
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
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={defaultValues?.phone ?? ""}
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
        <div>
          <Label htmlFor="emergency_contact">Emergency Contact</Label>
          <Input
            id="emergency_contact"
            name="emergency_contact"
            defaultValue={defaultValues?.emergency_contact ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={defaultValues?.notes ?? ""}
          />
        </div>
        <Button type="submit" className="w-full">
          {submitLabel}
        </Button>
      </form>
    );
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
          if (!open) setAddSegment("women");
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
              submitLabel="Save"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
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
              className="shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{player.name}</CardTitle>
                      <Badge
                        variant="secondary"
                        className={SEGMENT_COLORS[player.segment].badge}
                      >
                        {SEGMENT_LABELS[player.segment]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog
                      open={editingPlayer?.id === player.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setEditingPlayer(player);
                          setEditSegment(player.segment);
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
                {search || segmentFilter !== "all"
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
