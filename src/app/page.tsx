import { FloatingSidebar } from "@/components/sidebar";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata = {
  title: "Dashboard — Sales Performance",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <FloatingSidebar />
      <div className="pl-[220px]">
        <main className="max-w-[1280px] px-6 py-8">
          <DashboardShell />
        </main>
      </div>
    </div>
  );
}
