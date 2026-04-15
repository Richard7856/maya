// Pantalla de sesión de limpieza activa.
// Recibe `assignmentId` como param de ruta desde My Tasks.
// Al iniciar: solicita permiso GPS y registra la sesión en el backend.
// Al completar: envía el checklist al backend.
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { cleaningApi } from "@maya/api-client";
import type { CleaningAssignment } from "@maya/types";

// Checklist estándar — aplica a todas las habitaciones
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

const TIME_BLOCKS: Record<number, string> = {
  1: "08:00 – 10:00",
  2: "10:00 – 12:00",
  3: "12:00 – 14:00",
  4: "14:00 – 16:00",
};

type AssignmentWithRoom = CleaningAssignment & {
  rooms?: { room_number: string; section?: string | null };
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
  disabled,
}: {
  section: string;
  items: typeof CHECKLIST_ITEMS;
  checked: Set<string>;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{section}</Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.checkItem}
          onPress={() => !disabled && onToggle(item.id)}
          activeOpacity={disabled ? 1 : 0.7}
        >
          <View style={[styles.checkbox, checked.has(item.id) && styles.checkboxDone]}>
            {checked.has(item.id) && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
          <Text style={[styles.checkLabel, checked.has(item.id) && styles.checkLabelDone]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SessionScreen() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId?: string }>();
  const router = useRouter();

  const [assignment, setAssignment] = useState<AssignmentWithRoom | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);

  const [started, setStarted] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [gpsStatus, setGpsStatus] = useState<"idle" | "granted" | "denied">("idle");

  const timer = useTimer(started);
  const totalItems = CHECKLIST_ITEMS.length;
  const checkedCount = checked.size;
  const progress = totalItems > 0 ? checkedCount / totalItems : 0;
  const allDone = checkedCount === totalItems;
  const sections = Array.from(new Set(CHECKLIST_ITEMS.map((i) => i.section)));

  // Carga los detalles de la asignación si se recibe un ID
  useEffect(() => {
    if (!assignmentId) return;
    setLoadingAssignment(true);
    cleaningApi
      .getAssignment(assignmentId)
      .then((data) => setAssignment(data as AssignmentWithRoom))
      .catch(() => Alert.alert("Error", "No se pudo cargar la asignación."))
      .finally(() => setLoadingAssignment(false));
  }, [assignmentId]);

  async function getGpsCoords(): Promise<{ arrival_lat: number; arrival_lng: number } | null> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setGpsStatus("denied");
      return null;
    }
    setGpsStatus("granted");
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return { arrival_lat: loc.coords.latitude, arrival_lng: loc.coords.longitude };
  }

  const handleStart = async () => {
    if (!assignmentId) return;

    Alert.alert(
      "Iniciar limpieza",
      "Se registrará tu ubicación GPS al iniciar la sesión.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Iniciar",
          onPress: async () => {
            const coords = await getGpsCoords();
            if (!coords) {
              Alert.alert(
                "GPS requerido",
                "Activa la ubicación para registrar tu llegada.",
                [{ text: "OK" }]
              );
              return;
            }
            try {
              await cleaningApi.startSession(assignmentId, coords);
              setStarted(true);
            } catch (e: any) {
              // Si ya hay sesión activa (segunda visita), continuar de todas formas
              if (e?.response?.status === 409) {
                setStarted(true);
              } else {
                Alert.alert("Error", "No se pudo iniciar la sesión. Intenta de nuevo.");
              }
            }
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
          { text: "Finalizar", style: "destructive", onPress: confirmFinish },
        ]
      );
      return;
    }
    confirmFinish();
  };

  const confirmFinish = async () => {
    if (!assignmentId) return;
    setFinishing(true);

    const checklistPayload = CHECKLIST_ITEMS.map((item) => ({
      label: item.label,
      is_done: checked.has(item.id),
    }));

    try {
      await cleaningApi.completeSession(assignmentId, checklistPayload);
      Alert.alert(
        "Sesión completada",
        `Limpieza del cuarto ${assignment?.rooms?.room_number ?? ""} registrada correctamente. ¡Buen trabajo!`,
        [
          {
            text: "OK",
            onPress: () => {
              setStarted(false);
              setChecked(new Set());
              // Regresa a la lista para ver la siguiente asignación
              router.replace("/(tabs)");
            },
          },
        ]
      );
    } catch {
      Alert.alert("Error", "No se pudo registrar la sesión. Intenta de nuevo.");
    } finally {
      setFinishing(false);
    }
  };

  const toggleItem = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Sin asignación seleccionada — el usuario navegó directo a esta tab
  if (!assignmentId) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={56} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Sin tarea activa</Text>
        <Text style={styles.emptyDesc}>
          Selecciona una asignación desde la pestaña "Mis tareas" para iniciar una sesión.
        </Text>
        <TouchableOpacity style={styles.goToListBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.goToListText}>Ver mis tareas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingAssignment) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const roomLabel = assignment?.rooms?.room_number
    ? `Cuarto ${assignment.rooms.room_number}`
    : "Cargando...";
  const timeRange = assignment ? TIME_BLOCKS[assignment.time_block] : "";

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
            <Text style={styles.heroRoom}>{roomLabel}</Text>
            {assignment?.rooms?.section && (
              <Text style={styles.heroSub}>{assignment.rooms.section} · {timeRange}</Text>
            )}
            {!assignment?.rooms?.section && timeRange && (
              <Text style={styles.heroSub}>{timeRange}</Text>
            )}
          </View>
          {started && (
            <View style={styles.timerBadge}>
              <Ionicons name="timer-outline" size={14} color="#fff" />
              <Text style={styles.timerText}>{timer}</Text>
            </View>
          )}
        </View>

        {/* GPS status */}
        <View style={styles.gpsRow}>
          <Ionicons
            name={gpsStatus === "granted" ? "location" : "location-outline"}
            size={14}
            color={gpsStatus === "granted" ? "#A7F3D0" : "#6EE7B7"}
          />
          <Text style={styles.gpsText}>
            {gpsStatus === "idle"
              ? "GPS se solicitará al iniciar"
              : gpsStatus === "granted"
              ? "Ubicación registrada"
              : "GPS no disponible — activa tu ubicación"}
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

      {/* Checklist — deshabilitado hasta que se inicie la sesión */}
      {sections.map((sec) => (
        <ChecklistSection
          key={sec}
          section={sec}
          items={CHECKLIST_ITEMS.filter((i) => i.section === sec)}
          checked={checked}
          onToggle={toggleItem}
          disabled={!started}
        />
      ))}

      {!started && (
        <Text style={styles.checklistHint}>
          Inicia la sesión para habilitar el checklist.
        </Text>
      )}

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
              style={[styles.finishBtn, allDone && styles.finishBtnReady, finishing && styles.btnDisabled]}
              onPress={handleFinish}
              disabled={finishing}
              activeOpacity={0.85}
            >
              {finishing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>
                    {allDone ? "Finalizar y enviar" : "Finalizar sesión"}
                  </Text>
                </>
              )}
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

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
    backgroundColor: "#F9FAFB",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptyDesc: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },
  goToListBtn: {
    marginTop: 8,
    backgroundColor: "#059669",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  goToListText: { color: "#fff", fontWeight: "700", fontSize: 14 },

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

  checklistHint: {
    textAlign: "center",
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: -4,
    marginBottom: 10,
  },

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
  btnDisabled: { opacity: 0.6 },
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
