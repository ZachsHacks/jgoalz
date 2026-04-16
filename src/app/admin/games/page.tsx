"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import Link from "next/link";
import {
  Plus,
  Pencil,
  ArrowRight,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Game, Segment, Sport } from "@/types/database";
import {
  DAY_NAMES,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
} from "@/types/database";

type GameWithRosterCount = Game & { roster_count: number };

export default function GamesPage() {
  const [games, setGames] = useState<GameWithRosterCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [filterSegment, setFilterSegment] = useState<string>("all");
  const [filterSport, setFilterSport] = useState<string>("all");
  const [formSegment, setFormSegment] = useState<string>("women");
  const [editFormSegment, setEditFormSegment] = useState<string>("women");
  const [formRequiresTransport, setFormRequiresTransport] = useState(false);
  const [editFormRequiresTransport, setEditFormRequiresTransport] = useState(false);

  async function loadGames() {
    const { data } = await supabase
      .from("games")
      .select("*, game_players(id)")
      .eq("archived", false)
      .order("day_of_week", { ascending: true });

    const mapped = (data ?? []).map((g) => ({
      ...g,
      game_players: undefined,
      roster_count: Array.isArray(g.game_players)
        ? g.game_players.length
        : 0,
    })) as GameWithRosterCount[];
    setGames(mapped);
    setLoading(false);
  }

  useEffect(() => {
    loadGames();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const segment = form.get("segment") as Segment;
    await supabase.from("games").insert({
      name: form.get("name") as string,
      sport: form.get("sport") as Sport,
      segment,
      day_of_week: Number(form.get("day_of_week")),
      time: form.get("time") as string,
      location: form.get("location") as string,
      capacity: Number(form.get("capacity")) || 12,
      price_per_player: Number(form.get("price_per_player")) || 0,
      transport_fee: segment === "girls" && formRequiresTransport ? (Number(form.get("transport_fee")) || null) : null,
      requires_transport: segment === "girls" ? formRequiresTransport : false,
      active: true,
    });
    setShowCreate(false);
    setFormSegment("women");
    setFormRequiresTransport(false);
    loadGames();
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingGame) return;
    const form = new FormData(e.currentTarget);
    const segment = form.get("segment") as Segment;
    await supabase
      .from("games")
      .update({
        name: form.get("name") as string,
        sport: form.get("sport") as Sport,
        segment,
        day_of_week: Number(form.get("day_of_week")),
        time: form.get("time") as string,
        location: form.get("location") as string,
        capacity: Number(form.get("capacity")) || 12,
        price_per_player: Number(form.get("price_per_player")) || 0,
        transport_fee: segment === "girls" && editFormRequiresTransport ? (Number(form.get("transport_fee")) || null) : null,
        requires_transport: segment === "girls" ? editFormRequiresTransport : false,
      })
      .eq("id", editingGame.id);
    setEditingGame(null);
    setEditFormSegment("women");
    setEditFormRequiresTransport(false);
    loadGames();
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await supabase.from("games").update({ active: !currentActive }).eq("id", id);
    loadGames();
  }

  async function handleDelete(game: Game) {
    const [sessionsRes, rosterRes] = await Promise.all([
      supabase.from("sessions").select("id", { count: "exact", head: true }).eq("game_id", game.id),
      supabase.from("game_players").select("id", { count: "exact", head: true }).eq("game_id", game.id),
    ]);
    const hasSessions = (sessionsRes.count ?? 0) > 0;
    const hasRoster = (rosterRes.count ?? 0) > 0;

    if (!hasSessions && !hasRoster) {
      if (!confirm(`Permanently delete "${game.name}"? This cannot be undone.`)) return;
      await supabase.from("games").delete().eq("id", game.id);
    } else {
      const detail = [hasSessions ? "session history" : "", hasRoster ? "players on its roster" : ""]
        .filter(Boolean)
        .join(" and ");
      if (!confirm(`"${game.name}" has ${detail}. It will be hidden from the Games page but preserved for historical records. Continue?`)) return;
      await supabase.from("games").update({ archived: true }).eq("id", game.id);
    }
    loadGames();
  }

  const sportBadgeColor = (sport: Sport) => {
    return sport === "soccer"
      ? "bg-green-100 text-green-800"
      : "bg-orange-100 text-orange-800";
  };

  function GameForm({
    onSubmit,
    defaults,
    submitLabel,
    currentSegment,
    onSegmentChange,
    requiresTransport,
    onRequiresTransportChange,
  }: {
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    defaults?: Game;
    submitLabel: string;
    currentSegment: string;
    onSegmentChange: (val: string) => void;
    requiresTransport: boolean;
    onRequiresTransportChange: (val: boolean) => void;
  }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Game Name</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={defaults?.name ?? ""}
            placeholder="e.g. Women's Sunday Soccer"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sport">Sport</Label>
            <Select name="sport" defaultValue={defaults?.sport ?? "soccer"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soccer">Soccer</SelectItem>
                <SelectItem value="basketball">Basketball</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="segment">Segment</Label>
            <Select
              name="segment"
              defaultValue={defaults?.segment ?? "women"}
              onValueChange={(v) => v !== null && onSegmentChange(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="women">Women (18+)</SelectItem>
                <SelectItem value="teens">Teen Girls (Ages 14-17)</SelectItem>
                <SelectItem value="girls">Girls (Ages 13 and under)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="day_of_week">Day of Week</Label>
            <Select
              name="day_of_week"
              defaultValue={String(defaults?.day_of_week ?? 0)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((day, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              name="time"
              required
              defaultValue={defaults?.time ?? ""}
              placeholder="e.g. 7:00 PM - 8:30 PM"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            required
            defaultValue={defaults?.location ?? ""}
            placeholder="e.g. 14B 53rd Street"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={defaults?.capacity ?? 12}
            />
          </div>
          <div>
            <Label htmlFor="price_per_player">Price per Player ($)</Label>
            <Input
              id="price_per_player"
              name="price_per_player"
              type="number"
              min={0}
              step="0.01"
              defaultValue={defaults?.price_per_player ?? ""}
              placeholder="0.00"
            />
          </div>
        </div>
        {currentSegment === "girls" && (
          <>
            <div className="flex items-center gap-3">
              <Checkbox
                id="requires_transport"
                checked={requiresTransport}
                onCheckedChange={(checked) => onRequiresTransportChange(!!checked)}
              />
              <Label htmlFor="requires_transport" className="cursor-pointer">
                This game involves transportation
              </Label>
            </div>
            {requiresTransport && (
              <div>
                <Label htmlFor="transport_fee">Transport Fee ($, optional)</Label>
                <Input
                  id="transport_fee"
                  name="transport_fee"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={defaults?.transport_fee ?? ""}
                  placeholder="0.00"
                />
              </div>
            )}
          </>
        )}
        <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
          {submitLabel}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Games</h2>
          <p className="text-muted-foreground mt-1">
            Manage recurring weekly game templates
          </p>
        </div>
        <Dialog
          open={showCreate}
          onOpenChange={(open) => {
            setShowCreate(open);
            if (!open) {
              setFormSegment("women");
              setFormRequiresTransport(false);
            }
          }}
        >
          <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "default" }), "bg-purple-600 hover:bg-purple-700")}>
              <Plus className="w-4 h-4 mr-2" />
              Create Game
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Game</DialogTitle>
            </DialogHeader>
            <GameForm
              onSubmit={handleCreate}
              submitLabel="Create"
              currentSegment={formSegment}
              onSegmentChange={setFormSegment}
              requiresTransport={formRequiresTransport}
              onRequiresTransportChange={setFormRequiresTransport}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block mb-1 font-medium text-sm">Segment</label>
          <Select value={filterSegment} onValueChange={(v) => v !== null && setFilterSegment(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="women">Women (18+)</SelectItem>
              <SelectItem value="teens">Teen Girls (Ages 14-17)</SelectItem>
              <SelectItem value="girls">Girls (Ages 13 and under)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block mb-1 font-medium text-sm">Sport</label>
          <Select value={filterSport} onValueChange={(v) => v !== null && setFilterSport(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              <SelectItem value="soccer">Soccer</SelectItem>
              <SelectItem value="basketball">Basketball</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={!!editingGame}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGame(null);
            setEditFormSegment("women");
            setEditFormRequiresTransport(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Game</DialogTitle>
          </DialogHeader>
          {editingGame && (
            <GameForm
              onSubmit={handleEdit}
              defaults={editingGame}
              submitLabel="Save Changes"
              currentSegment={editFormSegment}
              onSegmentChange={setEditFormSegment}
              requiresTransport={editFormRequiresTransport}
              onRequiresTransportChange={setEditFormRequiresTransport}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-48 bg-muted rounded animate-pulse" />
                  <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-56 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        {!loading &&
          games
            .filter((g) => filterSegment === "all" || g.segment === filterSegment)
            .filter((g) => filterSport === "all" || g.sport === filterSport)
            .map((game) => {
              const segColors = SEGMENT_COLORS[game.segment];
              return (
                <Card
                  key={game.id}
                  className={`shadow-sm hover:shadow-md transition-shadow ${!game.active ? "opacity-60" : ""}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{game.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={`${sportBadgeColor(game.sport)} border-0`}>
                          {game.sport}
                        </Badge>
                        <Badge className={`${segColors.badge} border-0`}>
                          {game.segment}
                        </Badge>
                        {!game.active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground space-y-1.5 mb-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {DAY_NAMES[game.day_of_week]}s, {game.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{game.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          {game.roster_count} / {game.capacity} spots
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>
                          ${Number(game.price_per_player).toFixed(2)} / player
                          {game.transport_fee != null &&
                            ` + $${Number(game.transport_fee).toFixed(2)} transport`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingGame(game);
                          setEditFormSegment(game.segment);
                          setEditFormRequiresTransport(game.requires_transport ?? false);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleActive(game.id, game.active)}
                      >
                        {game.active ? (
                          <>
                            <PowerOff className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Power className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                            Activate
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(game)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Delete
                      </Button>
                      <Link href={`/admin/games/${game.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                          View Roster
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        {!loading && games.length === 0 && (
          <Card className="shadow-sm col-span-full">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">
                No games yet. Create one to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
