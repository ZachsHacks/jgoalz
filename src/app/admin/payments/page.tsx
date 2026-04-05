"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  TrendingUp,
  AlertCircle,
  Users,
  Check,
  Pencil,
  MessageSquare,
} from "lucide-react";
import type { PaymentWithDetails, Segment } from "@/types/database";
import { SEGMENT_LABELS } from "@/types/database";

const DEFAULT_REMINDER_TEMPLATE = (name: string, amount: string) =>
  `Hi ${name}, friendly reminder about your $${amount} balance for Jgoalz. Please send payment via Zelle. Thank you!`;

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSegment, setFilterSegment] = useState<string>("all");
  const [editingPayment, setEditingPayment] = useState<PaymentWithDetails | null>(null);
  const [showBulkReminder, setShowBulkReminder] = useState(false);
  const [bulkReminderQueue, setBulkReminderQueue] = useState<PaymentWithDetails[]>([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSentCount, setBulkSentCount] = useState(0);

  async function loadPayments() {
    const { data } = await supabase
      .from("payments")
      .select("*, player:players(*), session:sessions(*, game:games(*))")
      .order("created_at", { ascending: false });
    setPayments((data as PaymentWithDetails[]) ?? []);
  }

  useEffect(() => {
    loadPayments().then(() => setLoading(false));
  }, []);

  async function markPaid(paymentId: string) {
    await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", paymentId);
    loadPayments();
  }

  async function markReminded(paymentId: string) {
    await supabase
      .from("payments")
      .update({ status: "reminded", reminded_at: new Date().toISOString() })
      .eq("id", paymentId);
    loadPayments();
  }

  async function handleEditPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPayment) return;
    const form = new FormData(e.currentTarget);
    await supabase
      .from("payments")
      .update({
        amount: Number(form.get("amount")),
        notes: (form.get("notes") as string) || null,
      })
      .eq("id", editingPayment.id);
    setEditingPayment(null);
    loadPayments();
  }

  function sendSmsReminder(payment: PaymentWithDetails) {
    const phone = payment.player.phone?.replace(/\D/g, "") ?? "";
    const name = payment.player.name.split(" ")[0];
    const amount = Number(payment.amount).toFixed(0);
    const msg = DEFAULT_REMINDER_TEMPLATE(name, amount);
    window.open(`sms:+1${phone}?body=${encodeURIComponent(msg)}`, "_blank");
    markReminded(payment.id);
  }

  function openBulkReminder() {
    const unpaid = filtered.filter((p) => p.status !== "paid");
    if (unpaid.length === 0) return;
    // Deduplicate by player
    const seen = new Set<string>();
    const unique: PaymentWithDetails[] = [];
    for (const p of unpaid) {
      if (!seen.has(p.player_id)) {
        seen.add(p.player_id);
        unique.push(p);
      }
    }
    setBulkReminderQueue(unique);
    setBulkSentCount(0);
    setBulkSending(false);
    setShowBulkReminder(true);
  }

  function sendNextBulkReminder(idx: number) {
    if (idx >= bulkReminderQueue.length) {
      setBulkSending(false);
      return;
    }
    setBulkSending(true);
    setBulkSentCount(idx);
    const p = bulkReminderQueue[idx];
    const phone = p.player.phone?.replace(/\D/g, "") ?? "";
    const name = p.player.name.split(" ")[0];
    const amount = Number(p.amount).toFixed(0);
    const msg = DEFAULT_REMINDER_TEMPLATE(name, amount);
    window.open(`sms:+1${phone}?body=${encodeURIComponent(msg)}`, "_blank");
  }

  async function confirmSent(idx: number) {
    const p = bulkReminderQueue[idx];
    await supabase
      .from("payments")
      .update({ status: "reminded", reminded_at: new Date().toISOString() })
      .eq("id", p.id);
    const next = idx + 1;
    if (next >= bulkReminderQueue.length) {
      setBulkSending(false);
      setBulkSentCount(next);
      loadPayments();
    } else {
      sendNextBulkReminder(next);
    }
  }

  // Collect unique months from data
  const monthOptions = [...new Set(payments.map((p) => p.month).filter(Boolean))]
    .sort()
    .reverse() as string[];

  const filtered = payments.filter((p) => {
    if (filterMonth !== "all" && p.month !== filterMonth) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterSegment !== "all" && p.session?.game?.segment !== filterSegment) return false;
    return true;
  });

  const totalPending = filtered
    .filter((p) => p.status !== "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = filtered
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Payments</h2>
        <p className="text-muted-foreground mt-1">
          Track and manage player payments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="w-12 h-12 bg-muted rounded-xl animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Collected</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                      ${totalPaid.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">
                      ${totalPending.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Records</p>
                    <p className="text-3xl font-bold mt-1">{filtered.length}</p>
                  </div>
                  <div className="bg-purple-50 text-purple-600 p-3 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block mb-1 font-medium text-sm">Month</label>
          <Select value={filterMonth} onValueChange={(v) => v !== null && setFilterMonth(v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(m + "-01T00:00:00").toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block mb-1 font-medium text-sm">Status</label>
          <Select value={filterStatus} onValueChange={(v) => v !== null && setFilterStatus(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reminded">Reminded</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
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
              {(Object.entries(SEGMENT_LABELS) as [Segment, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtered.some((p) => p.status !== "paid") && (
          <Button variant="outline" onClick={openBulkReminder}>
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Bulk Remind
          </Button>
        )}
      </div>

      {/* Bulk Reminder Dialog */}
      <Dialog
        open={showBulkReminder}
        onOpenChange={(open) => {
          if (!open) {
            setShowBulkReminder(false);
            setBulkSending(false);
            loadPayments();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Payment Reminders</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will open your SMS app for each unpaid player one at a time
              with a pre-filled reminder message.
            </p>
            <div className="text-sm">
              <span className="font-medium">{bulkReminderQueue.length}</span>{" "}
              unpaid players to remind
              {bulkSending && bulkSentCount < bulkReminderQueue.length && (
                <span className="ml-2 text-muted-foreground">
                  ({bulkSentCount + 1} of {bulkReminderQueue.length})
                </span>
              )}
            </div>
            {!bulkSending && bulkSentCount === 0 ? (
              <Button className="w-full" onClick={() => sendNextBulkReminder(0)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Sending ({bulkReminderQueue.length} messages)
              </Button>
            ) : bulkSending && bulkSentCount < bulkReminderQueue.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  SMS opened for{" "}
                  <span className="text-foreground">
                    {bulkReminderQueue[bulkSentCount]?.player.name}
                  </span>{" "}
                  -- send the message, then confirm below.
                </p>
                <Button className="w-full" onClick={() => confirmSent(bulkSentCount)}>
                  <Check className="w-4 h-4 mr-2" />
                  Sent --{" "}
                  {bulkSentCount + 1 < bulkReminderQueue.length
                    ? `Next: ${bulkReminderQueue[bulkSentCount + 1]?.player.name}`
                    : "Finish"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    const p = bulkReminderQueue[bulkSentCount];
                    const phone = p.player.phone?.replace(/\D/g, "") ?? "";
                    const name = p.player.name.split(" ")[0];
                    const amount = Number(p.amount).toFixed(0);
                    const msg = DEFAULT_REMINDER_TEMPLATE(name, amount);
                    window.open(
                      `sms:+1${phone}?body=${encodeURIComponent(msg)}`,
                      "_blank"
                    );
                  }}
                >
                  Re-open SMS
                </Button>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm font-medium text-emerald-600">
                  All reminders sent!
                </p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setShowBulkReminder(false);
                    loadPayments();
                  }}
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog
        open={!!editingPayment}
        onOpenChange={(open) => !open && setEditingPayment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Payment -- {editingPayment?.player.name}
            </DialogTitle>
          </DialogHeader>
          {editingPayment && (
            <form onSubmit={handleEditPayment} className="space-y-4">
              <div>
                <Label htmlFor="edit_amount">Amount ($)</Label>
                <Input
                  id="edit_amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={Number(editingPayment.amount)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_notes">Comments</Label>
                <Input
                  id="edit_notes"
                  name="notes"
                  defaultValue={editingPayment.notes ?? ""}
                  placeholder="e.g. Paid via Zelle"
                />
              </div>
              <Button type="submit" className="w-full">
                Save Changes
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Game</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">
                  {payment.player.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {payment.player.phone ?? "--"}
                </TableCell>
                <TableCell>
                  {payment.session?.game
                    ? payment.session.game.name
                    : "--"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {payment.session
                    ? new Date(
                        payment.session.date + "T00:00:00"
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "--"}
                </TableCell>
                <TableCell className="font-medium">
                  ${Number(payment.amount).toFixed(0)}
                  {payment.notes && (
                    <span className="block text-xs text-muted-foreground font-normal">
                      {payment.notes}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      payment.status === "paid"
                        ? "default"
                        : payment.status === "reminded"
                          ? "secondary"
                          : "destructive"
                    }
                    className={
                      payment.status === "paid"
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        : payment.status === "reminded"
                          ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                          : ""
                    }
                  >
                    {payment.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    {payment.status !== "paid" && (
                      <Button size="sm" onClick={() => markPaid(payment.id)}>
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Paid
                      </Button>
                    )}
                    {payment.status !== "paid" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-purple-600 border-purple-200 hover:bg-purple-50"
                        onClick={() => sendSmsReminder(payment)}
                        title="Send SMS reminder"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingPayment(payment)}
                      title="Edit payment"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-12"
                >
                  No payments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
