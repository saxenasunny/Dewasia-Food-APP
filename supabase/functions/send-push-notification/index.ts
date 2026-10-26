// ---------------------------------------------------------------------------
// send-push-notification
//
// Server-side only. Reads the PENDING notification_logs queued by the
// log_status_notification() trigger, encrypts a payload for each active push
// subscription and delivers it with VAPID.
//
// Deploy:
//   supabase secrets set VAPID_PRIVATE_KEY=... VAPID_PUBLIC_KEY=... VAPID_SUBJECT=mailto:you@example.com
//   supabase functions deploy send-push-notification
//
// Authorization: the caller's JWT must be the order's owner or an operator.
// A caller presenting the service-role key (e.g. pg_cron) may send for any
// order. Credentials never reach the browser.
// ---------------------------------------------------------------------------

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PUSH_COPY: Record<string, { title: string; body: string }> = {
  ACCEPTED: { title: "Order accepted", body: "The canteen has accepted your order." },
  IN_PROGRESS: { title: "Preparing your order", body: "Your order is being prepared." },
  READY_TO_COLLECT: {
    title: "Your order is ready!",
    body: "Please collect it from the canteen counter.",
  },
  REJECTED: {
    title: "Order update",
    body: "Your order could not be accepted. Open the app for details.",
  },
  CANCELLED: { title: "Order cancelled", body: "Your order has been cancelled." },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:ops@example.com";

  if (!vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "Push is not configured: missing VAPID keys" }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing authorization" }, 401);

  let payload: { order_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!payload.order_id) return json({ error: "order_id is required" }, 400);

  // ---- Who is calling? ----------------------------------------------------
  let callerId: string | null = null;
  let isServiceRole = false;

  if (token === serviceKey) {
    isServiceRole = true;
  } else {
    const asCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await asCaller.auth.getUser(token);
    if (error || !data.user) return json({ error: "Invalid session" }, 401);
    callerId = data.user.id;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, user_id, status, order_number, canteen_id")
    .eq("id", payload.order_id)
    .single();

  if (orderError || !order) return json({ error: "Order not found" }, 404);

  if (!isServiceRole) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", callerId!)
      .single();

    const isOperator = ["operator", "admin"].includes(profile?.role ?? "");
    if (!isOperator && order.user_id !== callerId) {
      return json({ error: "Not allowed to notify for this order" }, 403);
    }
  }

  // ---- Pending notifications for this order -------------------------------
  const { data: logs } = await admin
    .from("notification_logs")
    .select("id, event_type, provider_status")
    .eq("order_id", order.id)
    .eq("provider_status", "PENDING");

  if (!logs || logs.length === 0) {
    return json({ ok: true, sent: 0, note: "Nothing pending" });
  }

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, platform")
    .eq("user_id", order.user_id)
    .eq("is_active", true);

  if (subsError) return json({ error: subsError.message }, 500);

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let sent = 0;
  const results: string[] = [];

  for (const log of logs) {
    const copy = PUSH_COPY[log.event_type];
    if (!copy) {
      await admin
        .from("notification_logs")
        .update({ provider_status: "SKIPPED_NO_COPY" })
        .eq("id", log.id);
      continue;
    }

    if (!subs || subs.length === 0) {
      await admin
        .from("notification_logs")
        .update({ provider_status: "NO_SUBSCRIPTION" })
        .eq("id", log.id);
      results.push(`${log.event_type}: no subscription`);
      continue;
    }

    // Minimal lock-screen content: no prices, no items, no names.
    const bodyText = `${copy.body} (${order.order_number})`;

    for (const sub of subs) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: copy.title, body: bodyText, url: `/orders/${order.id}` }),
          { TTL: 3600, urgency: "normal" },
        );
        sent += 1;
        results.push(`${log.event_type}: ok`);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode ?? 0;
        results.push(`${log.event_type}: ${statusCode || "error"}`);

        // 404/410 means the subscription is gone - stop using it.
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
          await admin
            .from("notification_logs")
            .update({ provider_status: `FAILED_${statusCode}` })
            .eq("id", log.id);
        } else {
          await admin
            .from("notification_logs")
            .update({ provider_status: `FAILED_${statusCode || "UNKNOWN"}` })
            .eq("id", log.id);
        }
        continue;
      }
    }

    // Only mark as delivered if at least one endpoint accepted it.
    const anySuccess = results.some((r) => r === `${log.event_type}: ok`);
    await admin
      .from("notification_logs")
      .update({ provider_status: anySuccess ? "SENT" : "FAILED" })
      .eq("id", log.id);
  }

  return json({ ok: true, sent, results });
});
