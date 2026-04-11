import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Demo payment history — shows current + last 3 months
const DEMO_PAYMENTS = [
  {
    id: "p-001",
    month: "Mayo 2026",
    amount: 8500,
    due: "05/05/2026",
    paid_at: null,
    status: "pending",
  },
  {
    id: "p-002",
    month: "Abril 2026",
    amount: 8500,
    due: "05/04/2026",
    paid_at: "02/04/2026",
    status: "paid",
  },
  {
    id: "p-003",
    month: "Marzo 2026",
    amount: 8500,
    due: "05/03/2026",
    paid_at: "04/03/2026",
    status: "paid",
  },
  {
    id: "p-004",
    month: "Febrero 2026",
    amount: 8500,
    due: "05/02/2026",
    paid_at: "07/02/2026",
    status: "paid",
  },
];

const STATUS_CONFIG = {
  paid: { label: "Pagado", color: "#10B981", icon: "checkmark-circle" },
  pending: { label: "Pendiente", color: "#7C3AED", icon: "time-outline" },
  overdue: { label: "Vencido", color: "#EF4444", icon: "alert-circle" },
} as const;

type PaymentStatus = keyof typeof STATUS_CONFIG;

function PaymentRow({
  payment,
  onPay,
}: {
  payment: (typeof DEMO_PAYMENTS)[0];
  onPay: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[payment.status as PaymentStatus];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.month}>{payment.month}</Text>
          <Text style={styles.dueLabel}>
            Vence: {payment.due}
          </Text>
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
        {payment.status === "pending" || payment.status === "overdue" ? (
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: cfg.color }]}
            onPress={() => onPay(payment.id)}
            activeOpacity={0.85}
          >
            <Ionicons name="card" size={14} color="#fff" />
            <Text style={styles.payBtnText}>Pagar</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.paidAt}>✓ {payment.paid_at}</Text>
        )}
      </View>
    </View>
  );
}

export default function PaymentsScreen() {
  const pending = DEMO_PAYMENTS.filter((p) => p.status !== "paid");
  const total = pending.reduce((sum, p) => sum + p.amount, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Outstanding banner — shown when there's something due */}
      {pending.length > 0 && (
        <View style={styles.banner}>
          <View>
            <Text style={styles.bannerLabel}>Total pendiente</Text>
            <Text style={styles.bannerAmount}>
              ${total.toLocaleString("es-MX")} MXN
            </Text>
          </View>
          <TouchableOpacity style={styles.bannerBtn} activeOpacity={0.85}>
            <Text style={styles.bannerBtnText}>Pagar todo</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Historial de pagos</Text>

      {DEMO_PAYMENTS.map((p) => (
        <PaymentRow
          key={p.id}
          payment={p}
          onPay={(id) => console.log("Pay", id)}
        />
      ))}

      {/* Info footer */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
        <Text style={styles.infoText}>
          Los pagos se procesan vía Stripe. Tu método de pago está guardado de
          forma segura. Para comprobantes contacta a administración.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 32 },

  banner: {
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  bannerLabel: { color: "#DDD6FE", fontSize: 13, marginBottom: 2 },
  bannerAmount: { color: "#fff", fontSize: 26, fontWeight: "800" },
  bannerBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  bannerBtnText: { color: "#7C3AED", fontWeight: "700", fontSize: 14 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
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
    marginBottom: 14,
  },
  month: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 2 },
  dueLabel: { fontSize: 12, color: "#9CA3AF" },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  amount: { fontSize: 20, fontWeight: "800", color: "#111827" },
  currency: { fontSize: 13, fontWeight: "400", color: "#6B7280" },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  paidAt: { fontSize: 13, color: "#10B981", fontWeight: "600" },

  infoBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  infoText: { fontSize: 12, color: "#6B7280", flex: 1, lineHeight: 18 },
});
