import { Lock, Phone, Unlock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UserProfile, UserRole } from "@maya/types";

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
  tenant: { label: "Inquilino", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  cleaning: { label: "Limpieza", className: "bg-teal-100 text-teal-800 hover:bg-teal-100" },
  security: { label: "Seguridad", className: "bg-slate-100 text-slate-800 hover:bg-slate-100" },
};

interface UserWithLock extends UserProfile {
  is_locked?: boolean;
}

interface UserCardProps {
  user: UserWithLock;
  onLock?: (userId: string) => void;
  onUnlock?: (userId: string) => void;
}

export function UserCard({ user, onLock, onUnlock }: UserCardProps) {
  const role = roleConfig[user.role];
  const isLocked = user.is_locked ?? false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">
            {user.first_name} {user.last_name}
          </CardTitle>
          {isLocked && <Lock className="h-3 w-3 text-red-500" />}
        </div>
        <Badge variant="secondary" className={cn(role.className)}>
          {role.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {user.phone && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            {user.phone}
          </p>
        )}
        {user.rfc && (
          <p className="text-xs text-muted-foreground">RFC: {user.rfc}</p>
        )}
        <div className="flex gap-1 pt-1">
          {isLocked ? (
            <Button variant="ghost" size="xs" onClick={() => onUnlock?.(user.id)}>
              <Unlock className="mr-1 h-3 w-3" />
              Desbloquear
            </Button>
          ) : (
            <Button variant="ghost" size="xs" onClick={() => onLock?.(user.id)}>
              <Lock className="mr-1 h-3 w-3" />
              Bloquear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
