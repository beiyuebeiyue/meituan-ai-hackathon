import * as FileSystem from "expo-file-system";
import { api } from "../api/client";
import { AnalyticsEventName, AnalyticsEventPayload } from "../types/api";

const STORE_URI = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}nailtry-analytics.json`;
const MAX_QUEUE_SIZE = 200;
const FLUSH_BATCH_SIZE = 30;

type AnalyticsStore = {
  anonymousId: string;
  queue: AnalyticsEventPayload[];
};

type TrackOptions = {
  styleId?: string | null;
  tryonJobId?: string | null;
  bookingId?: string | null;
  shopId?: string | null;
  source?: string;
  screen?: string;
  amountCents?: number | null;
  properties?: Record<string, unknown>;
};

let anonymousId: string | null = null;
let sessionId = makeId("sess");
let queue: AnalyticsEventPayload[] = [];
let initialized = false;
let flushing = false;

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

async function readStore(): Promise<AnalyticsStore | null> {
  if (!STORE_URI) return null;
  try {
    const info = await FileSystem.getInfoAsync(STORE_URI);
    if (!info.exists) return null;
    return JSON.parse(await FileSystem.readAsStringAsync(STORE_URI)) as AnalyticsStore;
  } catch {
    return null;
  }
}

async function writeStore() {
  if (!STORE_URI || !anonymousId) return;
  try {
    await FileSystem.writeAsStringAsync(STORE_URI, JSON.stringify({ anonymousId, queue }));
  } catch {
    // Analytics must never block product flows.
  }
}

function sanitizeProperties(properties?: Record<string, unknown>) {
  if (!properties) return {};
  const blocked = new Set(["phone", "contact_phone", "username", "nickname", "content", "message", "prompt", "raw_query"]);
  return Object.fromEntries(Object.entries(properties).filter(([key]) => !blocked.has(key.toLowerCase())));
}

export async function initAnalytics() {
  if (initialized) return;
  const store = await readStore();
  anonymousId = store?.anonymousId ?? makeId("anon");
  queue = store?.queue ?? [];
  initialized = true;
  await writeStore();
}

export async function trackEvent(eventName: AnalyticsEventName, options: TrackOptions = {}) {
  if (!initialized) await initAnalytics();
  const event: AnalyticsEventPayload = {
    event_id: makeId("evt"),
    event_name: eventName,
    anonymous_id: anonymousId,
    session_id: sessionId,
    style_id: options.styleId ?? null,
    tryon_job_id: options.tryonJobId ?? null,
    booking_id: options.bookingId ?? null,
    shop_id: options.shopId ?? null,
    source: options.source ?? "",
    screen: options.screen ?? "",
    amount_cents: options.amountCents ?? null,
    properties: sanitizeProperties(options.properties),
    occurred_at: new Date().toISOString(),
  };
  queue = [...queue.slice(-MAX_QUEUE_SIZE + 1), event];
  await writeStore();
  void flushAnalytics();
}

export async function flushAnalytics() {
  if (!initialized || flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.slice(0, FLUSH_BATCH_SIZE);
  try {
    await api.recordAnalyticsEvents(batch);
    queue = queue.slice(batch.length);
    await writeStore();
  } catch {
    await writeStore();
  } finally {
    flushing = false;
  }
}
