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
  Plus,
  Phone,
  Car,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Driver, Segment } from "@/types/database";
import { SEGMENT_LABELS } from "@/types/database";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);

  async function loadDrivers() {
    const { data } = await supabase
      .from("drivers")
      .select("*")
      .order("name");
    setDrivers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadDrivers();
  }, []);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const segment = form.get("default_segment") as string;
    await supabase.from("drivers").insert({
      name: form.get("name") as string,
      phone: form.get("phone") as string,
      vehicle_type: form.get("vehicle_type") as string,
      capacity: Number(form.get("capacity")),
      default_segment: segment || null,
    });
    setShowAdd(false);
    loadDrivers();
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const segment = form.get("default_segment") as string;
    await supabase
      .from("drivers")
      .update({
        name: form.get("name") as string,
        phone: form.get("phone") as string,
        vehicle_type: form.get("vehicle_type") as string,
        capacity: Number(form.get("capacity")),
        default_segment: segment || null,
      })
      .eq("id", editing.id);
    setEditing(null);
    loadDrivers();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this driver?")) return;
    await supabase.from("drivers").delete().eq("id", id);
    loadDrivers();
  }

  const segmentOptions: { value: Segment; label: string }[] = [
    { value: "women", label: SEGMENT_LABELS.women },
    { value: "teens", label: SEGMENT_LABELS.teens },
    { value: "girls", label: SEGMENT_LABELS.girls },
  ];

  function DriverForm({
    onSubmit,
    defaults,
    submitLabel,
  }: {
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    defaults?: Driver;
    submitLabel: string;
  }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={defaults?.name} required />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={defaults?.phone}
            required
          />
        </div>
        <div>
          <Label htmlFor="vehicle_type">Vehicle Type</Label>
          <Input
            id="vehicle_type"
            name="vehicle_type"
            defaultValue={defaults?.vehicle_type ?? "minivan"}
          />
        </div>
        <div>
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            defaultValue={defaults?.capacity ?? 6}
          />
        </div>
        <div>
          <Label htmlFor="default_segment">Default Segment (optional)</Label>
          <select
            id="default_segment"
            name="default_segment"
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            defaultValue={defaults?.default_segment ?? ""}
          >
            <option value="">None</option>
            {segmentOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Auto-assigns this driver for the selected segment
          </p>
        </div>
        <Button type="submit" className="w-full">
          {submitLabel}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Drivers</h2>
          <p className="text-muted-foreground mt-1">
            {loading
              ? "\u00a0"
              : `${drivers.length} driver${drivers.length !== 1 ? "s" : ""} available`}
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger className={cn(buttonVariants({ variant: "default", size: "default" }))}>
              <Plus className="w-4 h-4 mr-2" />
              Add Driver
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Driver</DialogTitle>
            </DialogHeader>
            <DriverForm onSubmit={handleAdd} submitLabel="Save" />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
                  <div className="h-5 w-28 bg-muted rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        {!loading &&
          drivers.map((driver) => (
            <Card
              key={driver.id}
              className="shadow-sm hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <Car className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg">{driver.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1.5 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{driver.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5" />
                    <span>{driver.vehicle_type}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Capacity: {driver.capacity}</span>
                  </div>
                  {driver.default_segment && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                        Default for {SEGMENT_LABELS[driver.default_segment]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Dialog
                    open={editing?.id === driver.id}
                    onOpenChange={(open) => setEditing(open ? driver : null)}
                  >
                    <DialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Driver</DialogTitle>
                      </DialogHeader>
                      <DriverForm
                        onSubmit={handleUpdate}
                        defaults={driver}
                        submitLabel="Update"
                      />
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(driver.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        {!loading && drivers.length === 0 && (
          <Card className="col-span-full shadow-sm">
            <CardContent className="py-12 text-center">
              <Car className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">
                No drivers yet. Add one to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
