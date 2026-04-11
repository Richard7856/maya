import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Tab navigation — solo accesible para usuarios autenticados (el root _layout.tsx
// redirige a /login si no hay sesión activa).
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#7C3AED",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F3F4F6",
          paddingBottom: 6,
          height: 60,
        },
        headerStyle: { backgroundColor: "#7C3AED" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: "Pagos",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: "Incidentes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="access"
        options={{
          title: "Acceso",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="key-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
