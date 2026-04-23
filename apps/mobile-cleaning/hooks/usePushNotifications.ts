/**
 * usePushNotifications — registra el dispositivo para push notifications
 * y sincroniza el token con el backend (user_profiles.expo_push_token).
 *
 * Cuándo llamarlo: justo después de que el usuario se autentique exitosamente.
 * Es fire-and-forget: si falla (simulador, permisos denegados, sin red)
 * no bloquea el flujo — solo se loggea el error.
 *
 * En simulador/emulador el token no se puede obtener (Device.isDevice = false).
 * En Expo Go funciona con el proyecto de desarrollo.
 * En builds de producción requiere configurar el projectId de EAS.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { usersApi } from "@maya/api-client";

// Configuración de cómo se muestran las notificaciones cuando la app está en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push tokens solo funcionan en dispositivos físicos
  if (!Device.isDevice) {
    console.log("[Push] Simulador/emulador detectado — omitiendo registro de push token.");
    return null;
  }

  // Android: crear canal de notificaciones (requerido en Android 8+)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("maya-default", {
      name: "Maya — Notificaciones",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#7C3AED",
    });
  }

  // Verificar permisos existentes
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Solicitar permisos si aún no se han otorgado
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permisos denegados — no se registrará el push token.");
    return null;
  }

  // Obtener el Expo push token
  // En producción con EAS, pasar: { projectId: Constants.expoConfig?.extra?.eas?.projectId }
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

/**
 * Hook que registra el push token y lo sube al backend.
 * Solo se ejecuta una vez cuando `isAuthenticated` cambia a true.
 */
export function usePushNotifications(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotificationsAsync()
      .then(async (token) => {
        if (!token) return;
        // Sincronizar con el backend — el servidor usa este token en WF-03
        await usersApi.updateMe({ expo_push_token: token });
        console.log("[Push] Token registrado:", token.slice(0, 30) + "…");
      })
      .catch((err) => {
        // No crítico — el sistema funciona sin push (WhatsApp como fallback)
        console.warn("[Push] Error al registrar token:", err?.message);
      });
  }, [isAuthenticated]);
}
