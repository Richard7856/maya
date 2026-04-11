"use client";

/**
 * Sheet — slide-over panel based on @radix-ui/react-dialog.
 *
 * Why Dialog (not Drawer)?
 * Dialog handles focus trapping, escape-to-close, and backdrop click
 * automatically. The Sheet is just a Dialog whose Content slides in from
 * the right instead of being centered.
 *
 * Note on TypeScript: Radix primitives are wrapped in local function
 * components (not plain re-exports) to avoid @types/react version conflicts
 * in the pnpm monorepo where @types/react@19 lives at the root but
 * this app uses react@18.
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Root — controls open/close state ────────────────────────────────────────
export function Sheet(props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

// ─── Trigger ─────────────────────────────────────────────────────────────────
export function SheetTrigger(props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />;
}

// ─── Close button ─────────────────────────────────────────────────────────────
export function SheetClose(props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />;
}

// ─── Overlay (backdrop) ───────────────────────────────────────────────────────
function SheetOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

// ─── Content (the sliding panel itself) ──────────────────────────────────────
interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "right"; // only right is implemented; add left/top/bottom as needed
}

export function SheetContent({ className, children, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={cn(
          // Full-height panel pinned to the right edge, max-width on desktop
          "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col bg-background shadow-xl sm:max-w-md",
          // Slide-in / slide-out — Tailwind `animate-in/out` plugin required
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          "duration-300 ease-in-out",
          className,
        )}
        {...props}
      >
        {children}
        {/* X button always in top-right corner */}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────
export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 border-b px-6 py-4", className)} {...props} />;
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-4", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t px-6 py-4 flex justify-end gap-2", className)} {...props} />;
}

// ─── Title & Description (required for accessibility / screen readers) ────────
export function SheetTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("font-semibold", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
