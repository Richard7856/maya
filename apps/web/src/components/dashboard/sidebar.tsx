"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Building2, CreditCard, FileText, LogOut, MessageSquareWarning, Package, ShoppingCart, SprayCan, Ticket, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/buildings", label: "Edificios",  icon: Building2 },
  { href: "/users",     label: "Usuarios",   icon: Users },
  { href: "/leases",    label: "Contratos",  icon: FileText },
  { href: "/payments",  label: "Pagos",      icon: CreditCard },
  { href: "/incidents", label: "Incidentes", icon: AlertTriangle },
  { href: "/tickets",   label: "Tickets",    icon: Ticket },
  { href: "/cleaning",   label: "Limpieza",    icon: SprayCan },
  { href: "/complaints", label: "Quejas",       icon: MessageSquareWarning },
  { href: "/providers",  label: "Proveedores", icon: Package },
  { href: "/items",      label: "Catálogo",    icon: ShoppingCart },
];

type SidebarProps = {
  // onClose: llamado al seleccionar un ítem — DashboardShell lo usa para cerrar el drawer en mobile.
  // En desktop este prop se ignora porque el sidebar siempre está visible.
  onClose?: () => void;
};

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Header — en desktop muestra el logo solo; en mobile muestra logo + X para cerrar */}
      <div className="flex h-14 items-center justify-between px-4">
        <span className="text-lg font-bold text-sidebar-primary">Maya</span>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-foreground hover:bg-sidebar-accent/50 md:hidden"
            aria-label="Cerrar menú"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
