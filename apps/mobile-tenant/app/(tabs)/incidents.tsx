// Pantalla de incidentes del inquilino.
// Carga los incidentes de la habitación del tenant (el backend filtra automáticamente).
// Permite reportar nuevos incidentes — requiere room_id que se obtiene del contrato activo.
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { incidentsApi, leasesApi } from "@maya/api-client";
import type { Incident, Lease } from "@maya/types";

const STATUS_CONFIG = {
  open: { label: "Abierto", color: "#F59E0B" },
  in_progress: { label: "En proceso", color: "#7C3AED" },
  resolved: { label: "Resuelto", color: "#10B981" },
  closed: { label: "Cerrado", color: "#6B7280" },
} as const;

const CATEGORIES = ["plomería", "electricidad", "general", "limpieza", "otro"] as const;
type Category = (typeof CATEGORIES)[number];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function IncidentCard({ incident }: { incident: Incident }) {
  const status = incident.status as keyof typeof STATUS_CONFIG;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{incident.title}</Text>
        <View style={[styles.badge, { backgroundColor: cfg.color + "18" }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {incident.description}
      </Text>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="pricetag-outline" size={12} color="#9CA3AF" />
          <Text style={styles.metaText}>{incident.category}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
          <Text style={styles.metaText}>{formatDate(incident.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

function NewIncidentModal({
  visible,
  roomId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  roomId: string | null;
  onClose: () => void;
  onCreated: (incident: Incident) => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Campo requerido", "Por favor indica el título del incidente.");
      return;
    }
    if (!roomId) {
      Alert.alert("Error", "No se encontró tu habitación activa.");
      return;
    }

    setSubmitting(true);
    try {
      const newIncident = await incidentsApi.create({
        room_id: roomId,
        title: title.trim(),
        description: desc.trim() || undefined,
        category,
      });
      onCreated(newIncident);
      setTitle("");
      setDesc("");
      setCategory("general");
      onClose();
    } catch {
      Alert.alert("Error", "No se pudo enviar el incidente. Intenta de nuevo.");
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
          <Text style={styles.modalTitle}>Nuevo incidente</Text>
          <TouchableOpacity onPress={onClose} disabled={submitting}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Fuga en baño"
            value={title}
            onChangeText={setTitle}
            editable={!submitting}
          />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe el problema con detalle..."
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!submitting}
          />

          <Text style={styles.label}>Categoría</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, category === cat && styles.catChipActive]}
                onPress={() => setCategory(cat)}
                disabled={submitting}
              >
                <Text style={[styles.catText, category === cat && styles.catTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Enviar reporte</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function IncidentsScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      // Fetch en paralelo: incidentes + contrato activo (para obtener room_id al crear)
      const [incidentData, leaseData] = await Promise.all([
        incidentsApi.list(),
        leasesApi.mine().catch(() => null as Lease | null),
      ]);
      setIncidents(incidentData);
      if (leaseData) setRoomId(leaseData.room_id);
    } catch {
      setError("No se pudieron cargar los incidentes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreated = (newIncident: Incident) => {
    // Agrega el nuevo incidente al inicio sin re-fetch
    setIncidents((prev) => [newIncident, ...prev]);
    Alert.alert("Incidente reportado", "Tu reporte fue enviado a administración.");
  };

  const open = incidents.filter((i) => i.status !== "resolved" && i.status !== "closed");
  const resolved = incidents.filter((i) => i.status === "resolved" || i.status === "closed");

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchData}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {open.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>En proceso ({open.length})</Text>
                {open.map((inc) => <IncidentCard key={inc.id} incident={inc} />)}
              </>
            )}

            {resolved.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Resueltos ({resolved.length})</Text>
                {resolved.map((inc) => <IncidentCard key={inc.id} incident={inc} />)}
              </>
            )}

            {incidents.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle" size={48} color="#10B981" />
                <Text style={styles.emptyText}>Sin incidentes activos</Text>
                <Text style={styles.emptyHint}>Toca + para reportar un problema</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalOpen(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <NewIncidentModal
        visible={modalOpen}
        roomId={roomId}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 80 },

  centered: { paddingTop: 60, alignItems: "center" },

  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  errorText: { fontSize: 14, color: "#DC2626", textAlign: "center" },
  retryText: { fontSize: 14, fontWeight: "700", color: "#7C3AED" },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  cardDesc: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 10 },
  cardMeta: { flexDirection: "row", gap: 14 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, color: "#9CA3AF" },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: "600" },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, color: "#374151", fontWeight: "600" },
  emptyHint: { fontSize: 13, color: "#9CA3AF" },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: "#7C3AED",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalBody: { padding: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#111827",
  },
  textarea: { height: 100, paddingTop: 12 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  catChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  catText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  catTextActive: { color: "#fff", fontWeight: "700" },
  submitBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
