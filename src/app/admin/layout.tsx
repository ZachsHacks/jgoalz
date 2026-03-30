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
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-end mb-4">
            <a
              href="/portal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View Player Portal &rarr;
            </a>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
