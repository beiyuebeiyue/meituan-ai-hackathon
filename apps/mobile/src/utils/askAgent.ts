export type AskIntent = "hot_find" | "hand_match" | "generic";

const HOT_KEYWORDS = ["热门", "流行", "爆款", "最近火", "热度", "热卖", "火"];
const HAND_MATCH_KEYWORDS = ["我的手", "我适合", "按我的手", "适合我本人", "手型", "肤色", "手图", "图搜图"];

export const ASK_AGENT_EXAMPLES = [
  "帮我找几款最近热门的显白猫眼",
  "我的手适合哪些温柔裸粉美甲",
  "想看适合通勤的法式美甲",
  "给我推荐绿色美甲",
  "找几款短甲显白款",
  "想看约会用的温柔猫眼",
  "看看低调耐看的裸色美甲",
  "推荐几款不挑肤色的奶白美甲",
];

export function inferAskIntent(query: string): AskIntent {
  const normalized = query.trim();
  if (!normalized) return "generic";

  if (HAND_MATCH_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "hand_match";
  }
  if (HOT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "hot_find";
  }
  return "generic";
}

export function buildRecommendationQuery(intent: AskIntent, query: string): string {
  const normalized = query.trim();
  if (!normalized) return normalized;
  if (intent === "hot_find" && !HOT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return `${normalized} 热门`;
  }
  return normalized;
}

export function getAgentLead(intent: AskIntent): string {
  switch (intent) {
    case "hot_find":
      return "我先帮你筛出几款当下热度高、也更容易上手好看的美甲。";
    case "hand_match":
      return "这类问题我会先看你的手图，再挑几款更适合先试的美甲。";
    default:
      return "收到，我先按你的描述挑几款真实可试戴的美甲给你。";
  }
}

export function getAgentHandPrompt(intent: AskIntent, stage: "recommend" | "tryon"): string {
  if (stage === "recommend") {
    return intent === "hand_match"
      ? "先选一张你最近的手图，我再给你挑更适合先试的款式。"
      : "先给我一张手图，我才能继续帮你判断上手效果。";
  }
  return "款式已经选好了，再给我一张手图，我就能马上开始试戴融合。";
}

export function getAgentResultPrompt(feedback: "pending" | "succeeded" | "failed" | "unsatisfied"): string {
  switch (feedback) {
    case "pending":
      return "我已经拿到你的手图和目标款式，正在开始融合，上手效果马上出来。";
    case "succeeded":
      return "试戴完成了，看看这次的上手效果。你满意的话可以直接保存，不满意我就继续给你换。";
    case "unsatisfied":
      return "没关系，我把剩下的款式继续放在下面。你可以换一款试戴，或者换张手图再试。";
    default:
      return "这次试戴没成功，我们换一张手图或者换一款继续试。";
  }
}
