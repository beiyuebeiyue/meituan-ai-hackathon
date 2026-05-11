import type { ChatMessage } from "../api/client";

export type XiaojiaConversation = {
  id: string;
  title: string;
  updated_at: string;
  messages: ChatMessage[];
};

const STORAGE_KEY = "ops_xiaojia_conversations";
const ACTIVE_ID_KEY = "ops_xiaojia_active_conversation_id";
export const CONVERSATIONS_CHANGED_EVENT = "ops_xiaojia_conversations_changed";

export const starterMessage: ChatMessage = {
  role: "assistant",
  content: "你好，我是运营小嘉。可以帮你查看营收、用户增长、热门美甲、发券记录和日报总结。",
};

export function nowIso() {
  return new Date().toISOString();
}

function dayOffsetIso(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedConversations(): XiaojiaConversation[] {
  return [
    {
      id: makeId(),
      title: "昨天的营收情况？",
      updated_at: nowIso(),
      messages: [
        { role: "user", content: "昨天的营收情况？" },
        {
          role: "assistant",
          content: "昨天完成预约 23 单，营收按订单实际金额汇总。完成单主要集中在下午和晚间，建议今天继续关注高转化门店的预约承接。",
        },
      ],
    },
    {
      id: makeId(),
      title: "最近的用户增长情况",
      updated_at: dayOffsetIso(-1),
      messages: [
        { role: "user", content: "最近的用户增长情况怎么样？" },
        {
          role: "assistant",
          content: "最近新增用户保持上升，新增主要来自热门美甲内容曝光和 AI 焕手入口。建议把新用户按是否完成 AI 焕手、是否收藏款式继续分层观察。",
        },
      ],
    },
    {
      id: makeId(),
      title: "总结一下上周的周报",
      updated_at: dayOffsetIso(-6),
      messages: [
        { role: "user", content: "总结一下上周的周报" },
        {
          role: "assistant",
          content: "上周核心指标是用户增长、AI 焕手使用和预约完成率。热门美甲内容带来更多浏览，发券记录可继续和预约转化一起看，判断优惠券是否真正推动下单。",
        },
      ],
    },
  ];
}

export function sortConversations(items: XiaojiaConversation[]) {
  return [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function loadConversations(): XiaojiaConversation[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedConversations();
    saveConversations(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as XiaojiaConversation[];
    if (Array.isArray(parsed)) return sortConversations(parsed);
  } catch {
    // fall through to seed
  }

  const seeded = seedConversations();
  saveConversations(seeded);
  return seeded;
}

export function saveConversations(items: XiaojiaConversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sortConversations(items)));
  window.dispatchEvent(new Event(CONVERSATIONS_CHANGED_EVENT));
}

export function getSavedActiveConversationId(items: XiaojiaConversation[]) {
  const savedId = localStorage.getItem(ACTIVE_ID_KEY);
  if (savedId && items.some((item) => item.id === savedId)) return savedId;
  return items[0]?.id ?? "";
}

export function saveActiveConversationId(id: string) {
  if (id) localStorage.setItem(ACTIVE_ID_KEY, id);
  else localStorage.removeItem(ACTIVE_ID_KEY);
}

export function groupLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "今天";
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return "更早";
}

export function isBlankNewConversation(item: XiaojiaConversation) {
  return (
    item.title === "新对话" &&
    item.messages.length === 1 &&
    item.messages[0].role === starterMessage.role &&
    item.messages[0].content === starterMessage.content
  );
}

export function makeBlankConversation(): XiaojiaConversation {
  return {
    id: makeId(),
    title: "新对话",
    updated_at: nowIso(),
    messages: [starterMessage],
  };
}

export function createOrReuseBlankConversation(items: XiaojiaConversation[]) {
  const existing = items.find(isBlankNewConversation);
  if (existing) return { conversation: existing, conversations: items };

  const conversation = makeBlankConversation();
  return { conversation, conversations: [conversation, ...items] };
}
