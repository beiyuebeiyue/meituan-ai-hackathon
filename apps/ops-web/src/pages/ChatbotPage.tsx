import { DeleteOutlined, PlusOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import { App, Avatar, Button, Empty, Input, Popconfirm, Space, Typography } from "antd";
import Lottie from "lottie-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ChatMessage } from "../api/client";
import catTypingAnimation from "../assets/lottie/cat-typing.json";

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
  messages: ChatMessage[];
};

const STORAGE_KEY = "ops_xiaojia_conversations";

const starterMessage: ChatMessage = {
  role: "assistant",
  content: "你好，我是运营小嘉。可以帮你查看营收、用户增长、热门美甲、发券记录和日报总结。",
};

function nowIso() {
  return new Date().toISOString();
}

function dayOffsetIso(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedConversations(): Conversation[] {
  return [
    {
      id: makeId(),
      title: "昨天的营收情况？",
      updated_at: nowIso(),
      messages: [
        { role: "user", content: "昨天的营收情况？" },
        {
          role: "assistant",
          content: "昨天完成预约 23 单，按 100 元/单估算营收为 ¥2,300。完成单主要集中在下午和晚间，建议今天继续关注高转化门店的预约承接。",
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

function loadConversations(): Conversation[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedConversations();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : seedConversations();
  } catch {
    return seedConversations();
  }
}

function saveConversations(items: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function groupLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "今天";
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return "更早";
}

function isBlankNewConversation(item: Conversation) {
  return (
    item.title === "新对话" &&
    item.messages.length === 1 &&
    item.messages[0].role === starterMessage.role &&
    item.messages[0].content === starterMessage.content
  );
}

function XiaojiaMascot({ className = "" }: { className?: string }) {
  return (
    <Lottie
      className={`chatbot-cat-mascot ${className}`.trim()}
      animationData={catTypingAnimation}
      autoplay
      loop
      aria-hidden="true"
    />
  );
}

export function ChatbotPage() {
  const { message } = App.useApp();
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState(() => loadConversations()[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingDots, setWaitingDots] = useState(".");
  const messagesRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const isBlankConversation = Boolean(activeConversation && isBlankNewConversation(activeConversation));
  const visibleMessages = isBlankConversation ? [] : activeConversation?.messages ?? [];

  const groupedConversations = useMemo(() => {
    const groups: Record<string, Conversation[]> = { 今天: [], 昨天: [], 更早: [] };
    conversations.forEach((item) => groups[groupLabel(item.updated_at)].push(item));
    return groups;
  }, [conversations]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (!loading) {
      setWaitingDots(".");
      return;
    }
    const timer = window.setInterval(() => {
      setWaitingDots((current) => (current.length >= 3 ? "." : `${current}.`));
    }, 420);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
  }, [activeId, activeConversation?.messages, loading, waitingDots]);

  function updateConversations(next: Conversation[]) {
    const sorted = [...next].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setConversations(sorted);
    if (!sorted.some((item) => item.id === activeId)) {
      setActiveId(sorted[0]?.id ?? "");
    }
  }

  function createConversation() {
    const existing = conversations.find(isBlankNewConversation);
    if (existing) {
      setActiveId(existing.id);
      setInput("");
      return;
    }
    const next: Conversation = {
      id: makeId(),
      title: "新对话",
      updated_at: nowIso(),
      messages: [starterMessage],
    };
    setConversations((current) => [next, ...current]);
    setActiveId(next.id);
    setInput("");
  }

  function deleteConversation(id: string) {
    updateConversations(conversations.filter((item) => item.id !== id));
  }

  function replaceActive(messages: ChatMessage[], title?: string) {
    const next = conversations.map((item) =>
      item.id === activeConversation.id
        ? {
            ...item,
            title: title ?? item.title,
            updated_at: nowIso(),
            messages,
          }
        : item,
    );
    updateConversations(next);
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || loading || !activeConversation) return;
    const baseMessages = isBlankNewConversation(activeConversation) ? [] : activeConversation.messages;
    const nextMessages: ChatMessage[] = [...baseMessages, { role: "user", content }];
    const nextTitle = activeConversation.title === "新对话" ? content.slice(0, 24) : activeConversation.title;
    replaceActive(nextMessages, nextTitle);
    setInput("");
    setLoading(true);
    try {
      const response = await api.chat(nextMessages.slice(-20));
      replaceActive([...nextMessages, { role: "assistant", content: response.reply }], nextTitle);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "运营小嘉暂不可用");
    } finally {
      setLoading(false);
    }
  }

  const chatInput = (
    <div className="chatbot-input-wrap">
      <Input.TextArea
        value={input}
        autoSize={{ minRows: 2, maxRows: 5 }}
        placeholder="输入消息，按 Enter 发送..."
        onChange={(event) => setInput(event.target.value)}
        onPressEnter={(event) => {
          if (!event.shiftKey) {
            event.preventDefault();
            sendMessage();
          }
        }}
      />
      <div className="chatbot-input-actions">
        <span className="chatbot-tool-chip">✦</span>
        <span className="chatbot-tool-chip">G</span>
        <Button type="primary" shape="circle" icon={<SendOutlined />} loading={loading} onClick={sendMessage} />
      </div>
    </div>
  );

  return (
    <Space direction="vertical" size={16} className="page-stack chatbot-page">
      <div className="chatbot-shell">
        <aside className="chatbot-history">
          <Button block type="primary" ghost icon={<PlusOutlined />} onClick={createConversation}>
            新建对话
          </Button>
          {Object.entries(groupedConversations).map(([label, items]) =>
            items.length ? (
              <div className="chatbot-history-group" key={label}>
                <Typography.Text type="secondary" className="chatbot-history-label">
                  {label}
                </Typography.Text>
                {items.map((item) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={item.id}
                    className={`chatbot-history-item${item.id === activeConversation?.id ? " is-active" : ""}`}
                    onClick={() => setActiveId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setActiveId(item.id);
                    }}
                  >
                    <span className="chatbot-history-title">{item.title}</span>
                    <Popconfirm title="删除这段对话？" okText="删除" cancelText="取消" onConfirm={() => deleteConversation(item.id)}>
                      <Button
                        size="small"
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            ) : null,
          )}
        </aside>

        <section className="chatbot-main">
          {!activeConversation ? (
            <div className="chatbot-empty">
              <Empty description="还没有对话" />
              <Button type="primary" icon={<PlusOutlined />} onClick={createConversation}>
                新建对话
              </Button>
            </div>
          ) : (
            <>
              {isBlankConversation ? (
                <div className="chatbot-blank-state">
                  <div className="chatbot-welcome">
                    <XiaojiaMascot className="chatbot-welcome-mascot" />
                    <Typography.Title level={2}>你好，有什么可以帮你?</Typography.Title>
                  </div>
                  {chatInput}
                </div>
              ) : (
                <>
                  <div className="chatbot-messages" ref={messagesRef}>
                    {visibleMessages.map((item, index) => (
                      <div key={`${item.role}-${index}`} className={`chatbot-message-row chatbot-message-row-${item.role}`}>
                        {item.role === "assistant" ? (
                          <div className="chatbot-message-avatar">
                            <XiaojiaMascot className="chatbot-message-mascot" />
                          </div>
                        ) : null}
                        <div className={`chatbot-message chatbot-message-${item.role}`}>
                          <Typography.Paragraph>{item.content}</Typography.Paragraph>
                        </div>
                        {item.role === "user" ? (
                          <Avatar className="chatbot-user-avatar" icon={<UserOutlined />} />
                        ) : null}
                      </div>
                    ))}
                    {loading && (
                      <div className="chatbot-thinking">
                        <XiaojiaMascot className="chatbot-thinking-mascot" />
                        <span>{waitingDots}</span>
                      </div>
                    )}
                  </div>
                  {chatInput}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </Space>
  );
}
