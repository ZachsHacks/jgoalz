import PortalNav from "./portal-nav";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-white text-center">Jgoalz</h1>
        </div>
      </div>

      {/* Tab Navigation */}
      <PortalNav />

      {/* Page Content */}
      {children}
    </div>
  );
}
