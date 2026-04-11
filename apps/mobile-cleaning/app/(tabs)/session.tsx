import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";

// Cleaning checklist items — mirrors typical co-living room checklist
const CHECKLIST_ITEMS = [
  { id: "c1", section: "Baño", label: "Limpiar inodoro" },
  { id: "c2", section: "Baño", label: "Limpiar lavabo y espejo" },
  { id: "c3", section: "Baño", label: "Limpiar regadera / tina" },
  { id: "c4", section: "Baño", label: "Trapear piso de baño" },
  { id: "c5", section: "Cuarto", label: "Tender cama / cambiar sábanas" },
  { id: "c6", section: "Cuarto", label: "Barrer o aspirar piso" },
  { id: "c7", section: "Cuarto", label: "Trapear piso" },
  { id: "c8", section: "Cuarto", label: "Limpiar escritorio y superficies" },
  { id: "c9", section: "Cuarto", label: "Vaciar bote de basura" },
  { id: "c10", section: "General", label: "Reportar daños o faltantes" },
];

// Demo active assignment
const DEMO_ASSIGNMENT = {
  id: "ca-002",
  room: "301-B",
  floor: 3,
  time_block: 2,
  timeRange: "10:00 – 12:00",
  tenant: "Carlos Mendoza",
  notes: "",
};

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function ChecklistSection({
  section,
  items,
  checked,
  onToggle,
}: {
  section: string;
  items: typeof CHECKLIST_ITEMS;
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section}</Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.checkItem}
          onPress={() => onToggle(item.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, checked.has(item.id) && styles.checkboxDone]}>
            {checked.has(item.id) && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
          <Text
            style={[
              styles.checkLabel,
              checked.has(item.id) && styles.checkLabelDone,
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SessionScreen() {
  const [started, setStarted] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [gpsGranted, setGpsGranted] = useState<boolean | null>(null);
  const timer = useTimer(started);

  const totalItems = CHECKLIST_ITEMS.length;
  const checkedCount = checked.size;
  const progress = totalItems > 0 ? checkedCount / totalItems : 0;
  const allDone = checkedCount === totalItems;

  const sections = Array.from(new Set(CHECKLIST_ITEMS.map((i) => i.section)));

  const handleStart = async () => {
    // In production: request expo-location permission, get GPS coords
    // POST /api/v1/cleaning/sessions with { assignment_id, latitude, longitude }
    // For demo: simulate permission grant
    Alert.alert(
      "Iniciar limpieza",
      "Se registrará tu ubicación GPS al iniciar y al finalizar la sesión.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Iniciar",
          onPress: () => {
            setGpsGranted(true);
            setStarted(true);
          },
        },
      ]
    );
  };

  const handleFinish = () => {
    if (!allDone) {
      Alert.alert(
        "Checklist incompleto",
        `Faltan ${totalItems - checkedCount} tarea(s). ¿Deseas finalizar de todas formas?`,
        [
          { text: "Continuar limpiando", style: "cancel" },
          {
            text: "Finalizar",
            style: "destructive",
            onPress: confirmFinish,
          },
        ]
      );
      return;
    }
    confirmFinish();
  };

  const confirmFinish = () => {
    // In production: PATCH /api/v1/cleaning/sessions/{id}/end with GPS + completion data
    Alert.alert("Sesión completada", `Limpieza del cuarto ${DEMO_ASSIGNMENT.room} registrada correctamente. ¡Buen trabajo!`, [
      { text: "OK", onPress: () => setStarted(false) },
    ]);
  };

  const toggleItem = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Assignment info */}
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroRoom}>Cuarto {DEMO_ASSIGNMENT.room}</Text>
            <Text style={styles.heroSub}>Piso {DEMO_ASSIGNMENT.floor} · {DEMO_ASSIGNMENT.timeRange}</Text>
          </View>
          {started && (
            <View style={styles.timerBadge}>
              <Ionicons name="timer-outline" size={14} color="#fff" />
              <Text style={styles.timerText}>{timer}</Text>
            </View>
          )}
        </View>

        {DEMO_ASSIGNMENT.notes ? (
          <View style={styles.notesBox}>
            <Ionicons name="information-circle-outline" size={14} color="#A7F3D0" />
            <Text style={styles.notesText}>{DEMO_ASSIGNMENT.notes}</Text>
          </View>
        ) : null}

        {/* GPS status */}
        <View style={styles.gpsRow}>
          <Ionicons
            name={gpsGranted ? "location" : "location-outline"}
            size={14}
            color={gpsGranted ? "#A7F3D0" : "#6EE7B7"}
          />
          <Text style={styles.gpsText}>
            {gpsGranted === null
              ? "GPS se solicitará al iniciar"
              : gpsGranted
              ? "Ubicación registrada"
              : "GPS no disponible"}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrapper}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Checklist</Text>
          <Text style={styles.progressCount}>{checkedCount}/{totalItems}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      </View>

      {/* Checklist */}
      {sections.map((sec) => (
        <ChecklistSection
          key={sec}
          section={sec}
          items={CHECKLIST_ITEMS.filter((i) => i.section === sec)}
          checked={checked}
          onToggle={toggleItem}
        />
      ))}

      {/* Action buttons */}
      <View style={styles.actions}>
        {!started ? (
          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Iniciar sesión de limpieza</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.finishBtn, allDone && styles.finishBtnReady]}
              onPress={handleFinish}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-done" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>
                {allDone ? "Finalizar y enviar" : "Finalizar sesión"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pauseBtn}
              onPress={() =>
                Alert.alert("Pausar", "La sesión se mantiene activa. El tiempo sigue corriendo.")
              }
              activeOpacity={0.8}
            >
              <Ionicons name="pause" size={16} color="#059669" />
              <Text style={styles.pauseBtnText}>Pausar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
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
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  heroRoom: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 2 },
  heroSub: { fontSize: 13, color: "#A7F3D0" },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#047857",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerText: { color: "#fff", fontWeight: "700", fontSize: 14, fontVariant: ["tabular-nums"] },
  notesBox: { flexDirection: "row", gap: 6, backgroundColor: "#047857", borderRadius: 8, padding: 8, marginBottom: 8 },
  notesText: { fontSize: 12, color: "#A7F3D0", flex: 1 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  gpsText: { fontSize: 12, color: "#A7F3D0" },

  progressWrapper: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  progressCount: { fontSize: 13, fontWeight: "700", color: "#059669" },
  progressTrack: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: "#059669", borderRadius: 3 },

  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: { backgroundColor: "#059669", borderColor: "#059669" },
  checkLabel: { fontSize: 14, color: "#374151", flex: 1 },
  checkLabelDone: { color: "#9CA3AF", textDecorationLine: "line-through" },

  actions: { gap: 10, marginTop: 6 },
  startBtn: {
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finishBtn: {
    backgroundColor: "#6B7280",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finishBtnReady: { backgroundColor: "#059669" },
  pauseBtn: {
    borderWidth: 1.5,
    borderColor: "#059669",
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pauseBtnText: { color: "#059669", fontWeight: "600", fontSize: 14 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
