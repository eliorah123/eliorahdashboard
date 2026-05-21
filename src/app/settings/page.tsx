import { FloatingSidebar } from "@/components/sidebar";
import { SettingsView } from "@/components/settings-view";

export const metadata = {
  title: "Configurações — Sales Dashboard",
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <FloatingSidebar />
      <div className="pl-[220px]">
        <main className="max-w-[640px] px-6 py-8">
          <SettingsView />
        </main>
      </div>
    </div>
  );
}
