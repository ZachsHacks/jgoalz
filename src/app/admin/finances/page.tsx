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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Trash2,
} from "lucide-react";
import type { Expense, SessionWithGame } from "@/types/database";

type ExpenseWithSession = Expense & { session?: SessionWithGame | null };

type SessionBreakdown = {
  session: SessionWithGame;
  income: number;
  expenses: number;
  net: number;
};

export default function FinancesPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseWithSession[]>([]);
  const [sessions, setSessions] = useState<SessionWithGame[]>([]);
  const [sessionBreakdowns, setSessionBreakdowns] = useState<SessionBreakdown[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);

  async function loadData() {
    setLoading(true);

    // Load paid payments for the month
    const { data: payments } = await supabase
      .from("payments")
      .select("amount, session_id")
      .eq("status", "paid")
      .eq("month", selectedMonth);

    const paid = payments ?? [];
    setIncome(paid.reduce((sum, p) => sum + Number(p.amount), 0));
    setPaidCount(paid.length);

    // Load expenses for the month
    const { data: expData } = await supabase
      .from("expenses")
      .select("*, session:sessions(*, game:games(*))")
      .eq("month", selectedMonth)
      .order("created_at", { ascending: false });
    const expenseList = (expData ?? []) as ExpenseWithSession[];
    setExpenses(expenseList);

    // Load sessions for the month (for dropdown + breakdown)
    const { data: sessData } = await supabase
      .from("sessions")
      .select("*, game:games(*)")
      .order("date", { ascending: false });
    const allSessions = (sessData as SessionWithGame[]) ?? [];
    setSessions(allSessions);

    // Build per-session breakdown
    const sessionIncomeMap: Record<string, number> = {};
    for (const p of paid) {
      if (p.session_id) {
        sessionIncomeMap[p.session_id] =
          (sessionIncomeMap[p.session_id] || 0) + Number(p.amount);
      }
    }
    const sessionExpenseMap: Record<string, number> = {};
    for (const e of expenseList) {
      if (e.session_id) {
        sessionExpenseMap[e.session_id] =
          (sessionExpenseMap[e.session_id] || 0) + Number(e.amount);
      }
    }

    const relevantSessionIds = new Set([
      ...Object.keys(sessionIncomeMap),
      ...Object.keys(sessionExpenseMap),
    ]);

    const breakdowns: SessionBreakdown[] = [];
    for (const sid of relevantSessionIds) {
      const session = allSessions.find((s) => s.id === sid);
      if (!session) continue;
      const inc = sessionIncomeMap[sid] || 0;
      const exp = sessionExpenseMap[sid] || 0;
      breakdowns.push({ session, income: inc, expenses: exp, net: inc - exp });
    }
    breakdowns.sort(
      (a, b) =>
        new Date(b.session.date).getTime() - new Date(a.session.date).getTime()
    );
    setSessionBreakdowns(breakdowns);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  async function handleAddExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const sessionId = form.get("session_id") as string;
    await supabase.from("expenses").insert({
      description: form.get("description") as string,
      amount: Number(form.get("amount")),
      session_id: sessionId === "none" ? null : sessionId,
      month: selectedMonth,
    });
    setShowAddExpense(false);
    loadData();
  }

  async function deleteExpense(expenseId: string) {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", expenseId);
    loadData();
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netIncome = income - totalExpenses;

  // Generate month options (last 12 months)
  const monthOptions: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    monthOptions.push({ value: val, label });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Finances</h2>
          <p className="text-muted-foreground mt-1">
            Income &amp; expenses overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={(v) => v !== null && setSelectedMonth(v)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-2 w-24 bg-muted rounded animate-pulse" />
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
                    <p className="text-sm font-medium text-muted-foreground">
                      Income
                    </p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">
                      ${income.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {paidCount} paid payment{paidCount !== 1 ? "s" : ""}
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
                    <p className="text-sm font-medium text-muted-foreground">
                      Expenses
                    </p>
                    <p className="text-3xl font-bold text-red-600 mt-1">
                      ${totalExpenses.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {expenses.length} line item
                      {expenses.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Net Income
                    </p>
                    <p
                      className={`text-3xl font-bold mt-1 ${
                        netIncome >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      ${netIncome.toFixed(0)}
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded-xl ${
                      netIncome >= 0
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Expenses table */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Expenses</CardTitle>
            <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
              <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Expense
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Expense</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      name="description"
                      required
                      placeholder="e.g. Field rental, Driver payment, Equipment"
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="session_id">Session (optional)</Label>
                    <Select name="session_id" defaultValue="none">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No session</SelectItem>
                        {sessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.game?.name ?? "Session"} --{" "}
                            {new Date(
                              s.date + "T00:00:00"
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">
                    Add Expense
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="font-medium">
                  {expense.description}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {expense.session?.game
                    ? `${expense.session.game.name} -- ${new Date(
                        expense.session.date + "T00:00:00"
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}`
                    : "--"}
                </TableCell>
                <TableCell className="font-medium text-red-600">
                  -${Number(expense.amount).toFixed(0)}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => deleteExpense(expense.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-12"
                >
                  No expenses for this month.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Per-session breakdown */}
      {!loading && sessionBreakdowns.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Per-Session Breakdown</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionBreakdowns.map((b) => (
                <TableRow key={b.session.id}>
                  <TableCell className="font-medium">
                    {b.session.game?.name ?? "Session"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(
                      b.session.date + "T00:00:00"
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 font-medium">
                    ${b.income.toFixed(0)}
                  </TableCell>
                  <TableCell className="text-right text-red-600 font-medium">
                    -${b.expenses.toFixed(0)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      b.net >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    ${b.net.toFixed(0)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
