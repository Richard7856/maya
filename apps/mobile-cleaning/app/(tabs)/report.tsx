/**
 * Pantalla de reporte de desperfectos.
 *
 * Permite al personal de limpieza documentar un problema encontrado en una
 * habitación: toma foto con la cámara, describe el daño, elige prioridad y
 * envía. El ticket aparece inmediatamente en el dashboard web del admin.
 *
 * Flujo de foto:
 *   1. ImagePicker abre la cámara y devuelve la imagen en base64.
 *   2. Se obtiene una presigned URL del backend (POST /storage/presign).
 *   3. Se convierte base64 → Blob y se hace PUT a la URL firmada.
 *   4. La public_url resultante se guarda como evidence_url en el ticket.
 *
 * Nota: requiere que el bucket 'incidents' exista en Supabase Storage
 * con acceso público (Dashboard → Storage → New bucket → Public).
 */
import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image, Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { buildingsApi, ticketsApi, storageApi } from "@maya/api-client";
import type { RoomWithBuilding } from "@maya/api-client";
import type { IncidentPriority } from "@maya/types";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRIORITIES: Array<{ value: IncidentPriority; label: string; color: string }> = [
  { value: "low",    label: "Baja",    color: "#6B7280" },
  { value: "medium", label: "Media",   color: "#F59E0B" },
  { value: "high",   label: "Alta",    color: "#EF4444" },
  { value: "urgent", label: "Urgente", color: "#7C3AED" },
];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ReportScreen() {
  const [rooms, setRooms]         = useState<RoomWithBuilding[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  const [selectedRoom, setSelectedRoom] = useState("");
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [priority, setPriority]         = useState<IncidentPriority>("medium");

  const [photoUri, setPhotoUri]       = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  // Cargar habitaciones al montar y al hacer focus en la tab
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const data = await buildingsApi.listRooms();
      setRooms(data);
    } catch {
      setError("No se pudieron cargar las habitaciones.");
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadRooms(); }, [loadRooms]));

  function resetForm() {
    setSelectedRoom("");
    setTitle("");
    setDescription("");
    setPriority("medium");
    setPhotoUri(null);
    setPhotoBase64(null);
    setError(null);
    setSuccess(false);
  }

  // ─── Captura de foto ────────────────────────────────────────────────────────

  async function handleTakePhoto() {
    // Solicitar permiso de cámara
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara para tomar la foto del desperfecto.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,   // necesario para el upload multiplataforma
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }

  async function handlePickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a la galería para seleccionar la foto.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }

  // ─── Envío ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedRoom) { setError("Selecciona la habitación afectada."); return; }
    if (!title.trim()) { setError("Escribe un título para el reporte."); return; }
    if (!description.trim()) { setError("Describe el desperfecto encontrado."); return; }

    setError(null);
    setSubmitting(true);

    try {
      let evidenceUrl: string | undefined;

      // 1. Subir foto si existe
      if (photoBase64) {
        const fileName = `evidence/${Date.now()}.jpg`;
        const { upload_url, public_url } = await storageApi.presign(
          "incidents", fileName, "image/jpeg"
        );

        // Convertir base64 → Blob (funciona en Expo Web y React Native)
        const bytes = Uint8Array.from(
          atob(photoBase64),
          (c) => c.charCodeAt(0)
        );
        const blob = new Blob([bytes], { type: "image/jpeg" });
        await storageApi.uploadToPresignedUrl(upload_url, blob, "image/jpeg");

        evidenceUrl = public_url;
      }

      // 2. Crear ticket de mantenimiento
      await ticketsApi.create({
        room_id: selectedRoom,
        type: "maintenance",
        title: title.trim(),
        description: description.trim(),
        priority,
        evidence_url: evidenceUrl,
      });

      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Error desconocido";
      setError(`No se pudo enviar el reporte: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Pantalla de éxito ──────────────────────────────────────────────────────

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={72} color="#059669" />
        </View>
        <Text style={styles.successTitle}>¡Reporte enviado!</Text>
        <Text style={styles.successBody}>
          El ticket aparece ahora en el dashboard del admin para que lo asigne y gestione.
        </Text>
        <TouchableOpacity style={styles.successBtn} onPress={resetForm}>
          <Text style={styles.successBtnText}>Reportar otro desperfecto</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Formulario ─────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>HABITACIÓN AFECTADA</Text>

      {roomsLoading ? (
        <ActivityIndicator color="#059669" style={{ marginBottom: 16 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.roomScroll}
          contentContainerStyle={styles.roomScrollContent}
        >
          {rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={[
                styles.roomChip,
                selectedRoom === room.id && styles.roomChipSelected,
              ]}
              onPress={() => setSelectedRoom(room.id)}
            >
              <Text
                style={[
                  styles.roomChipText,
                  selectedRoom === room.id && styles.roomChipTextSelected,
                ]}
              >
                Hab. {room.room_number}
              </Text>
              {room.buildings && (
                <Text
                  style={[
                    styles.roomChipBuilding,
                    selectedRoom === room.id && styles.roomChipBuildingSelected,
                  ]}
                  numberOfLines={1}
                >
                  {room.buildings.name}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Text style={styles.sectionLabel}>FOTO DEL DESPERFECTO</Text>

      {photoUri ? (
        <View style={styles.photoPreviewContainer}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          <TouchableOpacity
            style={styles.photoRemoveBtn}
            onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}
          >
            <Ionicons name="close-circle" size={28} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
            <Ionicons name="camera-outline" size={22} color="#059669" />
            <Text style={styles.photoBtnText}>Tomar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.photoBtn, styles.photoBtnSecondary]} onPress={handlePickFromGallery}>
            <Ionicons name="images-outline" size={22} color="#6B7280" />
            <Text style={[styles.photoBtnText, styles.photoBtnTextSecondary]}>Galería</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionLabel}>TÍTULO</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Llave del baño rota, ventana atascada…"
        placeholderTextColor="#9CA3AF"
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        editable={!submitting}
      />

      <Text style={styles.sectionLabel}>DESCRIPCIÓN</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Describe dónde está el problema, qué encontraste y desde cuándo parece estar así…"
        placeholderTextColor="#9CA3AF"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!submitting}
      />

      <Text style={styles.sectionLabel}>PRIORIDAD</Text>
      <View style={styles.priorityRow}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[
              styles.priorityChip,
              priority === p.value && { backgroundColor: p.color, borderColor: p.color },
            ]}
            onPress={() => setPriority(p.value)}
          >
            <Text
              style={[
                styles.priorityChipText,
                priority === p.value && { color: "#FFFFFF" },
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name="send-outline" size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Enviar reporte al admin</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#F9FAFB" },
  container: { padding: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
  },

  // Room picker
  roomScroll: { marginBottom: 4 },
  roomScrollContent: { paddingBottom: 8, gap: 8, flexDirection: "row" },
  roomChip: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    minWidth: 80,
    alignItems: "center",
  },
  roomChipSelected: { borderColor: "#059669", backgroundColor: "#ECFDF5" },
  roomChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  roomChipTextSelected: { color: "#059669" },
  roomChipBuilding: { fontSize: 10, color: "#9CA3AF", marginTop: 2, maxWidth: 80 },
  roomChipBuildingSelected: { color: "#6EE7B7" },

  // Foto
  photoButtons: { flexDirection: "row", gap: 10, marginBottom: 4 },
  photoBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1.5, borderColor: "#059669", borderRadius: 10,
    paddingVertical: 14, backgroundColor: "#ECFDF5",
  },
  photoBtnSecondary: { borderColor: "#D1D5DB", backgroundColor: "#F9FAFB" },
  photoBtnText: { fontSize: 14, fontWeight: "600", color: "#059669" },
  photoBtnTextSecondary: { color: "#6B7280" },
  photoPreviewContainer: { position: "relative", marginBottom: 4 },
  photoPreview: { width: "100%", height: 200, borderRadius: 12, backgroundColor: "#E5E7EB" },
  photoRemoveBtn: { position: "absolute", top: 8, right: 8 },

  // Inputs
  input: {
    borderWidth: 1.5, borderColor: "#D1D5DB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#111827", backgroundColor: "#FFFFFF",
  },
  textarea: { minHeight: 100, paddingTop: 12 },

  // Priority
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityChip: {
    flex: 1, alignItems: "center", paddingVertical: 10,
    borderWidth: 1.5, borderColor: "#D1D5DB", borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  priorityChipText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },

  // Error
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF2F2", borderRadius: 8, padding: 12,
    marginTop: 16, borderWidth: 1, borderColor: "#FECACA",
  },
  errorText: { flex: 1, fontSize: 13, color: "#DC2626" },

  // Submit
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: "#059669", borderRadius: 12,
    paddingVertical: 16, marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: "#9CA3AF" },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  // Success
  successContainer: {
    flex: 1, justifyContent: "center", alignItems: "center",
    padding: 32, backgroundColor: "#F9FAFB",
  },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 12 },
  successBody: {
    fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 32,
  },
  successBtn: {
    backgroundColor: "#059669", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
  },
  successBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
