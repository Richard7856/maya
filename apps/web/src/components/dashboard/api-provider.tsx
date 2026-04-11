"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAuthToken } from "@maya/api-client";

/**
 * Initializes the API client token before rendering children.
 *
 * Without this gate, child components (like BuildingGrid) fire API requests
 * before the Supabase session resolves — causing 403s on every first load.
 */
export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Block children until the token is set
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthToken(session?.access_token ?? null);
      setReady(true);
    });

    // Keep token in sync on refresh/logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
