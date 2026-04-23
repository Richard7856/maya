// Pantalla de pagos del inquilino.
// Carga pagos reales desde la API (el backend filtra automáticamente por tenant).
// Cada tarjeta navega al detalle del pago.
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
import { useRouter } from "expo-router";
import { paymentsApi } from "@maya/api-client";
import type { Payment } from "@maya/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid:    { label: "Pagado",    color: "#10B981", icon: "checkmark-circle"  },
  pending: { label: "Pendiente", color: "#7C3AED", icon: "time-outline"      },
  overdue: { label: "Vencido",   color: "#EF4444", icon: "alert-circle"      },
  failed:  { label: "Fallido",   color: "#EF4444", icon: "close-circle"      },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function getMonthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

// ─── Componente de tarjeta ────────────────────────────────────────────────────

function PaymentRow({ payment, onPress }: { payment: Payment; onPress: () => void }) {
  const statusKey = payment.status as keyof typeof STATUS_CONFIG;
  const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.month}>{getMonthLabel(payment.due_date)}</Text>
          <Text style={styles.dueLabel}>Vence: {formatDate(payment.due_date)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.color + "18" }]}>
          <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.amount}>
          ${payment.amount.toLocaleString("es-MX")}{" "}
          <Text style={styles.currency}>MXN</Text>
        </Text>
        {payment.paid_at ? (
          <Text style={styles.paidAt}>✓ {formatDate(payment.paid_at)}</Text>
        ) : (
          <View style={styles.arrowWrap}>
            <Text style={[styles.actionText, { color: cfg.color }]}>
              {payment.status === "overdue" ? "Pagar ahora" : "Ver detalle"}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={cfg.color} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setError(null);
      // mine() usa /payments/mine — endpoint tenant-scoped (list() es admin-only y daría 403)
      const data = await paymentsApi.mine();
      // Ordenar: más reciente primero
      setPayments(data.sort((a, b) =>
        new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
      ));
    } catch {
      setError("No se pudieron cargar los pagos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const onRefresh = () => { setRefreshing(true); fetchPayments(); };

  const pending = payments.filter((p) => p.status !== "paid");
  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
      }
    >
      {/* ── Banner saldo pendiente ── */}
      {!loading && pending.length > 0 && (
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerLabel}>Total pendiente</Text>
            <Text style={styles.bannerAmount}>
              ${totalPending.toLocaleString("es-MX")} MXN
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bannerBtn}
            activeOpacity={0.85}
            onPress={() => pending[0] && router.push(`/payment/${pending[0].id}` as any)}
          >
            <Text style={styles.bannerBtnText}>Pagar ahora</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Historial de pagos</Text>

      {/* ── Estados de carga / error ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchPayments}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : payments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>Sin pagos registrados</Text>
        </View>
      ) : (
        payments.map((p) => (
          <PaymentRow
            key={p.id}
            payment={p}
            onPress={() => router.push(`/payment/${p.id}` as any)}
          />
        ))
      )}

      {/* ── Info footer ── */}
      {!loading && (
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.infoText}>
            Los pagos se procesan vía Stripe. Tu método de pago está guardado de forma segura.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content:   { padding: 16, paddingBottom: 32 },
  centered:  { paddingTop: 40, alignItems: "center" },

  banner: {
    backgroundColor: "#7C3AED", borderRadius: 16, padding: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20,
  },
  bannerLabel:  { color: "#DDD6FE", fontSize: 13, marginBottom: 2 },
  bannerAmount: { color: "#fff", fontSize: 26, fontWeight: "800" },
  bannerBtn: {
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  bannerBtnText: { color: "#7C3AED", fontWeight: "700", fontSize: 14 },

  sectionTitle: {
    fontSize: 14, fontWeight: "700", color: "#6B7280",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 14,
  },
  month:    { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 2 },
  dueLabel: { fontSize: 12, color: "#9CA3AF" },

  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },

  cardFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12,
  },
  amount:   { fontSize: 20, fontWeight: "800", color: "#111827" },
  currency: { fontSize: 13, fontWeight: "400", color: "#6B7280" },
  paidAt:   { fontSize: 13, color: "#10B981", fontWeight: "600" },
  arrowWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionText: { fontSize: 13, fontWeight: "600" },

  errorBox: {
    backgroundColor: "#FEF2F2", borderRadius: 12, padding: 16,
    alignItems: "center", gap: 8, marginTop: 8,
  },
  errorText: { fontSize: 14, color: "#DC2626", textAlign: "center" },
  retryText: { fontSize: 14, fontWeight: "700", color: "#7C3AED" },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText:  { fontSize: 16, color: "#374151", fontWeight: "600" },

  infoBox: {
    flexDirection: "row", gap: 8, backgroundColor: "#F3F4F6",
    borderRadius: 12, padding: 14, marginTop: 8,
  },
  infoText: { fontSize: 12, color: "#6B7280", flex: 1, lineHeight: 18 },
});
