// Pantalla de detalle de incidente.
// Carga el incidente por ID desde la API y muestra toda la información disponible.
// El tenant también puede agregar una nota de seguimiento desde aquí.
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useLayoutEffect } from "react";
import { incidentsApi } from "@maya/api-client";
import type { Incident } from "@maya/types";

// ─── Config de estados ────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:        { label: "Abierto",    color: "#F59E0B", icon: "alert-circle-outline"    },
  in_progress: { label: "En proceso", color: "#7C3AED", icon: "construct-outline"       },
  resolved:    { label: "Resuelto",   color: "#10B981", icon: "checkmark-circle-outline" },
  closed:      { label: "Cerrado",    color: "#6B7280", icon: "lock-closed-outline"      },
} as const;

const PRIORITY_CONFIG = {
  low:    { label: "Baja",     color: "#6B7280" },
  medium: { label: "Media",    color: "#3B82F6" },
  high:   { label: "Alta",     color: "#F59E0B" },
  urgent: { label: "Urgente",  color: "#EF4444" },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function InfoRow({ icon, label, value }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color="#7C3AED" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Modal para agregar nota ───────────────────────────────────────────────────

function AddNoteModal({
  visible,
  incidentId,
  onClose,
  onSent,
}: {
  visible: boolean;
  incidentId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    if (!note.trim()) {
      Alert.alert("Campo requerido", "Escribe una nota antes de enviar.");
      return;
    }
    setSubmitting(true);
    try {
      await incidentsApi.addUpdate(incidentId, { note: note.trim() });
      setNote("");
      onSent();
      onClose();
      Alert.alert("Nota enviada", "Tu nota fue enviada a administración.");
    } catch {
      Alert.alert("Error", "No se pudo enviar la nota. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Agregar nota</Text>
          <TouchableOpacity onPress={onClose} disabled={submitting}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
        <View style={{ padding: 20, flex: 1 }}>
          <Text style={styles.label}>Nota para administración</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe el avance, problema adicional o cualquier actualización..."
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={!submitting}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.sendBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.sendBtnText}>Enviar nota</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState(false);

  // Título dinámico en el header una vez que cargue el incidente
  useLayoutEffect(() => {
    if (incident?.title) {
      navigation.setOptions({ title: incident.title });
    }
  }, [incident, navigation]);

  const load = async () => {
    try {
      setError(null);
      const data = await incidentsApi.get(id);
      setIncident(data);
    } catch {
      setError("No se pudo cargar el incidente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (error || !incident) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text style={styles.errorText}>{error ?? "Incidente no encontrado"}</Text>
        <TouchableOpacity onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status   = STATUS_CONFIG[incident.status as keyof typeof STATUS_CONFIG]   ?? STATUS_CONFIG.open;
  const priority = PRIORITY_CONFIG[incident.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const isActive = incident.status === "open" || incident.status === "in_progress";

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Encabezado con status y prioridad ── */}
        <View style={styles.headerCard}>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: status.color + "18" }]}>
              <Ionicons name={status.icon as any} size={13} color={status.color} />
              <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: priority.color + "18" }]}>
              <Text style={[styles.badgeText, { color: priority.color }]}>
                Prioridad {priority.label}
              </Text>
            </View>
          </View>
          <Text style={styles.title}>{incident.title}</Text>
        </View>

        {/* ── Descripción ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{incident.description}</Text>
        </View>

        {/* ── Detalles ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="pricetag-outline"    label="Categoría"      value={incident.category} />
            <InfoRow icon="calendar-outline"    label="Reportado"      value={formatDate(incident.created_at)} />
            <InfoRow icon="refresh-outline"     label="Última actualización" value={formatDate(incident.updated_at)} />
            {incident.assigned_to && (
              <InfoRow icon="person-outline"    label="Asignado a"     value="Administración" />
            )}
            {incident.resolved_at && (
              <InfoRow icon="checkmark-done-outline" label="Resuelto"   value={formatDate(incident.resolved_at)} />
            )}
            {incident.repair_cost != null && (
              <InfoRow icon="cash-outline"      label="Costo de reparación"
                value={`$${incident.repair_cost.toLocaleString("es-MX")} MXN`} />
            )}
          </View>
        </View>

        {/* ── Acción: agregar nota (solo si sigue activo) ── */}
        {isActive && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seguimiento</Text>
            <TouchableOpacity
              style={styles.addNoteBtn}
              onPress={() => setNoteModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#7C3AED" />
              <Text style={styles.addNoteBtnText}>Agregar nota a administración</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Estado cerrado ── */}
        {!isActive && (
          <View style={styles.resolvedBox}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.resolvedText}>
              Este incidente fue {incident.status === "resolved" ? "resuelto" : "cerrado"}.
            </Text>
          </View>
        )}
      </ScrollView>

      <AddNoteModal
        visible={noteModal}
        incidentId={incident.id}
        onClose={() => setNoteModal(false)}
        onSent={load}
      />
    </>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content:   { padding: 16, paddingBottom: 32 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },

  errorText: { fontSize: 14, color: "#DC2626", textAlign: "center" },
  retryBtn:  { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: "#EDE9FE", borderRadius: 8 },
  retryText: { color: "#7C3AED", fontWeight: "700" },

  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  badges: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "800", color: "#111827", lineHeight: 26 },

  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 13, fontWeight: "700", color: "#6B7280",
    textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8,
  },
  description: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    fontSize: 14, color: "#374151", lineHeight: 22,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  infoCard: {
    backgroundColor: "#fff", borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  infoRow: {
    flexDirection: "row", alignItems: "center", padding: 14,
    borderBottomWidth: 1, borderBottomColor: "#F9FAFB",
  },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: "#EDE9FE",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  infoContent: { flex: 1 },
  infoLabel:   { fontSize: 11, color: "#9CA3AF", marginBottom: 2 },
  infoValue:   { fontSize: 14, color: "#111827", fontWeight: "600" },

  addNoteBtn: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  addNoteBtnText: { flex: 1, fontSize: 14, color: "#7C3AED", fontWeight: "600" },

  resolvedBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#ECFDF5", borderRadius: 12, padding: 16,
  },
  resolvedText: { fontSize: 14, color: "#065F46", fontWeight: "600", flex: 1 },

  // Modal
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  label:      { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 10, padding: 12, fontSize: 14, color: "#111827",
  },
  textarea: { height: 120, paddingTop: 12 },
  sendBtn: {
    backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 14, marginTop: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
