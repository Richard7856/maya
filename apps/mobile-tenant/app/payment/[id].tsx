// Pantalla de detalle de un pago.
// Carga los pagos del tenant y filtra por ID para mostrar el detalle.
// Si el pago está pendiente/vencido muestra el botón "Pagar" (Stripe via PaymentSheet).
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useLayoutEffect } from "react";
import { paymentsApi } from "@maya/api-client";
import type { Payment } from "@maya/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid:    { label: "Pagado",    color: "#10B981", icon: "checkmark-circle"   },
  pending: { label: "Pendiente", color: "#7C3AED", icon: "time-outline"       },
  overdue: { label: "Vencido",   color: "#EF4444", icon: "alert-circle"       },
  failed:  { label: "Fallido",   color: "#EF4444", icon: "close-circle"       },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function InfoRow({ icon, label, value, accent }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={accent ?? "#7C3AED"} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, accent ? { color: accent } : {}]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Título dinámico en el header
  useLayoutEffect(() => {
    if (payment) {
      const month = new Date(payment.due_date).toLocaleDateString("es-MX", {
        month: "long", year: "numeric",
      });
      navigation.setOptions({ title: `Pago ${month}` });
    }
  }, [payment, navigation]);

  const load = async () => {
    try {
      setError(null);
      // mine() usa /payments/mine — tenant-scoped. list() es admin-only (daría 403)
      const payments = await paymentsApi.mine();
      const found = payments.find((p) => p.id === id);
      if (!found) throw new Error("Pago no encontrado");
      setPayment(found);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cargar el pago.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // Inicia el flujo de pago con Stripe.
  // Por ahora muestra un Alert informativo — el PaymentSheet se integra con @stripe/stripe-react-native
  // que aún no está instalado (ver DECISIONS.md, Milestone 1).
  const handlePay = async () => {
    if (!payment) return;
    setPaying(true);
    try {
      const intent = await paymentsApi.createIntent(payment.id);
      // TODO (Milestone 1): inicializar Stripe PaymentSheet con intent.client_secret
      // Por ahora informamos al usuario que el pago fue iniciado
      Alert.alert(
        "Pago iniciado",
        `Referencia: ${intent.payment_id}\nMonto: $${(intent.amount / 100).toLocaleString("es-MX")} MXN\n\nEn producción aquí se abrirá la pantalla de tarjeta de Stripe.`,
      );
      await load(); // refrescar estado
    } catch {
      Alert.alert("Error", "No se pudo iniciar el pago. Intenta de nuevo.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (error || !payment) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text style={styles.errorText}>{error ?? "Pago no encontrado"}</Text>
        <TouchableOpacity onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusKey = payment.status as keyof typeof STATUS_CONFIG;
  const status    = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
  const isPending = payment.status === "pending" || payment.status === "overdue";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Monto destacado ── */}
      <View style={styles.amountCard}>
        <View style={[styles.badge, { backgroundColor: status.color + "20" }]}>
          <Ionicons name={status.icon as any} size={14} color={status.color} />
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.amount}>
          ${payment.amount.toLocaleString("es-MX")}
          <Text style={styles.currency}> MXN</Text>
        </Text>
        <Text style={styles.amountLabel}>Renta mensual</Text>
      </View>

      {/* ── Información del pago ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalles</Text>
        <View style={styles.infoCard}>
          <InfoRow
            icon="calendar-outline"
            label="Fecha de vencimiento"
            value={formatDate(payment.due_date)}
            accent={payment.status === "overdue" ? "#EF4444" : undefined}
          />
          {payment.paid_at && (
            <InfoRow
              icon="checkmark-done-outline"
              label="Pagado el"
              value={formatDateTime(payment.paid_at)}
              accent="#10B981"
            />
          )}
          {payment.stripe_payment_intent_id && (
            <InfoRow
              icon="receipt-outline"
              label="Referencia Stripe"
              value={payment.stripe_payment_intent_id.slice(0, 24) + "…"}
            />
          )}
        </View>
      </View>

      {/* ── Comprobante ── */}
      {payment.receipt_url && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comprobante</Text>
          <TouchableOpacity
            style={styles.receiptBtn}
            onPress={() => Linking.openURL(payment.receipt_url!)}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={20} color="#7C3AED" />
            <Text style={styles.receiptBtnText}>Ver comprobante de pago</Text>
            <Ionicons name="open-outline" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Botón pagar ── */}
      {isPending && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: status.color }, paying && { opacity: 0.6 }]}
            onPress={handlePay}
            disabled={paying}
            activeOpacity={0.85}
          >
            {paying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.payBtnText}>
                  Pagar ${payment.amount.toLocaleString("es-MX")} MXN
                </Text>
              </>
            )}
          </TouchableOpacity>
          {payment.status === "overdue" && (
            <Text style={styles.overdueHint}>
              ⚠️ Este pago está vencido. Paga lo antes posible para evitar el bloqueo de tu cuenta.
            </Text>
          )}
        </View>
      )}

      {/* ── Info de pago exitoso ── */}
      {payment.status === "paid" && !payment.receipt_url && (
        <View style={styles.paidBox}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.paidText}>Pago registrado correctamente.</Text>
        </View>
      )}
    </ScrollView>
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

  amountCard: {
    backgroundColor: "#7C3AED", borderRadius: 20, padding: 24,
    alignItems: "center", marginBottom: 16,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12,
  },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  amount:     { fontSize: 42, fontWeight: "800", color: "#fff" },
  currency:   { fontSize: 18, fontWeight: "400", color: "#DDD6FE" },
  amountLabel:{ fontSize: 14, color: "#DDD6FE", marginTop: 4 },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13, fontWeight: "700", color: "#6B7280",
    textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8,
  },
  infoCard: {
    backgroundColor: "#fff", borderRadius: 14,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    overflow: "hidden",
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

  receiptBtn: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  receiptBtnText: { flex: 1, fontSize: 14, color: "#7C3AED", fontWeight: "600" },

  payBtn: {
    borderRadius: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: "#7C3AED", shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  payBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  overdueHint: { fontSize: 12, color: "#EF4444", textAlign: "center", marginTop: 10, lineHeight: 18 },

  paidBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#ECFDF5", borderRadius: 12, padding: 16,
  },
  paidText: { fontSize: 14, color: "#065F46", fontWeight: "600" },
});
