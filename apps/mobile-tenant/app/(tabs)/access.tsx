// Pantalla de código de acceso del inquilino.
// El backend solo devuelve el código si el pago del mes corriente está pagado.
// Si no está pagado → muestra mensaje de acción requerida en lugar del código.
// El historial de accesos se omite en esta versión (endpoint no expuesto aún).
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { paymentsApi } from "@maya/api-client";

type CodeState =
  | { status: "loading" }
  | { status: "ok"; code: string }
  | { status: "payment_required" }
  | { status: "error"; message: string };

function AccessCodeCard({
  codeState,
  onRefresh,
}: {
  codeState: CodeState;
  onRefresh: () => void;
}) {
  const [visible, setVisible] = useState(false);

  if (codeState.status === "loading") {
    return (
      <View style={[styles.codeCard, styles.centered]}>
        <ActivityIndicator color="#7C3AED" />
      </View>
    );
  }

  if (codeState.status === "payment_required") {
    return (
      <View style={[styles.codeCard, styles.paymentRequiredBox]}>
        <Ionicons name="lock-closed" size={32} color="#EF4444" />
        <Text style={styles.lockedTitle}>Código no disponible</Text>
        <Text style={styles.lockedDesc}>
          Tu código de acceso solo está disponible cuando el pago del mes corriente está confirmado.
          Realiza tu pago para desbloquearlo.
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={16} color="#7C3AED" />
          <Text style={styles.refreshBtnText}>Verificar estado</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (codeState.status === "error") {
    return (
      <View style={[styles.codeCard, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
        <Text style={styles.errorMsg}>{codeState.message}</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // status === "ok"
  const digits = codeState.code.split("");

  return (
    <View style={styles.codeCard}>
      <Text style={styles.codeLabel}>Tu código de acceso</Text>

      <View style={styles.codeRow}>
        {digits.map((digit, i) => (
          <View key={i} style={styles.digit}>
            <Text style={styles.digitText}>{visible ? digit : "•"}</Text>
          </View>
        ))}
      </View>

      <View style={styles.codeActions}>
        <TouchableOpacity
          style={styles.codeBtn}
          onPress={() => setVisible((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={16}
            color="#7C3AED"
          />
          <Text style={styles.codeBtnText}>{visible ? "Ocultar" : "Mostrar"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.codeBtn}
          onPress={() =>
            Alert.alert(
              "Solicitar nuevo código",
              "¿Deseas solicitar un cambio de código de acceso? Se notificará a administración.",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Solicitar", onPress: () => {} },
              ]
            )
          }
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={16} color="#7C3AED" />
          <Text style={styles.codeBtnText}>Cambiar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.codeWarning}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#6B7280" />
        <Text style={styles.codeWarningText}>
          No compartas este código. Es único para tu habitación.
        </Text>
      </View>
    </View>
  );
}

function GuestAccessCard() {
  return (
    <View style={styles.guestCard}>
      <View style={styles.guestHeader}>
        <Ionicons name="person-add-outline" size={20} color="#7C3AED" />
        <Text style={styles.guestTitle}>Acceso para invitados</Text>
      </View>
      <Text style={styles.guestDesc}>
        Genera un código temporal de 24 horas para que un invitado pueda acceder sin necesitar
        tu código principal.
      </Text>
      <TouchableOpacity
        style={styles.guestBtn}
        activeOpacity={0.85}
        onPress={() =>
          Alert.alert("Próximamente", "Esta función estará disponible en la siguiente versión.")
        }
      >
        <Ionicons name="add-circle-outline" size={16} color="#fff" />
        <Text style={styles.guestBtnText}>Generar código de invitado</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AccessScreen() {
  const [codeState, setCodeState] = useState<CodeState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const fetchCode = useCallback(async () => {
    setCodeState({ status: "loading" });
    try {
      const data = await paymentsApi.getAccessCode();
      setCodeState({ status: "ok", code: data.access_code });
    } catch (e: any) {
      const httpStatus = e?.response?.status;
      if (httpStatus === 403 || httpStatus === 404 || httpStatus === 422) {
        // Backend retorna error cuando el pago del mes no está pagado
        setCodeState({ status: "payment_required" });
      } else {
        setCodeState({ status: "error", message: "No se pudo cargar el código de acceso." });
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCode();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#7C3AED"
        />
      }
    >
      <AccessCodeCard codeState={codeState} onRefresh={fetchCode} />
      <GuestAccessCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, paddingBottom: 32 },

  centered: { alignItems: "center", paddingVertical: 32, gap: 12 },

  codeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  paymentRequiredBox: {
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  lockedTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  lockedDesc: { fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 20 },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
    marginTop: 4,
  },
  refreshBtnText: { color: "#7C3AED", fontWeight: "600", fontSize: 13 },

  errorMsg: { fontSize: 14, color: "#DC2626", textAlign: "center" },
  retryText: { fontSize: 14, fontWeight: "700", color: "#7C3AED" },

  codeLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 16 },
  codeRow: { flexDirection: "row", gap: 12, justifyContent: "center", marginBottom: 20 },
  digit: {
    width: 54,
    height: 60,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  digitText: { fontSize: 28, fontWeight: "800", color: "#7C3AED" },
  codeActions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  codeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#7C3AED",
  },
  codeBtnText: { color: "#7C3AED", fontWeight: "600", fontSize: 13 },
  codeWarning: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 10,
  },
  codeWarningText: { fontSize: 12, color: "#6B7280", flex: 1 },

  guestCard: {
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  guestHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  guestTitle: { fontSize: 15, fontWeight: "700", color: "#5B21B6" },
  guestDesc: { fontSize: 13, color: "#6D28D9", lineHeight: 18, marginBottom: 14 },
  guestBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  guestBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
