"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, Plus } from "lucide-react";
import type { Announcement, Segment } from "@/types/database";
import { SEGMENT_LABELS, SEGMENT_COLORS } from "@/types/database";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<string>("all");
  const [sendSms, setSendSms] = useState(false);
  const [smsPlayerCount, setSmsPlayerCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  async function loadAnnouncements() {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setAnnouncements((data as Announcement[]) ?? []);
  }

  useEffect(() => {
    loadAnnouncements().then(() => setLoading(false));
  }, []);

  // Fetch SMS player count when SMS toggle or segment changes
  useEffect(() => {
    if (!sendSms) {
      setSmsPlayerCount(null);
      return;
    }

    let cancelled = false;
    setLoadingCount(true);

    async function fetchCount() {
      let query = supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .not("phone", "is", null);

      if (segment !== "all") {
        query = query.eq("segment", segment as Segment);
      }

      const { count } = await query;
      if (!cancelled) {
        setSmsPlayerCount(count ?? 0);
        setLoadingCount(false);
      }
    }

    fetchCount();
    return () => { cancelled = true; };
  }, [sendSms, segment]);

  function resetForm() {
    setTitle("");
    setBody("");
    setSegment("all");
    setSendSms(false);
    setSmsPlayerCount(null);
  }

  function handleOpenDialog() {
    resetForm();
    setShowDialog(true);
  }

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          segment: segment !== "all" ? segment : undefined,
          sendSms,
        }),
      });

      if (res.ok) {
        setShowDialog(false);
        setShowConfirm(false);
        resetForm();
        await loadAnnouncements();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSendClick() {
    if (sendSms && smsPlayerCount && smsPlayerCount > 0) {
      setShowConfirm(true);
    } else {
      handleSubmit();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Announcements</h2>
          <p className="text-muted-foreground mt-1">
            Blast messages to players by segment
          </p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {/* Announcement list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="pt-5 space-y-2">
                <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
            <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No announcements yet</p>
            <p className="text-sm mt-1">Create your first announcement above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {announcements.map((a) => {
            const segmentColors = a.segment ? SEGMENT_COLORS[a.segment] : null;
            return (
              <Card key={a.id} className="shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-base leading-tight">{a.title}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {a.segment && segmentColors ? (
                        <Badge className={`${segmentColors.badge} text-xs`}>
                          {SEGMENT_LABELS[a.segment]}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          All Players
                        </Badge>
                      )}
                      {a.sent_via_sms && (
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                          SMS Sent
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.body}</p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {formatRelativeTime(a.created_at)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Announcement Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) setShowDialog(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Game cancelled this Sunday"
                required
              />
            </div>
            <div>
              <Label htmlFor="ann-body">Message</Label>
              <Textarea
                id="ann-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your announcement here..."
                rows={4}
                required
              />
            </div>
            <div>
              <Label htmlFor="ann-segment">Segment</Label>
              <Select value={segment} onValueChange={(v) => setSegment(v)}>
                <SelectTrigger id="ann-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Players</SelectItem>
                  {(Object.entries(SEGMENT_LABELS) as [Segment, string][]).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Also send via SMS</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sends a text message to matching active players with a phone number
                </p>
              </div>
              <Switch checked={sendSms} onCheckedChange={setSendSms} />
            </div>
            {sendSms && (
              <div className="rounded-md bg-purple-50 text-purple-800 px-3 py-2 text-sm">
                {loadingCount ? (
                  "Counting players..."
                ) : (
                  <>
                    This will reach{" "}
                    <span className="font-semibold">{smsPlayerCount ?? 0} player{smsPlayerCount !== 1 ? "s" : ""}</span>
                    {segment !== "all" && ` in ${SEGMENT_LABELS[segment as Segment]}`}
                  </>
                )}
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleSendClick}
              disabled={submitting || !title.trim() || !body.trim()}
            >
              {submitting ? "Sending..." : "Send Announcement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={(open) => { if (!open) setShowConfirm(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm SMS Blast</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure? This will send an SMS to{" "}
              <span className="font-semibold text-foreground">{smsPlayerCount} player{smsPlayerCount !== 1 ? "s" : ""}</span>
              {segment !== "all" && ` in ${SEGMENT_LABELS[segment as Segment]}`}.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Yes, Send"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
