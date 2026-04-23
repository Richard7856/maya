// Pantalla de inicio del inquilino.
// Muestra contrato activo, próximo pago, resumen, y acciones rápidas.
// Todas las tarjetas son tapeables y navegan a la sección correspondiente.
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { leasesApi, incidentsApi, complaintsApi } from "@maya/api-client";
import type { Lease, Incident } from "@maya/types";

type LeaseWithRoom = Lease & {
  rooms?: { room_number: string; section?: string | null };
  buildings?: { name: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextDueDate(paymentDay: number): { date: string; daysLeft: number } {
  const today = new Date();
  let due = new Date(today.getFullYear(), today.getMonth(), paymentDay);
  if (due <= today) {
    due = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.round((due.getTime() - today.getTime()) / msPerDay);
  return {
    date: due.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }),
    daysLeft,
  };
}

function formatEndDate(iso: string | null): string {
  if (!iso) return "Sin fecha fin";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Modal de queja ────────────────────────────────────────────────────────────

const COMPLAINT_CATEGORIES = [
  { key: "ruido",     label: "Ruido",      icon: "volume-high-outline"      },
  { key: "daños",     label: "Daños",      icon: "hammer-outline"           },
  { key: "limpieza",  label: "Limpieza",   icon: "trash-outline"            },
  { key: "seguridad", label: "Seguridad",  icon: "shield-outline"           },
  { key: "otro",      label: "Otro",       icon: "ellipsis-horizontal-circle-outline" },
] as const;

type ComplaintCategory = typeof COMPLAINT_CATEGORIES[number]["key"];

function ComplaintModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [category, setCategory]     = useState<ComplaintCategory>("ruido");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting]  = useState(false);

  const reset = () => { setCategory("ruido"); setDescription(""); setIsAnonymous(true); };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Campo requerido", "Describe la queja antes de enviar.");
      return;
    }
    setSubmitting(true);
    try {
      await complaintsApi.create({ category, description: description.trim(), is_anonymous: isAnonymous });
      reset();
      onClose();
      Alert.alert("Queja enviada", isAnonymous
        ? "Tu queja fue enviada de forma anónima. Administración la revisará pronto."
        : "Tu queja fue enviada. Administración te contactará si necesita más información."
      );
    } catch {
      Alert.alert("Error", "No se pudo enviar la queja. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Reportar queja</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} disabled={submitting}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {/* Categorías */}
          <Text style={styles.label}>¿Qué tipo de queja es?</Text>
          <View style={styles.catGrid}>
            {COMPLAINT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catCard, category === cat.key && styles.catCardActive]}
                onPress={() => setCategory(cat.key)}
                disabled={submitting}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={22}
                  color={category === cat.key ? "#fff" : "#7C3AED"}
                />
                <Text style={[styles.catLabel, category === cat.key && { color: "#fff" }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Descripción */}
          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe el problema con detalle (cuándo ocurre, dónde, etc.)..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={!submitting}
          />

          {/* Anonimato */}
          <View style={styles.anonymousRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.anonymousTitle}>Enviar anónimamente</Text>
              <Text style={styles.anonymousHint}>
                El administrador no verá tu nombre ni habitación.
              </Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ true: "#7C3AED", false: "#E5E7EB" }}
              thumbColor="#fff"
              disabled={submitting}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Enviar queja</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export default function InicioScreen() {
  const router = useRouter();
  const [lease, setLease]               = useState<LeaseWithRoom | null>(null);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [complaintModal, setComplaintModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [leaseData, incidentData] = await Promise.all([
        leasesApi.mine().catch(() => null as LeaseWithRoom | null),
        incidentsApi.list().catch(() => [] as Incident[]),
      ]);
      setLease(leaseData as LeaseWithRoom | null);
      const open = (incidentData as Incident[]).filter(
        (i) => i.status !== "resolved" && i.status !== "closed"
      );
      setOpenIncidents(open.length);
    } catch {
      setError("No se pudo cargar la información. Verifica tu conexión.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#7C3AED" /></View>;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!lease) {
    return (
      <View style={styles.centered}>
        <Ionicons name="home-outline" size={48} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Sin contrato activo</Text>
        <Text style={styles.emptyDesc}>Contacta al administrador de tu edificio.</Text>
      </View>
    );
  }

  const roomLabel     = lease.rooms?.room_number ? `Cuarto ${lease.rooms.room_number}` : "—";
  const buildingLabel = (lease as any).buildings?.name ?? "";
  const { date: dueDate, daysLeft } = nextDueDate(lease.payment_day);
  const isOverdue     = daysLeft < 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Text style={styles.greeting}>Bienvenido 👋</Text>
          <Text style={styles.roomLabel}>{roomLabel}{buildingLabel ? ` · ${buildingLabel}` : ""}</Text>
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Text style={[styles.badgeText, { color: "#fff" }]}>Contrato activo</Text>
          </View>
        </View>

        {/* ── Próximo pago — tapeable → tab pagos ── */}
        <TouchableOpacity
          style={[styles.paymentCard, { borderTopColor: isOverdue ? "#EF4444" : "#7C3AED" }]}
          onPress={() => router.push("/(tabs)/payments")}
          activeOpacity={0.85}
        >
          <View style={styles.paymentHeader}>
            <Text style={styles.paymentTitle}>Próximo pago</Text>
            <View style={[styles.badge, { backgroundColor: (isOverdue ? "#EF4444" : "#7C3AED") + "18" }]}>
              <Text style={[styles.badgeText, { color: isOverdue ? "#EF4444" : "#7C3AED" }]}>
                {isOverdue ? "Vencido" : "Pendiente"}
              </Text>
            </View>
          </View>
          <Text style={[styles.paymentAmount, { color: isOverdue ? "#EF4444" : "#7C3AED" }]}>
            ${Number(lease.monthly_rate).toLocaleString("es-MX")} MXN
          </Text>
          <Text style={styles.paymentDue}>
            Día {lease.payment_day} de cada mes
            <Text style={{ color: "#9CA3AF" }}> · Próx: {dueDate}</Text>
          </Text>
          {isOverdue && (
            <View style={styles.overdueWarning}>
              <Ionicons name="warning-outline" size={14} color="#EF4444" />
              <Text style={styles.overdueText}>Pago vencido — contacta a administración</Text>
            </View>
          )}
          <View style={styles.cardArrow}>
            <Text style={styles.cardArrowText}>Ver pagos</Text>
            <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        {/* ── Resumen ── */}
        <Text style={styles.sectionTitle}>Resumen</Text>
        <View style={styles.statsGrid}>
          {/* Incidentes → tab incidentes */}
          <TouchableOpacity
            style={[styles.summaryCard, { borderLeftColor: "#F59E0B" }]}
            onPress={() => router.push("/(tabs)/incidents")}
            activeOpacity={0.8}
          >
            <Ionicons name="warning-outline" size={20} color="#F59E0B" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.summaryLabel}>Incidentes abiertos</Text>
              <Text style={styles.summaryValue}>{openIncidents}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Día de pago → tab pagos */}
          <TouchableOpacity
            style={[styles.summaryCard, { borderLeftColor: "#7C3AED" }]}
            onPress={() => router.push("/(tabs)/payments")}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={20} color="#7C3AED" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.summaryLabel}>Día de pago</Text>
              <Text style={styles.summaryValue}>Día {lease.payment_day} de cada mes</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </TouchableOpacity>

          {/* Fin de contrato — solo informativo */}
          <View style={[styles.summaryCard, { borderLeftColor: "#3B82F6" }]}>
            <Ionicons name="document-text-outline" size={20} color="#3B82F6" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.summaryLabel}>Fin de contrato</Text>
              <Text style={styles.summaryValue}>{formatEndDate(lease.end_date ?? null)}</Text>
            </View>
          </View>

          {/* Código de acceso → tab acceso */}
          <TouchableOpacity
            style={[styles.summaryCard, { borderLeftColor: "#10B981" }]}
            onPress={() => router.push("/(tabs)/access")}
            activeOpacity={0.8}
          >
            <Ionicons name="key-outline" size={20} color="#10B981" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.summaryLabel}>Código de acceso</Text>
              <Text style={styles.summaryValue}>Ver código</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        {/* ── Acciones rápidas ── */}
        <Text style={styles.sectionTitle}>Acciones rápidas</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/incidents")}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="construct-outline" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.actionLabel}>Reportar{"\n"}incidente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setComplaintModal(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="megaphone-outline" size={22} color="#EF4444" />
            </View>
            <Text style={styles.actionLabel}>Reportar{"\n"}queja</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/access")}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: "#D1FAE5" }]}>
              <Ionicons name="person-add-outline" size={22} color="#10B981" />
            </View>
            <Text style={styles.actionLabel}>Acceso{"\n"}visitante</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/payments")}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIcon, { backgroundColor: "#EDE9FE" }]}>
              <Ionicons name="card-outline" size={22} color="#7C3AED" />
            </View>
            <Text style={styles.actionLabel}>Pagar{"\n"}renta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ComplaintModal visible={complaintModal} onClose={() => setComplaintModal(false)} />
    </>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content:   { padding: 16, paddingBottom: 32 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12, backgroundColor: "#F9FAFB" },

  errorText:    { fontSize: 14, color: "#DC2626", textAlign: "center" },
  retryBtn:     { backgroundColor: "#7C3AED", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  emptyTitle:   { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptyDesc:    { fontSize: 14, color: "#9CA3AF", textAlign: "center" },

  hero: { backgroundColor: "#7C3AED", borderRadius: 16, padding: 20, marginBottom: 16 },
  greeting:  { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 4 },
  roomLabel: { fontSize: 14, color: "#DDD6FE", marginBottom: 10 },
  badge:     { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },

  paymentCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 20,
    borderTopWidth: 4, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  paymentHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  paymentTitle:   { fontSize: 15, fontWeight: "600", color: "#374151" },
  paymentAmount:  { fontSize: 32, fontWeight: "800", marginBottom: 4 },
  paymentDue:     { fontSize: 13, color: "#6B7280" },
  overdueWarning: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8 },
  overdueText:    { fontSize: 12, color: "#EF4444" },
  cardArrow:      { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 10, gap: 2 },
  cardArrowText:  { fontSize: 12, color: "#9CA3AF" },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },

  statsGrid:   { gap: 10, marginBottom: 20 },
  summaryCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "center", borderLeftWidth: 4,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  summaryLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#111827" },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  actionCard:  {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, width: "47%",
    alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", textAlign: "center" },

  // Modal
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  modalTitle:  { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalBody:   { padding: 20 },
  label:       { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8, marginTop: 4 },
  catGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  catCard: {
    width: "30%", alignItems: "center", padding: 12, gap: 6, borderRadius: 12,
    backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB",
  },
  catCardActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  catLabel:      { fontSize: 12, fontWeight: "600", color: "#374151", textAlign: "center" },
  input: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontSize: 14, color: "#111827" },
  textarea: { height: 120, paddingTop: 12 },
  anonymousRow:  { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 8, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14 },
  anonymousTitle: { fontSize: 14, fontWeight: "600", color: "#374151" },
  anonymousHint:  { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  submitBtn: { backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, marginBottom: 8 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
