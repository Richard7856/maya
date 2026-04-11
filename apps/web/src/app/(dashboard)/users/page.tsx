import { Suspense } from "react";
import type { Metadata } from "next";
import { UserGrid } from "@/components/users/user-grid";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Usuarios — Maya",
};

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
      {/* Suspense required: UserGrid uses useSearchParams() which suspends without a boundary */}
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        }
      >
        <UserGrid />
      </Suspense>
    </div>
  );
}
