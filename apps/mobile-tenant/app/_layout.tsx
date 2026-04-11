// Root layout: envuelve toda la app con AuthProvider y gestiona la navegación
// según el estado de autenticación.
//
// Lógica de guard:
//   - Sin sesión + en ruta protegida → redirige a /login
//   - Con sesión + en /login → redirige a /(tabs)
//   - isLoading: muestra pantalla en blanco mientras AsyncStorage resuelve la sesión
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { AuthProvider, useAuth } from "../context/auth";

function AuthGuard() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inTabsGroup = segments[0] === "(tabs)";

    if (!session && inTabsGroup) {
      // Usuario no autenticado intentando acceder a rutas protegidas
      router.replace("/login");
    } else if (session && !inTabsGroup) {
      // Usuario autenticado en /login o ruta raíz — llevar al dashboard
      router.replace("/(tabs)");
    }
  }, [session, isLoading, segments]);

  // Mostrar pantalla en blanco mientras se resuelve la sesión de AsyncStorage.
  // Evita el flash de contenido incorrecto (login → tabs o viceversa).
  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: "#7C3AED" }} />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGuard />
    </AuthProvider>
  );
}
