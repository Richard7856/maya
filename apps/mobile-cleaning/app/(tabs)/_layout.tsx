import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Tab navigation — solo accesible para personal de limpieza autenticado.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#059669",   // Emerald — distinto del morado de la app de inquilinos
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F3F4F6",
          paddingBottom: 6,
          height: 60,
        },
        headerStyle: { backgroundColor: "#059669" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Mis tareas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: "Sesión activa",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
