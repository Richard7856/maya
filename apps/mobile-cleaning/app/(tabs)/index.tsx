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
import { cleaningApi } from "@maya/api-client";
import type { CleaningAssignment } from "@maya/types";
import { useAuth } from "../../context/auth";

// Time blocks map to 2-hour windows: 1=8-10, 2=10-12, 3=12-14, 4=14-16
const TIME_BLOCKS: Record<number, string> = {
  1: "08:00 – 10:00",
  2: "10:00 – 12:00",
  3: "12:00 – 14:00",
  4: "14:00 – 16:00",
};

const STATUS_CONFIG = {
  scheduled: { label: "Programado", color: "#9CA3AF", icon: "calendar-outline" },
  confirmed: { label: "Pendiente", color: "#F59E0B", icon: "time-outline" },
  in_progress: { label: "En proceso", color: "#3B82F6", icon: "sync-outline" },
  completed: { label: "Completado", color: "#10B981", icon: "checkmark-circle-outline" },
  missed: { label: "No asistió", color: "#EF4444", icon: "close-circle-outline" },
  late: { label: "Tardío", color: "#F97316", icon: "alert-circle-outline" },
} as const;

type AssignmentStatus = keyof typeof STATUS_CONFIG;

// Supabase nested select returns room data under "rooms" key
type AssignmentWithRoom = CleaningAssignment & {
  rooms?: { room_number: string; section?: string | null };
};

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function StatsBar({ assignments }: { assignments: AssignmentWithRoom[] }) {
  const total = assignments.length;
  const done = assignments.filter((a) => a.status === "completed").length;
  const inProgress = assignments.filter((a) => a.status === "in_progress").length;
  const pending = total - done - inProgress;

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
        <Text style={[styles.statNum, { color: "#F59E0B" }]}>{pending}</Text>
        <Text style={styles.statLabel}>Pendientes</Text>
      </View>
    </View>
  );
}

function AssignmentCard({
  assignment,
  onStart,
}: {
  assignment: AssignmentWithRoom;
  onStart: (id: string) => void;
}) {
  const status = assignment.status as AssignmentStatus;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
  const roomLabel = assignment.rooms?.room_number
    ? `Cuarto ${assignment.rooms.room_number}`
    : `Cuarto ${assignment.room_id.slice(0, 6)}`;

  return (
    <View style={[styles.card, assignment.status === "completed" && styles.cardDone]}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardRoom}>{roomLabel}</Text>
          {assignment.rooms?.section && (
            <Text style={styles.cardFloor}>{assignment.rooms.section}</Text>
          )}
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

      {(assignment as any).notes ? (
        <View style={styles.notesRow}>
          <Ionicons name="document-text-outline" size={13} color="#9CA3AF" />
          <Text style={styles.notesText}>{(assignment as any).notes}</Text>
        </View>
      ) : null}

      {(assignment.status === "confirmed" || assignment.status === "scheduled") && (
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
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setError(null);
      const today = todayISO();
      const data = await cleaningApi.listAssignments({
        date_from: today,
        date_to: today,
      });
      // Sort by time block ascending
      setAssignments((data as AssignmentWithRoom[]).sort((a, b) => a.time_block - b.time_block));
    } catch {
      setError("No se pudieron cargar las asignaciones. Verifica tu conexión.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleStart = (id: string) => {
    // Pasa el assignmentId como param para que Session lo cargue
    router.push({ pathname: "/(tabs)/session", params: { assignmentId: id } });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssignments();
  };

  const today = todayISO();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
    >
      {/* Header */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>
          Hola, {profile?.first_name ?? "—"} 👋
        </Text>
        <Text style={styles.dateLabel}>{formatDate(today)}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchAssignments}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <StatsBar assignments={assignments} />

          <Text style={styles.sectionTitle}>Asignaciones de hoy</Text>

          {assignments.map((a) => (
            <AssignmentCard key={a.id} assignment={a} onStart={handleStart} />
          ))}

          {assignments.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Sin asignaciones para hoy</Text>
            </View>
          )}
        </>
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
  retryText: { fontSize: 14, fontWeight: "700", color: "#059669" },

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
