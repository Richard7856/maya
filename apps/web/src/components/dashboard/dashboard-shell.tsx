"use client";

// DashboardShell — client wrapper que gestiona el estado del menú lateral en mobile.
// Separa este estado del layout.tsx (que es un Server Component) para no convertirlo en cliente.
//
// Comportamiento:
//   - Desktop (≥ md): sidebar estático, siempre visible, top bar oculto
//   - Mobile (< md): top bar fijo con botón hamburguesa, sidebar oculto por defecto,
//     aparece como drawer con backdrop al abrir
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Top bar — solo visible en mobile, contiene botón hamburguesa y logo */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b bg-sidebar px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="ml-3 text-lg font-bold text-sidebar-primary">Maya</span>
      </div>

      {/* Backdrop — solo mobile, cierra el drawer al hacer clic fuera */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — en desktop es estático (md:static md:translate-x-0).
          En mobile es un drawer que entra/sale por la izquierda. */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
          "md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onClose={() => setMobileOpen(false)} />
      </div>

      {/* Main — en mobile añade padding-top para compensar el top bar fijo */}
      <main className="flex-1 overflow-y-auto bg-muted/30 p-6 pt-20 md:pt-6">
        {children}
      </main>
    </div>
  );
}
