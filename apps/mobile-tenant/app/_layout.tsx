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

    // Rutas públicas — accesibles sin sesión
    const isLoginScreen = segments[0] === "login";
    const isRootScreen  = segments.length === 0;

    if (!session && !isLoginScreen) {
      // Sin sesión fuera del login → forzar login
      router.replace("/login");
    } else if (session && (isLoginScreen || isRootScreen)) {
      // Con sesión en /login o raíz → ir a tabs
      // Las rutas de detalle (incident/[id], payment/[id]) NO redirigen aquí
      router.replace("/(tabs)");
    }
  }, [session, isLoading, segments]);

  // Pantalla en blanco mientras AsyncStorage resuelve la sesión.
  // Evita el flash incorrecto (login → tabs o viceversa).
  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: "#7C3AED" }} />;
  }

  // Stack raíz — gestiona la pila de navegación completa.
  // Las tabs viven en el grupo (tabs); las pantallas de detalle se apilan encima.
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#7C3AED" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        headerBackTitle: "Atrás",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login"  options={{ headerShown: false }} />
      <Stack.Screen name="incident/[id]" options={{ title: "Detalle de incidente" }} />
      <Stack.Screen name="payment/[id]"  options={{ title: "Detalle de pago" }} />
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
