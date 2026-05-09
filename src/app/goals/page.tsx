import { redirect } from "next/navigation";

export default function GoalsPage() {
  redirect("/sales?tab=metas");
}
