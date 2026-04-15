// Pantalla de inicio del inquilino.
// Muestra: datos del contrato activo, próxima fecha de pago (calculada del lease),
// count de incidentes abiertos, y resumen del contrato.
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { leasesApi, incidentsApi } from "@maya/api-client";
import type { Lease, Incident } from "@maya/types";

// Lease con datos de habitación joinados por Supabase
type LeaseWithRoom = Lease & {
  rooms?: { room_number: string; section?: string | null };
  buildings?: { name: string };
};

function nextDueDate(paymentDay: number): { date: string; daysLeft: number } {
  const today = new Date();
  let due = new Date(today.getFullYear(), today.getMonth(), paymentDay);
  // Si el día ya pasó este mes, apuntar al siguiente
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
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={[styles.summaryCard, { borderLeftColor: accent }]}>
      <Ionicons name={icon} size={20} color={accent} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function InicioScreen() {
  const [lease, setLease] = useState<LeaseWithRoom | null>(null);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
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

  // Sin contrato activo
  if (!lease) {
    return (
      <View style={styles.centered}>
        <Ionicons name="home-outline" size={48} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Sin contrato activo</Text>
        <Text style={styles.emptyDesc}>Contacta al administrador de tu edificio.</Text>
      </View>
    );
  }

  const roomLabel = lease.rooms?.room_number ? `Cuarto ${lease.rooms.room_number}` : "—";
  const buildingLabel = (lease as any).buildings?.name ?? "";
  const { date: dueDate, daysLeft } = nextDueDate(lease.payment_day);
  const isOverdue = daysLeft < 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
    >
      {/* Welcome header */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>Bienvenido 👋</Text>
        <Text style={styles.roomLabel}>
          {roomLabel}{buildingLabel ? ` · ${buildingLabel}` : ""}
        </Text>
        <StatusBadge label="Contrato activo" color="#10B981" />
      </View>

      {/* Next payment card */}
      <View style={[styles.paymentCard, { borderTopColor: isOverdue ? "#EF4444" : "#7C3AED" }]}>
        <View style={styles.paymentHeader}>
          <Text style={styles.paymentTitle}>Próximo pago</Text>
          <StatusBadge
            label={isOverdue ? "Vencido" : "Pendiente"}
            color={isOverdue ? "#EF4444" : "#7C3AED"}
          />
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
      </View>

      {/* Quick stats */}
      <Text style={styles.sectionTitle}>Resumen</Text>
      <View style={styles.statsGrid}>
        <SummaryCard
          icon="warning-outline"
          label="Incidentes abiertos"
          value={String(openIncidents)}
          accent="#F59E0B"
        />
        <SummaryCard
          icon="calendar-outline"
          label="Día de pago"
          value={`Día ${lease.payment_day} de cada mes`}
          accent="#7C3AED"
        />
        <SummaryCard
          icon="document-text-outline"
          label="Fin de contrato"
          value={formatEndDate(lease.end_date ?? null)}
          accent="#3B82F6"
        />
        <SummaryCard
          icon="home-outline"
          label="Estado del contrato"
          value={lease.status === "active" ? "Activo" : lease.status}
          accent="#10B981"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 32 },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
    backgroundColor: "#F9FAFB",
  },
  errorText: { fontSize: 14, color: "#DC2626", textAlign: "center" },
  retryBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptyDesc: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },

  hero: {
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 4 },
  roomLabel: { fontSize: 14, color: "#DDD6FE", marginBottom: 10 },

  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },

  paymentCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderTopWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentTitle: { fontSize: 15, fontWeight: "600", color: "#374151" },
  paymentAmount: { fontSize: 32, fontWeight: "800", marginBottom: 4 },
  paymentDue: { fontSize: 13, color: "#6B7280" },
  overdueWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 8,
  },
  overdueText: { fontSize: 12, color: "#EF4444" },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  statsGrid: { gap: 10, marginBottom: 20 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#111827" },
});
