import { FloatingSidebar } from "@/components/sidebar";
import { SellersManager } from "@/components/sellers-manager";

export const metadata = {
  title: "Vendedores — Sales Dashboard",
};

export default function SellersPage() {
  return (
    <div className="min-h-screen">
      <FloatingSidebar />
      <div className="pl-[220px]">
        <main className="max-w-[720px] px-6 py-8">
          <SellersManager />
        </main>
      </div>
    </div>
  );
}
