import { redirect } from "next/navigation";

/** /portfolio lands on Holdings — the default section (C0). */
export default function PortfolioIndexPage() {
  redirect("/portfolio/holdings");
}
