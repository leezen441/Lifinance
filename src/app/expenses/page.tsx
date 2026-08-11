import { redirect } from "next/navigation";

/** Old route — Spend world now lives at /money. */
export default function ExpensesRedirect() {
  redirect("/money");
}
