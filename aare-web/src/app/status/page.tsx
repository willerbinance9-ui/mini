import { StatusPageView } from "@/components/StatusPageView";

export const metadata = {
  title: "System Status",
  description: "Live status and 90-day uptime for the Min Partner API.",
};

export default function StatusPage() {
  return <StatusPageView />;
}
