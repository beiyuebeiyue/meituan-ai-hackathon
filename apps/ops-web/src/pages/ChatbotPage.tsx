import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import { App, Avatar, Button, Empty, Input, Popconfirm, Space, Typography } from "antd";
import Lottie from "lottie-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ChatMessage } from "../api/client";
import catTypingAnimation from "../assets/lottie/cat-typing.json";
import { MarkdownPreview } from "../components/MarkdownPreview";
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

type QueuedMessage = {
  id: string;
  content: string;
};

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
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingQueueContent, setEditingQueueContent] = useState("");
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

  useEffect(() => {
    if (loading || editingQueueId || !queuedMessages.length || !activeConversation) return;
    const [nextQueuedMessage] = queuedMessages;
    setQueuedMessages((items) => items.slice(1));
    void submitMessage(nextQueuedMessage.content);
  }, [loading, editingQueueId, queuedMessages, activeConversation]);

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
    setQueuedMessages([]);
    setEditingQueueId(null);
    setEditingQueueContent("");
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

  async function submitMessage(content: string) {
    if (!content || !activeConversation) return;
    const latestConversations = loadConversations();
    const latestConversation = latestConversations.find((item) => item.id === activeConversation.id) ?? activeConversation;
    const conversationId = latestConversation.id;
    const baseMessages = isBlankNewConversation(latestConversation) ? [] : latestConversation.messages;
    const nextMessages: ChatMessage[] = [...baseMessages, { role: "user", content }];
    const nextTitle = latestConversation.title === "新对话" ? content.slice(0, 24) : latestConversation.title;
    replaceConversation(latestConversations, latestConversation, nextMessages, nextTitle);
    setLoading(true);
    try {
      const response = await api.chat(nextMessages.slice(-20));
      const updatedConversations = loadConversations();
      const updatedConversation = updatedConversations.find((item) => item.id === conversationId);
      if (updatedConversation) {
        replaceConversation(updatedConversations, updatedConversation, [...nextMessages, { role: "assistant", content: response.reply }], nextTitle);
      }
    } catch (error) {
      if (mountedRef.current) message.error(error instanceof Error ? error.message : "运营小嘉暂不可用");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function sendMessage() {
    const content = input.trim();
    if (!content || !activeConversation) return;
    setInput("");
    if (loading) {
      setQueuedMessages((items) => [...items, { id: makeQueueId(), content }]);
      return;
    }
    void submitMessage(content);
  }

  function startEditQueuedMessage(item: QueuedMessage) {
    setEditingQueueId(item.id);
    setEditingQueueContent(item.content);
  }

  function confirmEditQueuedMessage() {
    const content = editingQueueContent.trim();
    if (!editingQueueId) return;
    if (!content) return;
    setQueuedMessages((items) => items.map((item) => (item.id === editingQueueId ? { ...item, content } : item)));
    setEditingQueueId(null);
    setEditingQueueContent("");
  }

  function cancelEditQueuedMessage() {
    setEditingQueueId(null);
    setEditingQueueContent("");
  }

  function deleteQueuedMessage(id: string) {
    setQueuedMessages((items) => items.filter((item) => item.id !== id));
    if (editingQueueId === id) cancelEditQueuedMessage();
  }

  const chatInput = (
    <div className="chatbot-composer">
      {queuedMessages.length ? (
        <div className="chatbot-queue">
          <div className="chatbot-queue-header">
            <Typography.Text type="secondary">待发送队列</Typography.Text>
            <Typography.Text type="secondary">{queuedMessages.length} 条</Typography.Text>
          </div>
          {queuedMessages.map((item, index) => {
            const isEditing = editingQueueId === item.id;
            return (
              <div className={`chatbot-queue-item${isEditing ? " is-editing" : ""}`} key={item.id}>
                <span className="chatbot-queue-index">{index + 1}</span>
                {isEditing ? (
                  <Input.TextArea
                    className="chatbot-queue-edit"
                    value={editingQueueContent}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    onChange={(event) => setEditingQueueContent(event.target.value)}
                    onPressEnter={(event) => {
                      if (!event.shiftKey) {
                        event.preventDefault();
                        confirmEditQueuedMessage();
                      }
                    }}
                  />
                ) : (
                  <span className="chatbot-queue-content">{item.content}</span>
                )}
                <Space size={4} className="chatbot-queue-actions">
                  {isEditing ? (
                    <>
                      <Button
                        size="small"
                        type="text"
                        icon={<CheckOutlined />}
                        disabled={!editingQueueContent.trim()}
                        onClick={confirmEditQueuedMessage}
                      />
                      <Button size="small" type="text" icon={<CloseOutlined />} onClick={cancelEditQueuedMessage} />
                    </>
                  ) : (
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => startEditQueuedMessage(item)} />
                  )}
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => deleteQueuedMessage(item.id)} />
                </Space>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="chatbot-input-wrap">
        <Input.TextArea
          value={input}
          autoSize={{ minRows: 2, maxRows: 5 }}
          placeholder={loading ? "当前回复完成后自动发送..." : "输入消息，按 Enter 发送..."}
          onChange={(event) => setInput(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
        />
        <div className="chatbot-input-actions">
          <Button type="primary" shape="circle" icon={<SendOutlined />} disabled={!input.trim()} onClick={sendMessage} />
        </div>
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
                    <Typography.Title level={2}>你好！我是小嘉，你的运营助理。</Typography.Title>
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
                          {item.role === "assistant" ? (
                            <MarkdownPreview content={item.content} />
                          ) : (
                            <Typography.Paragraph>{item.content}</Typography.Paragraph>
                          )}
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

function makeQueueId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
