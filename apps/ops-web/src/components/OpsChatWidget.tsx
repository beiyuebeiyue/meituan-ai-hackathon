import { CloseOutlined, PlusOutlined, SendOutlined } from "@ant-design/icons";
import { App, Button, Card, Input, List, Popover, Space, Tooltip, Typography } from "antd";
import Lottie from "lottie-react";
import { useEffect, useRef, useState } from "react";
import { api, ChatMessage } from "../api/client";
import catTypingAnimation from "../assets/lottie/cat-typing.json";
import {
  CONVERSATIONS_CHANGED_EVENT,
  createOrReuseBlankConversation,
  getSavedActiveConversationId,
  isBlankNewConversation,
  loadConversations,
  nowIso,
  saveActiveConversationId,
  saveConversations,
  sortConversations,
  starterMessage,
  type XiaojiaConversation,
} from "../utils/xiaojiaConversations";

const commands = [
  { command: "/clear", title: "清空当前窗口", description: "清除当前聊天内容" },
  { command: "/new", title: "开启新对话", description: "重置为一段新的对话" },
  { command: "/help", title: "查看命令", description: "显示可用命令说明" },
];

export function OpsChatWidget() {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<XiaojiaConversation[]>(() => loadConversations());
  const [activeId, setActiveIdState] = useState(() => getSavedActiveConversationId(loadConversations()));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingDots, setWaitingDots] = useState(".");
  const messagesRef = useRef<HTMLDivElement>(null);
  const commandOpen = input.trim().startsWith("/");
  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const messages = activeConversation?.messages ?? [];

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
    if (!open) return;
    window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
  }, [messages, loading, waitingDots, open]);

  function selectConversation(id: string) {
    setActiveIdState(id);
    saveActiveConversationId(id);
  }

  function updateConversations(next: XiaojiaConversation[], nextActiveId: string) {
    const sorted = sortConversations(next);
    setConversations(sorted);
    saveConversations(sorted);
    selectConversation(sorted.some((item) => item.id === nextActiveId) ? nextActiveId : (sorted[0]?.id ?? ""));
  }

  function replaceConversation(
    source: XiaojiaConversation[],
    conversation: XiaojiaConversation,
    nextMessages: ChatMessage[],
    title?: string,
  ) {
    const next = source.map((item) =>
      item.id === conversation.id
        ? {
            ...item,
            title: title ?? item.title,
            updated_at: nowIso(),
            messages: nextMessages,
          }
        : item,
    );
    updateConversations(next, conversation.id);
    return next;
  }

  function getActiveOrCreateBlank() {
    if (activeConversation) {
      return { conversation: activeConversation, conversations };
    }
    const { conversation, conversations: next } = createOrReuseBlankConversation(conversations);
    updateConversations(next, conversation.id);
    return { conversation, conversations: next };
  }

  function startNewConversation() {
    const { conversation, conversations: next } = createOrReuseBlankConversation(conversations);
    updateConversations(next, conversation.id);
    setInput("");
    setLoading(false);
  }

  function runCommand(content: string) {
    const command = content.toLowerCase();
    if (command === "clear" || command === "/clear") {
      const { conversation, conversations: source } = getActiveOrCreateBlank();
      replaceConversation(source, conversation, [starterMessage], "新对话");
      setInput("");
      return true;
    }
    if (command === "new" || command === "/new") {
      startNewConversation();
      return true;
    }
    if (command === "help" || command === "/help") {
      const { conversation, conversations: source } = getActiveOrCreateBlank();
      const baseMessages = isBlankNewConversation(conversation) ? [] : conversation.messages;
      const nextMessages: ChatMessage[] = [
        ...baseMessages,
        { role: "user", content },
        { role: "assistant", content: "可用命令：clear 清空当前窗口，new 开启新对话，help 查看命令。" },
      ];
      replaceConversation(source, conversation, nextMessages, conversation.title === "新对话" ? "查看命令" : conversation.title);
      setInput("");
      return true;
    }
    return false;
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || loading) return;
    if (runCommand(content)) return;
    const { conversation, conversations: source } = getActiveOrCreateBlank();
    const baseMessages = isBlankNewConversation(conversation) ? [] : conversation.messages;
    const nextMessages: ChatMessage[] = [...baseMessages, { role: "user", content }];
    const nextTitle = conversation.title === "新对话" ? content.slice(0, 24) : conversation.title;
    const optimisticConversations = replaceConversation(source, conversation, nextMessages, nextTitle);
    setInput("");
    setLoading(true);
    try {
      const response = await api.chat(nextMessages.slice(-20));
      replaceConversation(optimisticConversations, conversation, [...nextMessages, { role: "assistant", content: response.reply }], nextTitle);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "运营小嘉暂不可用");
    } finally {
      setLoading(false);
    }
  }

  function pickCommand(command: string) {
    setInput(command);
  }

  const commandMenu = (
    <List
      className="ops-command-list"
      dataSource={commands}
      renderItem={(item) => (
        <List.Item className="ops-command-item" onClick={() => pickCommand(item.command)}>
          <List.Item.Meta
            title={<Typography.Text code>{item.command}</Typography.Text>}
            description={
              <span>
                {item.title} · {item.description}
              </span>
            }
          />
        </List.Item>
      )}
    />
  );

  return (
    <div className={`ops-chat ${open ? "is-open" : "is-closed"}`}>
      {open && (
        <Card
          className="ops-chat-panel"
          title={
            <Space>
              <Mascot />
              <span>运营小嘉</span>
            </Space>
          }
          extra={
            <Space size={4}>
              <Tooltip title="开启新对话">
                <Button type="text" icon={<PlusOutlined />} onClick={startNewConversation} />
              </Tooltip>
              <Tooltip title="关闭">
                <Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} />
              </Tooltip>
            </Space>
          }
        >
          <div className="ops-chat-messages" ref={messagesRef}>
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`ops-chat-bubble ops-chat-bubble-${item.role}`}>
                <Typography.Text>{item.content}</Typography.Text>
              </div>
            ))}
            {loading && (
              <div className="ops-chat-bubble ops-chat-bubble-assistant ops-chat-bubble-waiting" aria-live="polite">
                <Typography.Text>{waitingDots}</Typography.Text>
              </div>
            )}
          </div>
          <Popover open={commandOpen} placement="topLeft" content={commandMenu} trigger="click">
            <Space.Compact className="ops-chat-input">
              <Input.TextArea
                autoSize={{ minRows: 1, maxRows: 3 }}
                value={input}
                spellCheck={false}
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                data-lt-active="false"
                placeholder="输入 / 查看命令"
                onChange={(event) => setInput(event.target.value)}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={sendMessage} />
            </Space.Compact>
          </Popover>
        </Card>
      )}
      <Button
        className="ops-chat-launcher"
        type="primary"
        aria-label={open ? "关闭运营小嘉" : "打开运营小嘉"}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ops-chat-launcher-glyph" aria-hidden="true" />
      </Button>
    </div>
  );
}

function Mascot() {
  return <Lottie className="mascot-lottie" animationData={catTypingAnimation} autoplay loop aria-hidden="true" />;
}
