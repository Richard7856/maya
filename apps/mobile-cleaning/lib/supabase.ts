// Supabase client singleton para la app del personal de limpieza.
// En native: AsyncStorage persiste la sesión entre cierres.
// En web (Expo web / preview): omitimos storage para evitar el crash
// de AsyncStorage llamando `window` en SSR.
//
// Lock fix: En Expo Web el mecanismo navigatorLock de Supabase (Web Locks API)
// choca con el hot-reload y lanza "Lock was released because another request
// stole it". Se reemplaza con un stub que ejecuta fn() directamente — en
// desarrollo web no necesitamos locks entre pestañas.
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Stub de lock para web: bypasea la Web Locks API problemática en Expo Web.
// En producción nativa los locks funcionan normal vía AsyncStorage.
const webLock = Platform.OS === "web"
  ? async (_name: string, _timeout: number, fn: () => Promise<unknown>) => fn()
  : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    ...(webLock ? { lock: webLock } : {}),
  },
});
