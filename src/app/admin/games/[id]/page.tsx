"use client";

import { use, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  UserMinus,
  Pause,
  Play,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Search,
} from "lucide-react";
import type { Game, Player, GamePlayerWithPlayer } from "@/types/database";
import {
  DAY_NAMES,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
} from "@/types/database";

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [game, setGame] = useState<Game | null>(null);
  const [roster, setRoster] = useState<GamePlayerWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadGame = useCallback(async () => {
    const { data } = await supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .single();
    setGame(data as Game | null);
  }, [id]);

  const loadRoster = useCallback(async () => {
    const { data } = await supabase
      .from("game_players")
      .select("*, player:players(*)")
      .eq("game_id", id)
      .order("joined_at", { ascending: true });

    setRoster((data as GamePlayerWithPlayer[]) ?? []);
  }, [id]);

  useEffect(() => {
    async function init() {
      await Promise.all([loadGame(), loadRoster()]);
      setLoading(false);
    }
    init();
  }, [loadGame, loadRoster]);

  async function searchPlayers(query: string) {
    setSearchQuery(query);
    if (!game) return;

    setSearchLoading(true);

    // Get IDs of players already on this roster
    const existingIds = roster.map((gp) => gp.player_id);

    let q = supabase
      .from("players")
      .select("*")
      .eq("segment", game.segment)
      .order("name", { ascending: true });

    if (query.trim()) {
      q = q.ilike("name", `%${query.trim()}%`);
    }

    const { data } = await q;

    // Filter out players already on the roster
    setAvailablePlayers(
      (data ?? []).filter((p) => !existingIds.includes(p.id))
    );
    setSearchLoading(false);
  }

  async function addPlayer(playerId: string) {
    await supabase.from("game_players").insert({
      game_id: id,
      player_id: playerId,
      status: "active",
    });
    await loadRoster();
    // Refresh available players list
    searchPlayers(searchQuery);
  }

  async function dropPlayer(gamePlayerId: string) {
    if (!confirm("Drop this player from the roster?")) return;
    await supabase
      .from("game_players")
      .update({ status: "dropped" })
      .eq("id", gamePlayerId);
    loadRoster();
  }

  async function togglePlayerStatus(gamePlayerId: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await supabase
      .from("game_players")
      .update({ status: newStatus })
      .eq("id", gamePlayerId);
    loadRoster();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">Game not found.</p>
        <Link href="/admin/games" className={cn(buttonVariants({ variant: "default", size: "default" }), "mt-4")}>Back to Games</Link>
      </div>
    );
  }

  const segColors = SEGMENT_COLORS[game.segment];
  const activeCount = roster.filter(
    (gp) => gp.status === "active"
  ).length;

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default" as const;
      case "paused":
        return "secondary" as const;
      case "dropped":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin/games" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Games
      </Link>

      {/* Game info header */}
      <Card className="shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{game.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-purple-100 text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {DAY_NAMES[game.day_of_week]}s, {game.time}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {game.location}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  ${Number(game.price_per_player).toFixed(2)} / player
                  {game.transport_fee != null &&
                    ` + $${Number(game.transport_fee).toFixed(2)} transport`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`${segColors.badge} border-0`}>
                {SEGMENT_LABELS[game.segment]}
              </Badge>
              {!game.active && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Capacity indicator */}
      <Card className="shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-lg">
                {activeCount} / {game.capacity} permanent spots filled
              </span>
            </div>
            <div className="w-48 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (activeCount / game.capacity) * 100)}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roster management */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Permanent Roster</CardTitle>
            <Dialog
              open={showAddPlayer}
              onOpenChange={(open) => {
                setShowAddPlayer(open);
                if (open) {
                  setSearchQuery("");
                  searchPlayers("");
                }
              }}
            >
              <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "sm" }), "bg-purple-600 hover:bg-purple-700")}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Player
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Add Player to {game.name}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Showing {SEGMENT_LABELS[game.segment]} players not already on this roster.
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => searchPlayers(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {searchLoading && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Searching...
                    </p>
                  )}
                  {!searchLoading && availablePlayers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No matching players found.
                    </p>
                  )}
                  {!searchLoading &&
                    availablePlayers.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{player.name}</p>
                          {player.phone && (
                            <p className="text-sm text-muted-foreground">
                              {player.phone}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                          onClick={() => addPlayer(player.id)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                No players on the roster yet. Add players to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster
                  .filter((gp) => gp.status !== "dropped")
                  .map((gp) => (
                    <TableRow key={gp.id}>
                      <TableCell className="font-medium">
                        {gp.player.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {gp.player.phone ?? "--"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(gp.status)}>
                          {gp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(gp.joined_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              togglePlayerStatus(gp.id, gp.status)
                            }
                            title={
                              gp.status === "active"
                                ? "Pause player"
                                : "Reactivate player"
                            }
                          >
                            {gp.status === "active" ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dropPlayer(gp.id)}
                            title="Drop player"
                          >
                            <UserMinus className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                {roster.filter((gp) => gp.status === "dropped").length > 0 && (
                  <>
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-6"
                      >
                        Dropped Players
                      </TableCell>
                    </TableRow>
                    {roster
                      .filter((gp) => gp.status === "dropped")
                      .map((gp) => (
                        <TableRow key={gp.id} className="opacity-50">
                          <TableCell className="font-medium">
                            {gp.player.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {gp.player.phone ?? "--"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">dropped</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(gp.joined_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
