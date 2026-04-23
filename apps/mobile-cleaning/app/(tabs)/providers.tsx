/**
 * Tab Proveedores — app de limpieza.
 * Muestra el directorio filtrable por zona y categoría.
 * Tap en teléfono → llama; tap en WA → abre WhatsApp.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { providersApi } from "@maya/api-client";
import type { Provider, ProviderCategory } from "@maya/api-client";

const CATEGORIES: { value: ProviderCategory | ""; label: string }[] = [
  { value: "",            label: "Todos" },
  { value: "plumbing",    label: "Plomería" },
  { value: "electrical",  label: "Eléctrico" },
  { value: "cleaning",    label: "Limpieza" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "security",    label: "Seguridad" },
  { value: "appliances",  label: "Electrod." },
  { value: "telecom",     label: "Telecom" },
  { value: "other",       label: "Otro" },
];

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  plumbing:    "Plomería",
  electrical:  "Eléctrico",
  cleaning:    "Limpieza",
  maintenance: "Mantenimiento",
  security:    "Seguridad",
  appliances:  "Electrodomésticos",
  telecom:     "Telecom",
  other:       "Otro",
};

export default function ProvidersTab() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState("");
  const [category, setCategory] = useState<ProviderCategory | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await providersApi.list({
        zone: zone.trim() || undefined,
        category: category || undefined,
        active_only: true,
      });
      setProviders(data);
    } finally {
      setLoading(false);
    }
  }, [zone, category]);

  useEffect(() => { load(); }, [load]);

  const callPhone = (phone: string) => Linking.openURL(`tel:${phone}`);
  const openWhatsApp = (wa: string) => {
    const num = wa.replace(/\D/g, "");
    Linking.openURL(`https://wa.me/${num}`);
  };

  const renderItem = ({ item }: { item: Provider }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{CATEGORY_LABELS[item.category]}</Text>
        </View>
      </View>

      {item.zone && (
        <Text style={styles.zone}>📍 {item.zone}</Text>
      )}

      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
      )}

      <View style={styles.actions}>
        {item.phone && (
          <Pressable style={[styles.actionBtn, styles.callBtn]} onPress={() => callPhone(item.phone!)}>
            <Text style={styles.callText}>📞 Llamar</Text>
          </Pressable>
        )}
        {item.whatsapp && (
          <Pressable style={[styles.actionBtn, styles.waBtn]} onPress={() => openWhatsApp(item.whatsapp!)}>
            <Text style={styles.waText}>💬 WhatsApp</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search por zona */}
      <TextInput
        style={styles.searchInput}
        placeholder="🔍  Buscar por zona (Roma, Interlomas…)"
        placeholderTextColor="#9CA3AF"
        value={zone}
        onChangeText={setZone}
        returnKeyType="search"
      />

      {/* Filtros de categoría */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
        renderItem={({ item: cat }) => (
          <Pressable
            style={[styles.catChip, category === cat.value && styles.catChipActive]}
            onPress={() => setCategory(cat.value as ProviderCategory | "")}
          >
            <Text style={[styles.catChipText, category === cat.value && styles.catChipTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        )}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#059669" size="large" />
      ) : providers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay proveedores con ese filtro.</Text>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  searchInput: {
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 14,
    backgroundColor: "#FFF",
    color: "#111827",
  },
  categoryScroll: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFF",
  },
  catChipActive: { backgroundColor: "#059669", borderColor: "#059669" },
  catChipText: { fontSize: 13, color: "#374151" },
  catChipTextActive: { color: "#FFF", fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: "#111827" },
  categoryBadge: {
    backgroundColor: "#D1FAE5",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: { fontSize: 11, color: "#065F46", fontWeight: "600" },
  zone: { fontSize: 12, color: "#6B7280" },
  notes: { fontSize: 12, color: "#6B7280", lineHeight: 17 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  callBtn: { backgroundColor: "#EFF6FF" },
  waBtn: { backgroundColor: "#F0FDF4" },
  callText: { fontSize: 13, color: "#1D4ED8", fontWeight: "600" },
  waText: { fontSize: 13, color: "#15803D", fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, color: "#9CA3AF" },
});
