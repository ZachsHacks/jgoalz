"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UserRound,
  CircleDot,
  CalendarDays,
  DollarSign,
  Truck,
  PieChart,
  Megaphone,
  ExternalLink,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/players", label: "Players", icon: UserRound },
  { href: "/admin/games", label: "Games", icon: CircleDot },
  { href: "/admin/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/admin/payments", label: "Payments", icon: DollarSign },
  { href: "/admin/finances", label: "Finances", icon: PieChart },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/drivers", label: "Drivers", icon: Truck },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4 w-60 border-r min-h-screen bg-sidebar text-sidebar-foreground">
      <div className="px-3 pt-4 pb-6 mb-2 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-lg shadow-md">
            J
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Jgoalz</h1>
            <p className="text-xs text-sidebar-foreground/60">Sports Manager</p>
          </div>
        </div>
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="w-4.5 h-4.5" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <Link
          href="/portal"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ExternalLink className="w-4.5 h-4.5" />
          Player Portal
        </Link>
      </div>
    </nav>
  );
}
