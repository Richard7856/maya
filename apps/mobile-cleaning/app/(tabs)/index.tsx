import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// Time blocks map to 2-hour windows: 1=8-10, 2=10-12, 3=12-14, 4=14-16
const TIME_BLOCKS: Record<number, string> = {
  1: "08:00 – 10:00",
  2: "10:00 – 12:00",
  3: "12:00 – 14:00",
  4: "14:00 – 16:00",
};

// Demo assignments for today
const DEMO = {
  cleaner: { name: "María López" },
  date: "09/04/2026",
  building: "Torre Norte",
  assignments: [
    {
      id: "ca-001",
      room: "201-A",
      floor: 2,
      time_block: 1,
      status: "completed",
      notes: "Limpiar baño a fondo",
    },
    {
      id: "ca-002",
      room: "301-B",
      floor: 3,
      time_block: 2,
      status: "in_progress",
      notes: "",
    },
    {
      id: "ca-003",
      room: "302-A",
      floor: 3,
      time_block: 3,
      status: "confirmed",
      notes: "Inquilino pidió no molestar antes de las 12",
    },
    {
      id: "ca-004",
      room: "401-C",
      floor: 4,
      time_block: 4,
      status: "confirmed",
      notes: "",
    },
  ],
};

const STATUS_CONFIG = {
  confirmed: { label: "Pendiente", color: "#F59E0B", icon: "time-outline" },
  in_progress: { label: "En proceso", color: "#3B82F6", icon: "sync-outline" },
  completed: { label: "Completado", color: "#10B981", icon: "checkmark-circle-outline" },
  cancelled: { label: "Cancelado", color: "#EF4444", icon: "close-circle-outline" },
} as const;

type AssignmentStatus = keyof typeof STATUS_CONFIG;

function StatsBar() {
  const total = DEMO.assignments.length;
  const done = DEMO.assignments.filter((a) => a.status === "completed").length;
  const inProgress = DEMO.assignments.filter((a) => a.status === "in_progress").length;

  return (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Text style={styles.statNum}>{total}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNum, { color: "#10B981" }]}>{done}</Text>
        <Text style={styles.statLabel}>Completadas</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNum, { color: "#3B82F6" }]}>{inProgress}</Text>
        <Text style={styles.statLabel}>En proceso</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNum, { color: "#F59E0B" }]}>{total - done - inProgress}</Text>
        <Text style={styles.statLabel}>Pendientes</Text>
      </View>
    </View>
  );
}

function AssignmentCard({
  assignment,
  onStart,
}: {
  assignment: (typeof DEMO.assignments)[0];
  onStart: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[assignment.status as AssignmentStatus];

  return (
    <View style={[styles.card, assignment.status === "completed" && styles.cardDone]}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardRoom}>Cuarto {assignment.room}</Text>
          <Text style={styles.cardFloor}>Piso {assignment.floor}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.color + "18" }]}>
          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={14} color="#9CA3AF" />
        <Text style={styles.timeText}>
          Bloque {assignment.time_block} · {TIME_BLOCKS[assignment.time_block]}
        </Text>
      </View>

      {assignment.notes ? (
        <View style={styles.notesRow}>
          <Ionicons name="document-text-outline" size={13} color="#9CA3AF" />
          <Text style={styles.notesText}>{assignment.notes}</Text>
        </View>
      ) : null}

      {assignment.status === "confirmed" && (
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => onStart(assignment.id)}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={14} color="#fff" />
          <Text style={styles.startBtnText}>Iniciar limpieza</Text>
        </TouchableOpacity>
      )}

      {assignment.status === "in_progress" && (
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: "#3B82F6" }]}
          onPress={() => onStart(assignment.id)}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-forward" size={14} color="#fff" />
          <Text style={styles.startBtnText}>Continuar / Completar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function IndexScreen() {
  const router = useRouter();

  const handleStart = (id: string) => {
    // In production: navigate to session screen with assignment ID
    router.push("/session");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>Hola, {DEMO.cleaner.name.split(" ")[0]} 👋</Text>
        <Text style={styles.dateLabel}>
          {DEMO.date} · {DEMO.building}
        </Text>
      </View>

      <StatsBar />

      <Text style={styles.sectionTitle}>Asignaciones de hoy</Text>

      {DEMO.assignments.sort((a, b) => a.time_block - b.time_block).map((a) => (
        <AssignmentCard key={a.id} assignment={a} onStart={handleStart} />
      ))}

      {DEMO.assignments.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>Sin asignaciones para hoy</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 32 },

  hero: {
    backgroundColor: "#059669",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  greeting: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 4 },
  dateLabel: { fontSize: 13, color: "#A7F3D0" },

  statsBar: {
    backgroundColor: "#fff",
    borderRadius: 14,
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: "#111827" },
  statLabel: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#F3F4F6" },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
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
  cardDone: { opacity: 0.65 },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardRoom: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 2 },
  cardFloor: { fontSize: 12, color: "#9CA3AF" },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  timeText: { fontSize: 13, color: "#6B7280" },

  notesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  notesText: { fontSize: 12, color: "#92400E", flex: 1 },

  startBtn: {
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: "#6B7280" },
});
