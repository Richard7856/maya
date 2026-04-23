import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ApiProvider } from "@/components/dashboard/api-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // DashboardShell es un Client Component que gestiona el estado del sidebar en mobile.
  // Este layout queda Server Component — solo maneja auth guard.
  return (
    <DashboardShell>
      <ApiProvider>{children}</ApiProvider>
    </DashboardShell>
  );
}
