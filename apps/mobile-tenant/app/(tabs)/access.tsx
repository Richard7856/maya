import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

// Demo data — access code is normally decrypted from backend
const DEMO = {
  access_code: "4782",
  room: "301-B",
  // Last 7 access events for this tenant's room
  events: [
    { id: "e-001", type: "entry", timestamp: "Hoy 08:32", note: "Entrada principal" },
    { id: "e-002", type: "exit", timestamp: "Hoy 07:05", note: "Salida principal" },
    { id: "e-003", type: "entry", timestamp: "Ayer 22:10", note: "Entrada principal" },
    { id: "e-004", type: "exit", timestamp: "Ayer 09:15", note: "Salida principal" },
    { id: "e-005", type: "entry", timestamp: "Ayer 08:50", note: "Entrada principal" },
    { id: "e-006", type: "guest", timestamp: "07/04/2026 16:00", note: "Acceso invitado — Juan García" },
    { id: "e-007", type: "exit", timestamp: "06/04/2026 21:30", note: "Salida principal" },
  ],
};

const EVENT_ICONS = {
  entry: { icon: "log-in-outline", color: "#10B981" },
  exit: { icon: "log-out-outline", color: "#6B7280" },
  guest: { icon: "person-add-outline", color: "#7C3AED" },
} as const;

function AccessCodeCard() {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.codeCard}>
      <Text style={styles.codeLabel}>Tu código de acceso</Text>

      <View style={styles.codeRow}>
        {visible ? (
          DEMO.access_code.split("").map((digit, i) => (
            <View key={i} style={styles.digit}>
              <Text style={styles.digitText}>{digit}</Text>
            </View>
          ))
        ) : (
          DEMO.access_code.split("").map((_, i) => (
            <View key={i} style={styles.digit}>
              <Text style={styles.digitText}>•</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.codeActions}>
        <TouchableOpacity
          style={styles.codeBtn}
          onPress={() => setVisible((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={16}
            color="#7C3AED"
          />
          <Text style={styles.codeBtnText}>
            {visible ? "Ocultar" : "Mostrar"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.codeBtn}
          onPress={() =>
            Alert.alert(
              "Solicitar nuevo código",
              "¿Deseas solicitar un cambio de código de acceso? Se notificará a administración.",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Solicitar", onPress: () => {} },
              ]
            )
          }
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={16} color="#7C3AED" />
          <Text style={styles.codeBtnText}>Cambiar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.codeWarning}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#6B7280" />
        <Text style={styles.codeWarningText}>
          No compartas este código. Es único para el cuarto {DEMO.room}.
        </Text>
      </View>
    </View>
  );
}

function GuestAccessCard() {
  return (
    <View style={styles.guestCard}>
      <View style={styles.guestHeader}>
        <Ionicons name="person-add-outline" size={20} color="#7C3AED" />
        <Text style={styles.guestTitle}>Acceso para invitados</Text>
      </View>
      <Text style={styles.guestDesc}>
        Genera un código temporal de 24 horas para que un invitado pueda acceder
        sin necesitar tu código principal.
      </Text>
      <TouchableOpacity
        style={styles.guestBtn}
        activeOpacity={0.85}
        onPress={() =>
          Alert.alert("Próximamente", "Esta función estará disponible en la siguiente versión.")
        }
      >
        <Ionicons name="add-circle-outline" size={16} color="#fff" />
        <Text style={styles.guestBtnText}>Generar código de invitado</Text>
      </TouchableOpacity>
    </View>
  );
}

function EventRow({ event }: { event: (typeof DEMO.events)[0] }) {
  const cfg = EVENT_ICONS[event.type as keyof typeof EVENT_ICONS];
  return (
    <View style={styles.eventRow}>
      <View style={[styles.eventIcon, { backgroundColor: cfg.color + "18" }]}>
        <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.eventNote}>{event.note}</Text>
        <Text style={styles.eventTime}>{event.timestamp}</Text>
      </View>
    </View>
  );
}

export default function AccessScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AccessCodeCard />
      <GuestAccessCard />

      <Text style={styles.sectionTitle}>Historial de accesos</Text>
      <View style={styles.eventList}>
        {DEMO.events.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 32 },

  // Access code card
  codeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  codeLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 16 },
  codeRow: { flexDirection: "row", gap: 12, justifyContent: "center", marginBottom: 20 },
  digit: {
    width: 54,
    height: 60,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  digitText: { fontSize: 28, fontWeight: "800", color: "#7C3AED" },
  codeActions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  codeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
  },
  codeBtnText: { color: "#7C3AED", fontWeight: "600", fontSize: 13 },
  codeWarning: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 10,
  },
  codeWarningText: { fontSize: 12, color: "#6B7280", flex: 1 },

  // Guest access card
  guestCard: {
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  guestHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  guestTitle: { fontSize: 15, fontWeight: "700", color: "#5B21B6" },
  guestDesc: { fontSize: 13, color: "#6D28D9", lineHeight: 18, marginBottom: 14 },
  guestBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  guestBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  eventList: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  eventIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  eventNote: { fontSize: 13, fontWeight: "600", color: "#111827", marginBottom: 2 },
  eventTime: { fontSize: 12, color: "#9CA3AF" },
});
