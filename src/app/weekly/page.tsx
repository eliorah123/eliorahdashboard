import { FloatingSidebar } from "@/components/sidebar";
import { WeeklyView } from "@/components/weekly-view";

export const metadata = {
  title: "Semanal — Sales Dashboard",
};

export default function WeeklyPage() {
  return (
    <div className="min-h-screen">
      <FloatingSidebar />
      <div className="pl-[220px]">
        <main className="max-w-[1100px] px-6 py-8">
          <WeeklyView />
        </main>
      </div>
    </div>
  );
}
