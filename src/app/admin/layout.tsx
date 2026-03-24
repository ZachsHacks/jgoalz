import { AdminNav } from "@/components/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-8 overflow-auto bg-background">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
