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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

// Demo incidents for this tenant's room
const DEMO_INCIDENTS = [
  {
    id: "inc-001",
    title: "Fuga en baño",
    description: "El tubo debajo del lavabo tiene una fuga pequeña que gotea al piso.",
    category: "plomería",
    status: "in_review",
    created_at: "07/04/2026",
    updated_at: "08/04/2026",
  },
  {
    id: "inc-002",
    title: "Foco fundido en pasillo",
    description: "El foco del pasillo principal lleva 3 días fundido.",
    category: "electricidad",
    status: "resolved",
    created_at: "01/04/2026",
    updated_at: "03/04/2026",
  },
  {
    id: "inc-003",
    title: "Puerta del cuarto no cierra bien",
    description: "La chapa está descalibrada, la puerta no cierra con llave correctamente.",
    category: "general",
    status: "resolved",
    created_at: "20/03/2026",
    updated_at: "22/03/2026",
  },
];

const STATUS_CONFIG = {
  open: { label: "Abierto", color: "#F59E0B" },
  in_review: { label: "En revisión", color: "#3B82F6" },
  in_progress: { label: "En proceso", color: "#7C3AED" },
  resolved: { label: "Resuelto", color: "#10B981" },
} as const;

const CATEGORIES = ["plomería", "electricidad", "general", "limpieza", "otro"] as const;

type IncidentStatus = keyof typeof STATUS_CONFIG;

function IncidentCard({ incident }: { incident: (typeof DEMO_INCIDENTS)[0] }) {
  const cfg = STATUS_CONFIG[incident.status as IncidentStatus];

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
          <Text style={styles.metaText}>Reportado: {incident.created_at}</Text>
        </View>
      </View>
    </View>
  );
}

function NewIncidentModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<string>("general");

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert("Campo requerido", "Por favor indica el título del incidente.");
      return;
    }
    // In production: POST /api/v1/incidents with auth token
    Alert.alert("Incidente reportado", "Tu incidente fue enviado a administración.", [
      { text: "OK", onPress: onClose },
    ]);
    setTitle("");
    setDesc("");
    setCategory("general");
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Nuevo incidente</Text>
          <TouchableOpacity onPress={onClose}>
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
          />

          <Text style={styles.label}>Categoría</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.catChip,
                  category === cat && styles.catChipActive,
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.catText,
                    category === cat && styles.catTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.submitBtnText}>Enviar reporte</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function IncidentsScreen() {
  const [modalOpen, setModalOpen] = useState(false);
  const open = DEMO_INCIDENTS.filter((i) => i.status !== "resolved");
  const resolved = DEMO_INCIDENTS.filter((i) => i.status === "resolved");

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Open incidents */}
        {open.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>En proceso ({open.length})</Text>
            {open.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </>
        )}

        {/* Resolved */}
        <Text style={styles.sectionTitle}>Resueltos ({resolved.length})</Text>
        {resolved.map((inc) => (
          <IncidentCard key={inc.id} incident={inc} />
        ))}

        {/* Empty state */}
        {DEMO_INCIDENTS.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle" size={48} color="#10B981" />
            <Text style={styles.emptyText}>Sin incidentes activos</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB — report new incident */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalOpen(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <NewIncidentModal visible={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 80 },

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

  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: "#6B7280" },

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

  // Modal
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
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
