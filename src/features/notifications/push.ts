import { requireSupabase, VAPID_PUBLIC_KEY } from "../../lib/supabase";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export interface PushResult {
  ok: boolean;
  message: string;
}

/**
 * Ask for permission only from a clear user action, register the service
 * worker and store the subscription against the signed-in user.
 */
export async function enablePush(): Promise<PushResult> {
  if (!isPushSupported()) {
    return { ok: false, message: "This browser does not support notifications." };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, message: "Push is not configured for this deployment." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Notification permission was not granted." };
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js");
    await navigator.serviceWorker.ready;

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));

    const supabase = requireSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Please sign in again to enable notifications." };

    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint ?? "",
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        platform: navigator.userAgent.includes("Android") ? "android" : "web",
        last_seen_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: "endpoint" },
    );

    if (error) throw new Error(error.message);
    return { ok: true, message: "Notifications enabled." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not enable notifications.",
    };
  }
}

export async function disablePush(): Promise<PushResult> {
  if (!isPushSupported()) return { ok: true, message: "Notifications are not available here." };
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return { ok: true, message: "Notifications were already off." };

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const supabase = requireSupabase();
    await supabase.from("push_subscriptions").update({ is_active: false }).eq("endpoint", endpoint);
    return { ok: true, message: "Notifications turned off." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not turn notifications off." };
  }
}

/** Best-effort nudge to the server-side sender after a status change. */
export async function requestPushSend(orderId: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) return;
  try {
    const {
      data: { session },
    } = await requireSupabase().auth.getSession();
    if (!session) return;
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ order_id: orderId }),
    });
  } catch {
    // Push is best effort - a failure here must never break the status update.
  }
}
