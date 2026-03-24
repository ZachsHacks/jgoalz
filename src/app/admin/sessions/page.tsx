"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CalendarDays,
  Clock,
  MapPin,
  Users,
  ArrowRight,
  Zap,
  Loader2,
} from "lucide-react";
import type { SessionWithGame, Segment, SessionStatus } from "@/types/database";
import { SEGMENT_COLORS, SEGMENT_LABELS } from "@/types/database";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSegment, setFilterSegment] = useState<string>("all");

  async function loadSessions() {
    const { data } = await supabase
      .from("sessions")
      .select("*, game:games(*)")
      .order("date", { ascending: true });

    setSessions((data as SessionWithGame[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function generateSessions() {
    setGenerating(true);
    try {
      const res = await fetch("/api/sessions/generate", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        const count = result.sessions?.length ?? 0;
        if (count === 0) {
          alert("All sessions for this week already exist.");
        } else {
          alert(`Generated ${count} new session(s)!`);
        }
        loadSessions();
      } else {
        alert("Error generating sessions: " + (result.error ?? "Unknown"));
      }
    } catch {
      alert("Failed to generate sessions.");
    }
    setGenerating(false);
  }

  async function updateStatus(id: string, status: SessionStatus) {
    await supabase.from("sessions").update({ status }).eq("id", id);
    loadSessions();
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "default" as const;
      case "in_progress":
        return "secondary" as const;
      case "completed":
        return "outline" as const;
      case "cancelled":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const filtered = sessions
    .filter((s) => filterStatus === "all" || s.status === filterStatus)
    .filter((s) => filterSegment === "all" || s.game?.segment === filterSegment);

  // Group by date
  const grouped = filtered.reduce<Record<string, SessionWithGame[]>>((acc, s) => {
    const key = s.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sessions</h2>
          <p className="text-muted-foreground mt-1">
            Weekly game instances with rosters and payments
          </p>
        </div>
        <Button onClick={generateSessions} disabled={generating}>
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          Generate This Week&apos;s Sessions
        </Button>
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block mb-1 font-medium text-sm">Status</label>
          <Select value={filterStatus} onValueChange={(v) => v !== null && setFilterStatus(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block mb-1 font-medium text-sm">Segment</label>
          <Select value={filterSegment} onValueChange={(v) => v !== null && setFilterSegment(v)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="women">{SEGMENT_LABELS.women}</SelectItem>
              <SelectItem value="teens">{SEGMENT_LABELS.teens}</SelectItem>
              <SelectItem value="girls">{SEGMENT_LABELS.girls}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
                  <div className="h-5 w-48 bg-muted rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-56 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && sortedDates.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No sessions yet
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Click &quot;Generate This Week&apos;s Sessions&quot; to create sessions from your active games.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading &&
        sortedDates.map((dateStr) => {
          const dateSessions = grouped[dateStr];
          const dateLabel = new Date(dateStr + "T00:00:00").toLocaleDateString(
            "en-US",
            { weekday: "long", month: "long", day: "numeric", year: "numeric" }
          );
          return (
            <div key={dateStr} className="space-y-3">
              <h3 className="text-lg font-semibold text-purple-700 flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                {dateLabel}
              </h3>
              {dateSessions.map((session) => {
                const game = session.game;
                if (!game) return null;
                const segColors = SEGMENT_COLORS[game.segment as Segment];
                return (
                  <Card
                    key={session.id}
                    className="shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <CalendarDays className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{game.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {game.sport.charAt(0).toUpperCase() + game.sport.slice(1)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${segColors.badge} border-0`}>
                            {SEGMENT_LABELS[game.segment as Segment]}
                          </Badge>
                          <Badge variant={statusColor(session.status)}>
                            {session.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground space-y-1.5 mb-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{game.time}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{game.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          <span>
                            {session.spots_remaining} spots remaining / {game.capacity} capacity
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {session.status === "upcoming" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => updateStatus(session.id, "in_progress")}
                            >
                              Start Session
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm("Cancel this session?")) {
                                  updateStatus(session.id, "cancelled");
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
                            onClick={() => updateStatus(session.id, "completed")}
                          >
                            Complete Session
                          </Button>
                        )}
                        <Link href={`/admin/sessions/${session.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                            View Details
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}
