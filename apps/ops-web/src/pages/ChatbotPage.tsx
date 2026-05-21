import { DeleteOutlined, PlusOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import { App, Avatar, Button, Empty, Input, Popconfirm, Typography } from "antd";
import Lottie from "lottie-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ChatMessage } from "../api/client";
import catTypingAnimation from "../assets/lottie/cat-typing.json";
import {
  CONVERSATIONS_CHANGED_EVENT,
  createOrReuseBlankConversation,
  getSavedActiveConversationId,
  groupLabel,
  isBlankNewConversation,
  loadConversations,
  nowIso,
  saveActiveConversationId,
  saveConversations,
  sortConversations,
  type XiaojiaConversation,
} from "../utils/xiaojiaConversations";

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
  const [conversations, setConversations] = useState<XiaojiaConversation[]>(() => loadConversations());
  const [activeId, setActiveIdState] = useState(() => getSavedActiveConversationId(loadConversations()));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingDots, setWaitingDots] = useState(".");
  const messagesRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const isBlankConversation = Boolean(activeConversation && isBlankNewConversation(activeConversation));
  const visibleMessages = isBlankConversation ? [] : activeConversation?.messages ?? [];

  const groupedConversations = useMemo(() => {
    const groups: Record<string, XiaojiaConversation[]> = { 今天: [], 昨天: [], 更早: [] };
    conversations.forEach((item) => groups[groupLabel(item.updated_at)].push(item));
    return groups;
  }, [conversations]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const syncConversations = () => {
      const next = loadConversations();
      setConversations(next);
      setActiveIdState(getSavedActiveConversationId(next));
    };
    window.addEventListener(CONVERSATIONS_CHANGED_EVENT, syncConversations);
    window.addEventListener("storage", syncConversations);
    return () => {
      window.removeEventListener(CONVERSATIONS_CHANGED_EVENT, syncConversations);
      window.removeEventListener("storage", syncConversations);
    };
  }, []);

  useEffect(() => {
    saveActiveConversationId(activeId);
  }, [activeId]);

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

  function selectConversation(id: string) {
    setActiveIdState(id);
    saveActiveConversationId(id);
  }

  function updateConversations(next: XiaojiaConversation[], nextActiveId = activeId) {
    const sorted = sortConversations(next);
    const resolvedActiveId = sorted.some((item) => item.id === nextActiveId) ? nextActiveId : (sorted[0]?.id ?? "");
    saveConversations(sorted);
    if (mountedRef.current) {
      setConversations(sorted);
      selectConversation(resolvedActiveId);
    } else {
      saveActiveConversationId(resolvedActiveId);
    }
  }

  function createConversation() {
    const { conversation, conversations: next } = createOrReuseBlankConversation(conversations);
    updateConversations(next, conversation.id);
    setInput("");
  }

  function deleteConversation(id: string) {
    updateConversations(conversations.filter((item) => item.id !== id));
  }

  function replaceConversation(
    source: XiaojiaConversation[],
    conversation: XiaojiaConversation,
    messages: ChatMessage[],
    title?: string,
  ) {
    const next = source.map((item) =>
      item.id === conversation.id
        ? {
            ...item,
            title: title ?? item.title,
            updated_at: nowIso(),
            messages,
          }
        : item,
    );
    updateConversations(next, conversation.id);
    return next;
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || loading || !activeConversation) return;
    const conversationId = activeConversation.id;
    const baseMessages = isBlankNewConversation(activeConversation) ? [] : activeConversation.messages;
    const nextMessages: ChatMessage[] = [...baseMessages, { role: "user", content }];
    const nextTitle = activeConversation.title === "新对话" ? content.slice(0, 24) : activeConversation.title;
    replaceConversation(conversations, activeConversation, nextMessages, nextTitle);
    setInput("");
    setLoading(true);
    try {
      const response = await api.chat(nextMessages.slice(-20));
      const latestConversations = loadConversations();
      const latestConversation = latestConversations.find((item) => item.id === conversationId);
      if (latestConversation) {
        replaceConversation(latestConversations, latestConversation, [...nextMessages, { role: "assistant", content: response.reply }], nextTitle);
      }
    } catch (error) {
      if (mountedRef.current) message.error(error instanceof Error ? error.message : "运营小嘉暂不可用");
    } finally {
      if (mountedRef.current) setLoading(false);
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
    <div className="page-stack chatbot-page">
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
                    onClick={() => selectConversation(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") selectConversation(item.id);
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
    </div>
  );
}
