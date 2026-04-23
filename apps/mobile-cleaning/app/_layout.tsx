// Root layout: envuelve toda la app con AuthProvider y gestiona la navegación
// según el estado de autenticación.
//
// Lógica de guard:
//   - Sin sesión + en ruta protegida → redirige a /login
//   - Con sesión + en /login → redirige a /(tabs)
//   - isLoading: muestra pantalla en blanco mientras AsyncStorage resuelve la sesión
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { AuthProvider, useAuth } from "../context/auth";

function AuthGuard() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Solo /login y la raíz son rutas públicas.
    // Cualquier otra ruta (tabs, detalle) requiere sesión.
    const isLoginScreen = segments[0] === "login";
    const isRootScreen  = segments.length === 0;

    if (!session && !isLoginScreen) {
      router.replace("/login");
    } else if (session && (isLoginScreen || isRootScreen)) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, segments]);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: "#059669" }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#059669" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        headerBackTitle: "Atrás",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login"  options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGuard />
    </AuthProvider>
  );
}
