"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usersApi } from "@maya/api-client";
import type { UserProfile } from "@maya/types";
import { UserCard } from "./user-card";
import { RoleFilter } from "./role-filter";
import { Skeleton } from "@/components/ui/skeleton";

export function UserGrid() {
  const searchParams = useSearchParams();
  const roleFilter = searchParams.get("role") || undefined;

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    usersApi
      .list({ role: roleFilter as UserProfile["role"] })
      .then(setUsers)
      .catch(() => setError("Error al cargar los usuarios"))
      .finally(() => setLoading(false));
  }, [roleFilter]);

  async function handleLock(userId: string) {
    await usersApi.lock(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_locked: true } as UserProfile : u))
    );
  }

  async function handleUnlock(userId: string) {
    await usersApi.unlock(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_locked: false } as UserProfile : u))
    );
  }

  return (
    <div className="space-y-4">
      <RoleFilter />

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && users.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay usuarios registrados.</p>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onLock={handleLock}
              onUnlock={handleUnlock}
            />
          ))}
        </div>
      )}
    </div>
  );
}
