"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  UserRound,
  Truck,
  DollarSign,
  CalendarDays,
  ArrowRight,
  MapPin,
  Clock,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type { SessionWithGame } from "@/types/database";
import { SEGMENT_COLORS, DAY_NAMES } from "@/types/database";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalPlayers: 0,
    totalDrivers: 0,
    pendingPayments: 0,
    pendingAmount: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  function getBaseUrl() {
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }

  async function copyLink(path: string) {
    const url = `${getBaseUrl()}${path}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(path);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  useEffect(() => {
    async function loadDashboard() {
      const [players, drivers, payments, sessions] = await Promise.all([
        supabase.from("players").select("id", { count: "exact", head: true }),
        supabase.from("drivers").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount").eq("status", "pending"),
        supabase
          .from("sessions")
          .select("*, game:games(*)")
          .in("status", ["upcoming", "in_progress"])
          .order("date", { ascending: true })
          .limit(5),
      ]);

      const pendingPayments = payments.data ?? [];
      setStats({
        totalPlayers: players.count ?? 0,
        totalDrivers: drivers.count ?? 0,
        pendingPayments: pendingPayments.length,
        pendingAmount: pendingPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0
        ),
      });

      setUpcomingSessions((sessions.data as SessionWithGame[]) ?? []);
      setLoading(false);
    }
    loadDashboard();
  }, []);

  const statCards = [
    {
      label: "Players",
      value: stats.totalPlayers,
      icon: UserRound,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Drivers",
      value: stats.totalDrivers,
      icon: Truck,
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      label: "Unpaid",
      value: `$${stats.pendingAmount.toFixed(0)}`,
      subtitle: `${stats.pendingPayments} pending`,
      icon: DollarSign,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Upcoming",
      value: upcomingSessions.length,
      subtitle: "sessions",
      icon: CalendarDays,
      color: "text-pink-600",
      bg: "bg-pink-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground mt-1">
          Welcome back. Here&apos;s what&apos;s happening with Jgoalz Sports.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                      <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="w-12 h-12 bg-muted rounded-xl animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))
          : statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="text-3xl font-bold mt-1">{stat.value}</p>
                        {stat.subtitle && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {stat.subtitle}
                          </p>
                        )}
                      </div>
                      <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                        <Icon className="w-6 h-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Quick Links */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Player Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Player Portal</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Announcements, reviews, schedule</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyLink("/portal")} title="Copy link">
                    {copiedLink === "/portal" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Link href="/portal" target="_blank" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Registration Form</p>
                  <p className="text-xs text-muted-foreground mt-0.5">New player signup + waiver</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyLink("/join")} title="Copy link">
                    {copiedLink === "/join" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Link href="/join" target="_blank" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Calendar</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Check-in + claim spots</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyLink("/calendar")} title="Copy link">
                    {copiedLink === "/calendar" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Link href="/calendar" target="_blank" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upcoming sessions */}
      {upcomingSessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Upcoming Sessions</h3>
          {upcomingSessions.map((session) => {
            const game = session.game;
            const segColors = SEGMENT_COLORS[game.segment];
            return (
              <Card key={session.id} className="shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{game.name}</h3>
                      <div className="flex items-center gap-4 mt-1.5 text-purple-100 text-sm">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {new Date(session.date + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {game.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {game.location}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${segColors.badge} border-0`}>
                        {game.segment}
                      </Badge>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{session.spots_remaining}</p>
                        <p className="text-xs text-purple-200">spots left</p>
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={session.status === "upcoming" ? "default" : "secondary"}>
                      {session.status}
                    </Badge>
                    <Link href={`/admin/sessions/${session.id}`} className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
                        Manage
                        <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && upcomingSessions.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No upcoming sessions
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Create games first, then generate this week&apos;s sessions.
            </p>
            <Link href="/admin/games" className={cn(buttonVariants({ variant: "default", size: "default" }), "mt-4")}>Set Up Games</Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
