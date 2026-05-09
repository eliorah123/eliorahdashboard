import { redirect } from "next/navigation";

export default function InputPage() {
  redirect("/sales?tab=calendario");
}
