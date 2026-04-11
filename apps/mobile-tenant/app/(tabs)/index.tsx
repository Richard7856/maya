import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Demo data — represents a typical tenant's current state
const DEMO = {
  tenant: { name: "Carlos Mendoza", room: "301-B", building: "Torre Norte" },
  lease: { status: "active", end_date: "31/08/2026", payment_day: 5 },
  nextPayment: {
    amount: 8500,
    due_date: "05/05/2026",
    status: "pending", // pending | overdue | paid
    daysLeft: 26,
  },
  openIncidents: 1,
  lastAccess: "Hoy 08:32",
};

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
  const isOverdue = DEMO.nextPayment.status === "overdue";
  const isPaid = DEMO.nextPayment.status === "paid";
  const paymentColor = isPaid ? "#10B981" : isOverdue ? "#EF4444" : "#7C3AED";
  const paymentLabel = isPaid ? "Pagado" : isOverdue ? "Vencido" : "Pendiente";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Welcome header */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>Hola, {DEMO.tenant.name.split(" ")[0]} 👋</Text>
        <Text style={styles.roomLabel}>
          Cuarto {DEMO.tenant.room} · {DEMO.tenant.building}
        </Text>
        <StatusBadge label="Contrato activo" color="#10B981" />
      </View>

      {/* Next payment card */}
      <View style={[styles.paymentCard, { borderTopColor: paymentColor }]}>
        <View style={styles.paymentHeader}>
          <Text style={styles.paymentTitle}>Próximo pago</Text>
          <StatusBadge label={paymentLabel} color={paymentColor} />
        </View>

        <Text style={[styles.paymentAmount, { color: paymentColor }]}>
          ${DEMO.nextPayment.amount.toLocaleString("es-MX")} MXN
        </Text>

        <Text style={styles.paymentDue}>
          Vence el {DEMO.nextPayment.due_date}
          {!isPaid && (
            <Text style={{ color: isOverdue ? "#EF4444" : "#6B7280" }}>
              {" "}({isOverdue ? `${DEMO.nextPayment.daysLeft * -1} días de retraso` : `en ${DEMO.nextPayment.daysLeft} días`})
            </Text>
          )}
        </Text>

        {!isPaid && (
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: paymentColor }]}
            activeOpacity={0.85}
          >
            <Ionicons name="card" size={18} color="#fff" />
            <Text style={styles.payBtnText}>Pagar ahora</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick stats */}
      <Text style={styles.sectionTitle}>Resumen</Text>
      <View style={styles.statsGrid}>
        <SummaryCard
          icon="warning-outline"
          label="Incidentes abiertos"
          value={String(DEMO.openIncidents)}
          accent="#F59E0B"
        />
        <SummaryCard
          icon="key-outline"
          label="Último acceso"
          value={DEMO.lastAccess}
          accent="#7C3AED"
        />
        <SummaryCard
          icon="calendar-outline"
          label="Fin de contrato"
          value={DEMO.lease.end_date}
          accent="#3B82F6"
        />
        <SummaryCard
          icon="home-outline"
          label="Día de pago"
          value={`Día ${DEMO.lease.payment_day} de cada mes`}
          accent="#10B981"
        />
      </View>

      {/* Recent activity placeholder */}
      <Text style={styles.sectionTitle}>Actividad reciente</Text>
      <View style={styles.activityCard}>
        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
        <Text style={styles.activityText}>
          Pago de abril recibido — 02/04/2026
        </Text>
      </View>
      <View style={styles.activityCard}>
        <Ionicons name="warning" size={18} color="#F59E0B" />
        <Text style={styles.activityText}>
          Incidente #42 — Fuga en baño (en revisión)
        </Text>
      </View>
      <View style={styles.activityCard}>
        <Ionicons name="log-in-outline" size={18} color="#7C3AED" />
        <Text style={styles.activityText}>
          Acceso registrado — Hoy 08:32
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 32 },

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
  paymentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  paymentTitle: { fontSize: 15, fontWeight: "600", color: "#374151" },
  paymentAmount: { fontSize: 32, fontWeight: "800", marginBottom: 4 },
  paymentDue: { fontSize: 13, color: "#6B7280", marginBottom: 14 },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },

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

  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  activityText: { fontSize: 13, color: "#374151", flex: 1 },
});
