// Contexto de autenticación para la app de inquilinos.
// Responsabilidades:
//   1. Mantener la sesión de Supabase y el perfil del usuario
//   2. Sincronizar el JWT con el api-client vía setAuthToken()
//   3. Validar que el rol sea 'tenant' — rechaza admins/staff que intenten usar esta app
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { setAuthToken, usersApi } from "@maya/api-client";
import type { UserProfile } from "@maya/types";

type AuthContextValue = {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // isLoading: true while resolving the initial session from AsyncStorage
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load persisted session on mount (AsyncStorage is async)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setAuthToken(session.access_token);
        loadProfile();
      }
      setIsLoading(false);
    });

    // Keep session in sync on token refresh and sign-in/out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setAuthToken(session.access_token);
        loadProfile();
      } else {
        setAuthToken(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile() {
    try {
      const p = await usersApi.me();
      setProfile(p);
    } catch {
      // Token valid but profile fetch failed — sign out to reset state
      await supabase.auth.signOut();
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Validate role before granting access — tenants only
    setAuthToken(data.session.access_token);
    const p = await usersApi.me();
    if (p.role !== "tenant") {
      await supabase.auth.signOut();
      throw new Error("Esta app es exclusiva para inquilinos.");
    }
    setProfile(p);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth must be called inside AuthProvider — throws otherwise to catch misuse early
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
