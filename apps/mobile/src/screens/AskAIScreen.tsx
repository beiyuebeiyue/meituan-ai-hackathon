import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { TryOnHandChooser } from "../components/TryOnHandChooser";
import { useHandPhotoPicker } from "../hooks/useHandPhotoPicker";
import { useTryOnLauncher } from "../hooks/useTryOnLauncher";
import { RootStackParamList } from "../navigation/RootNavigator";
import { AskAIConversation, useAskAIStore } from "../store/useAskAIStore";
import { useAuthStore } from "../store/useAuthStore";
import { useMarketStore } from "../store/useMarketStore";
import { AIChatMessage, XhsHotRecommendation } from "../types/api";
import {
  ASK_AGENT_EXAMPLES,
  AskIntent,
  getAgentHandPrompt,
  getAgentResultPrompt,
  inferAskIntent,
} from "../utils/askAgent";
import { useThemeColors } from "../utils/theme";
import { trackEvent } from "../utils/analytics";
import { getNailTypeLabel, isHandmadeNail } from "../utils/nailType";

type ChatPayload = {
  messages: AIChatMessage[];
  handImageUri?: string | null;
  savedHandPhotoId?: string | null;
};

type ConversationGroup = {
  title: string;
  items: AskAIConversation[];
};

type ChatDebugEntry = {
  id: string;
  createdAt: number;
  request: Record<string, unknown>;
  response?: unknown;
  error?: string;
};

function AnimatedPressable({
  children,
  disabled,
  hitSlop,
  onLongPress,
  onPress,
  style,
}: {
  children: ReactNode;
  disabled?: boolean;
  hitSlop?: number;
  onLongPress?: () => void;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 28,
      bounciness: 7,
    }).start();
  };

  useEffect(() => {
    if (disabled) animateTo(1);
  }, [disabled]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}>
      <Pressable
        hitSlop={hitSlop}
        style={style}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        onPressIn={() => {
          if (!disabled) animateTo(0.94);
        }}
        onPressOut={() => animateTo(1)}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function ActionChip({
  label,
  onPress,
  background,
  textColor,
  active,
  activeBackground,
  disabled,
}: {
  label: string;
  onPress: () => void;
  background: string;
  textColor: string;
  active?: boolean;
  activeBackground?: string;
  disabled?: boolean;
}) {
  return (
    <AnimatedPressable
      style={[styles.actionChip, { backgroundColor: active ? activeBackground ?? background : background }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionChipText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

function ChatBubble({
  message,
  pending,
  colors,
}: {
  message: AIChatMessage;
  pending: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.chatBubbleRow, isUser ? styles.chatBubbleRowUser : styles.chatBubbleRowAssistant]}>
      <View
        style={[
          styles.chatBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.accent }]
            : [styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
        ]}
      >
        {message.content ? <Text style={[styles.chatBubbleText, { color: isUser ? "#ffffff" : colors.text }]}>{message.content}</Text> : null}
        {pending ? <ActivityIndicator size="small" color={colors.accent} style={styles.chatBubbleSpinner} /> : null}
      </View>
    </View>
  );
}

function RecommendationCard({
  item,
  onPreview,
  colors,
}: {
  item: XhsHotRecommendation;
  onPreview: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const typeLabel = item.tags.length ? item.tags.slice(0, 4).join(" · ") : "平台精选";
  const stats = `赞 ${item.liked_count} · 藏 ${item.collected_count} · 转 ${item.share_count}`;

  return (
    <AnimatedPressable style={[styles.recommendationCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPreview}>
      <Pressable style={styles.recommendationImageWrap} onPress={onPreview}>
        <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.recommendationImage, { backgroundColor: colors.accentSoft }]} />
      </Pressable>
      <View style={styles.recommendationBody}>
        <View style={styles.recommendationHeader}>
          <Text style={[styles.recommendationTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={[styles.nailTypePill, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.nailTypePillText, { color: colors.accent }]}>穿戴甲</Text>
          </View>
        </View>
        <View style={styles.recommendationTypeRow}>
          <Text style={[styles.recommendationTypeText, { color: colors.subtext }]} numberOfLines={1}>
            {typeLabel}
          </Text>
        </View>
        <View style={[styles.recommendationReasonBox, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.recommendationReasonLabel, { color: colors.accent }]}>推荐理由</Text>
          <Text style={[styles.recommendationReason, { color: colors.subtext }]} numberOfLines={3}>
            {item.reason}
          </Text>
        </View>
        <Text style={[styles.recommendationStats, { color: colors.subtext }]} numberOfLines={1}>
          {stats}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

export function AskAIScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const colors = useThemeColors();
  const {
    handImageUri,
    promptText,
    selectedHandPhotoId,
    selectedStyleId,
    setHandImageUri,
    setPromptText,
    setSelectedHandPhotoId,
    setSelectedStyleId,
    conversations,
    conversationsHydrated,
    loadConversations,
    saveConversation,
    selectConversation,
    startConversation,
  } = useAskAIStore();
  const token = useAuthStore((state) => state.token);
  const setPendingBookingStyleId = useMarketStore((state) => state.setPendingBookingStyleId);
  const setPendingBookingTryOnJobId = useMarketStore((state) => state.setPendingBookingTryOnJobId);

  const [askedQuery, setAskedQuery] = useState("");
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
  const [intent, setIntent] = useState<AskIntent | null>(null);
  const [assistantLine, setAssistantLine] = useState("想看热门款、适合你的款式，或者直接挑一款先试戴，都可以问我。");
  const [handPickerMessage, setHandPickerMessage] = useState("");
  const [recommendations, setRecommendations] = useState<XhsHotRecommendation[]>([]);
  const [previewItem, setPreviewItem] = useState<XhsHotRecommendation | null>(null);
  const [needsHandFor, setNeedsHandFor] = useState<"recommend" | "tryon" | null>(null);
  const [queuedTryOnStyleId, setQueuedTryOnStyleId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [tryOnFeedback, setTryOnFeedback] = useState<"idle" | "satisfied" | "unsatisfied">("idle");
  const [composerHeight, setComposerHeight] = useState(158);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [debugVisible, setDebugVisible] = useState(false);
  const [chatDebugEntries, setChatDebugEntries] = useState<ChatDebugEntry[]>([]);
  const [materializingNoteId, setMaterializingNoteId] = useState<string | null>(null);
  const [queuedTryOnNoteId, setQueuedTryOnNoteId] = useState<string | null>(null);
  const sendHaloScale = useRef(new Animated.Value(1)).current;
  const sendHaloOpacity = useRef(new Animated.Value(0)).current;

  const chatMutation = useMutation({
    mutationFn: async (payload: ChatPayload) => {
      const debugId = `chat-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const requestPayload = payload.handImageUri || payload.savedHandPhotoId
        ? {
            endpoint: "/api/v1/ai/chat",
            method: "POST",
            contentType: "multipart/form-data",
            messages: payload.messages,
            savedHandPhotoId: payload.savedHandPhotoId ?? null,
            handImageUri: payload.handImageUri ? "[local image selected]" : null,
          }
        : {
            endpoint: "/api/v1/ai/chat",
            method: "POST",
            contentType: "application/json",
            body: { messages: payload.messages },
          };
      setChatDebugEntries((entries) =>
        [
          {
            id: debugId,
            createdAt: Date.now(),
            request: requestPayload,
          },
          ...entries,
        ].slice(0, 20),
      );
      try {
        const data =
          payload.handImageUri || payload.savedHandPhotoId
            ? await api.chatWithHand(payload.messages, payload.handImageUri, payload.savedHandPhotoId)
            : await api.chat(payload.messages);
        setChatDebugEntries((entries) => entries.map((entry) => (entry.id === debugId ? { ...entry, response: data } : entry)));
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setChatDebugEntries((entries) => entries.map((entry) => (entry.id === debugId ? { ...entry, error: message } : entry)));
        throw error;
      }
    },
    onSuccess: (data, payload) => {
      setAssistantLine(data.reply);
      setRecommendations(data.needs_hand_image ? [] : data.recommendations ?? []);
      const nextMessages = [...payload.messages, { role: "assistant" as const, content: data.reply }].slice(-12);
      setChatMessages(nextMessages);
      void saveConversation(nextMessages);
      if (data.needs_hand_image) {
        setIntent("hand_match");
        setNeedsHandFor("recommend");
        setHandPickerMessage(data.hand_picker_message ?? data.reply);
      } else {
        setHandPickerMessage("");
      }
    },
    onError: () => {
      setAssistantLine("我暂时没连上小嘉大模型，但仍会先按图库帮你挑适合试戴的款式。");
    },
  });

  useEffect(() => {
    if (!promptText.trim() || chatMutation.isPending) {
      sendHaloScale.stopAnimation();
      sendHaloOpacity.stopAnimation();
      sendHaloScale.setValue(1);
      sendHaloOpacity.setValue(0);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sendHaloScale, {
            toValue: 1.18,
            duration: 760,
            useNativeDriver: true,
          }),
          Animated.timing(sendHaloOpacity, {
            toValue: 0.18,
            duration: 760,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(sendHaloScale, {
            toValue: 1,
            duration: 760,
            useNativeDriver: true,
          }),
          Animated.timing(sendHaloOpacity, {
            toValue: 0.06,
            duration: 760,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [chatMutation.isPending, promptText, sendHaloOpacity, sendHaloScale]);

  const tryOnJobQuery = useQuery({
    queryKey: ["ask-ai-job", activeJobId],
    queryFn: () => api.getTryOnJob(activeJobId as string),
    enabled: !!token && !!activeJobId,
    refetchInterval: (queryState) => {
      const status = queryState.state.data?.status;
      return status === "succeeded" || status === "failed" ? false : 2000;
    },
  });
  const activeStyleQuery = useQuery({
    queryKey: ["style", tryOnJobQuery.data?.selected_style_id, "ask-ai-result"],
    queryFn: () => api.getStyle(tryOnJobQuery.data?.selected_style_id ?? ""),
    enabled: Boolean(tryOnJobQuery.data?.selected_style_id),
  });

  const handleHandReady = (payload: { imageUri: string; handPhotoId?: string | null }) => {
    setSelectedHandPhotoId(payload.handPhotoId ?? null);
    setHandImageUri(payload.imageUri);
    setNeedsHandFor(null);
    setHandPickerMessage("");

    if (intent === "hand_match" && askedQuery) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      const nextMessages: AIChatMessage[] =
        lastMessage?.role === "user" && lastMessage.content === askedQuery
          ? chatMessages
          : [...chatMessages, { role: "user" as const, content: askedQuery }].slice(-12);
      setChatMessages(nextMessages);
      setAssistantLine("收到这张手图，我先分析手型并粗筛适合你的款式。");
      chatMutation.mutate({
        messages: nextMessages,
        handImageUri: payload.imageUri,
        savedHandPhotoId: payload.handPhotoId ?? null,
      });
      void saveConversation(nextMessages);
      return;
    }

    if (selectedStyleId) {
      startTryOn(selectedStyleId, { forceHandReady: true });
    }
  };

  const savedHandPicker = useHandPhotoPicker({
    enabled: !!token,
    onHandReady: handleHandReady,
  });

  const tryOnLauncher = useTryOnLauncher({
    onSuccess: (job) => {
      setActiveJobId(job.job_id);
      setNeedsHandFor(null);
      setTryOnFeedback("idle");
      setAssistantLine(getAgentResultPrompt("pending"));
    },
    onError: () => {
      setAssistantLine("试戴没能开始成功。你可以换一张手图，或者重新选一款继续试。");
    },
  });

  const savedHandsData = savedHandPicker.savedHandsQuery.data;
  const savedHandsReady = savedHandPicker.savedHandsQuery.isSuccess;
  const savedHandsLoading = savedHandPicker.savedHandsQuery.isPending;
  const isStartingTryOn = tryOnLauncher.mutation.isPending;
  const recentHandPhotos = useMemo(() => savedHandPicker.recentHandPhotos, [savedHandPicker.recentHandPhotos]);
  const hasHandSelection = Boolean(selectedHandPhotoId || handImageUri);
  const displayedRecommendations = recommendations;
  const conversationMessages = useMemo<AIChatMessage[]>(() => {
    if (!chatMessages.length) {
      return [{ role: "assistant" as const, content: assistantLine }];
    }
    const lastMessage = chatMessages[chatMessages.length - 1];
    if (chatMutation.isPending && lastMessage.role === "user") {
      return [...chatMessages, { role: "assistant" as const, content: "" }].slice(-13);
    }
    if (assistantLine && (lastMessage.role === "user" || lastMessage.content !== assistantLine)) {
      return [...chatMessages, { role: "assistant" as const, content: assistantLine }].slice(-13);
    }
    return chatMessages;
  }, [assistantLine, chatMessages, chatMutation.isPending]);
  const historyGroups = useMemo(() => groupConversations(conversations), [conversations]);

  useEffect(() => {
    if (!conversationsHydrated) {
      void loadConversations();
    }
  }, [conversationsHydrated, loadConversations]);

  useEffect(() => {
    if (!recommendations.length) return;
    void Promise.all(
      recommendations.map((item) =>
        trackEvent("ai_recommendation_shown", {
          source: intent === "hand_match" ? "ask_ai_hand_match" : "ask_ai_text",
          screen: "ask_ai",
          properties: {
            note_id: item.note_id,
            color_or_tag: item.tags.slice(0, 3).join(","),
            score: item.score,
          },
        }),
      ),
    );
  }, [intent, recommendations.map((item) => item.note_id).join(",")]);

  useEffect(() => {
    if (!token && selectedHandPhotoId) {
      setSelectedHandPhotoId(null);
    }
  }, [selectedHandPhotoId, setSelectedHandPhotoId, token]);

  useEffect(() => {
    if (!selectedHandPhotoId || !savedHandsReady) return;
    const current = (savedHandsData?.items ?? []).find((item) => item.id === selectedHandPhotoId);
    if (!current) {
      setSelectedHandPhotoId(null);
      return;
    }
    setHandImageUri(resolveAssetUrl(current.image_url));
  }, [savedHandsData, savedHandsReady, selectedHandPhotoId, setHandImageUri, setSelectedHandPhotoId]);

  useEffect(() => {
    const status = tryOnJobQuery.data?.status;
    if (status === "succeeded") {
      setAssistantLine(getAgentResultPrompt("succeeded"));
      void queryClient.invalidateQueries({ queryKey: ["tryon-history"] });
      if (tryOnJobQuery.data) {
        void trackEvent("tryon_result_viewed", {
          styleId: tryOnJobQuery.data.selected_style_id,
          tryonJobId: tryOnJobQuery.data.job_id,
          source: "ask_ai",
          screen: "ask_ai",
        });
      }
    } else if (status === "failed") {
      setAssistantLine(getAgentResultPrompt("failed"));
    }
  }, [queryClient, tryOnJobQuery.data, tryOnJobQuery.data?.status]);

  useEffect(() => {
    if (!token || !queuedTryOnStyleId || !hasHandSelection || isStartingTryOn) return;
    const styleId = queuedTryOnStyleId;
    setQueuedTryOnStyleId(null);
    tryOnLauncher.launchTryOn({
      styleId,
      promptText: askedQuery || promptText,
      handImageUri,
      savedHandPhotoId: selectedHandPhotoId,
    });
  }, [askedQuery, handImageUri, hasHandSelection, isStartingTryOn, promptText, queuedTryOnStyleId, selectedHandPhotoId, token, tryOnLauncher.launchTryOn]);

  const submitPrompt = (nextPrompt?: string, options?: { forceHandMatch?: boolean }) => {
    if (chatMutation.isPending) return;
    const query = (nextPrompt ?? promptText).trim();
    if (!query) return;

    const forceHandMatch = options?.forceHandMatch === true;
    const nextIntent = forceHandMatch ? "hand_match" : inferAskIntent(query);
    setPromptText("");
    setAskedQuery(query);
    setIntent(nextIntent);
    setHandPickerMessage("");
    setRecommendations([]);
    setSelectedStyleId(null);
    setActiveJobId(null);
    setTryOnFeedback("idle");
    setQueuedTryOnStyleId(null);
    chatMutation.reset();
    queryClient.removeQueries({ queryKey: ["ask-ai-job"] });

    const nextMessages: AIChatMessage[] = [...chatMessages, { role: "user" as const, content: query }].slice(-12);
    setChatMessages(nextMessages);
    void saveConversation(nextMessages, query);

    if (forceHandMatch && !hasHandSelection) {
      setNeedsHandFor("recommend");
      setAssistantLine(getAgentHandPrompt(nextIntent, "recommend"));
      return;
    }

    setNeedsHandFor(null);
    setAssistantLine("");
    const shouldSendHand = nextIntent === "hand_match" && hasHandSelection;
    chatMutation.mutate({
      messages: nextMessages,
      handImageUri: shouldSendHand ? handImageUri : null,
      savedHandPhotoId: shouldSendHand ? selectedHandPhotoId : null,
    });
  };

  const startTryOn = (styleId: string, options?: { forceHandReady?: boolean }) => {
    const handReady = options?.forceHandReady ?? hasHandSelection;
    setSelectedStyleId(styleId);
    setTryOnFeedback("idle");
    setActiveJobId(null);

    if (!handReady) {
      setNeedsHandFor("tryon");
      setAssistantLine(getAgentHandPrompt(intent ?? "generic", "tryon"));
      return;
    }
    if (!token) {
      setQueuedTryOnStyleId(styleId);
      setAssistantLine("差最后一步，登录后我就能把这款美甲直接试到你的手上。");
      navigation.navigate("Login");
      return;
    }

    setNeedsHandFor(null);
    setAssistantLine(getAgentResultPrompt("pending"));
    tryOnLauncher.launchTryOn({
      styleId,
      promptText: askedQuery || promptText,
      handImageUri,
      savedHandPhotoId: selectedHandPhotoId,
    });
  };

  const materializeAndStartTryOn = async (noteId: string) => {
    if (materializingNoteId) return;
    try {
      setMaterializingNoteId(noteId);
      const result = await api.materializeXhsRecommendationStyle(noteId);
      setQueuedTryOnNoteId(null);
      setPreviewItem(null);
      startTryOn(result.style_id, { forceHandReady: true });
    } catch (error) {
      Alert.alert("暂不能焕甲", error instanceof Error ? error.message : "这款推荐暂时无法用于焕甲试戴。");
    } finally {
      setMaterializingNoteId(null);
    }
  };

  useEffect(() => {
    if (!token || !queuedTryOnNoteId) return;
    if (!hasHandSelection) {
      setNeedsHandFor("tryon");
      setAssistantLine(getAgentHandPrompt(intent ?? "generic", "tryon"));
      return;
    }
    void materializeAndStartTryOn(queuedTryOnNoteId);
  }, [hasHandSelection, intent, queuedTryOnNoteId, token]);

  const startTryOnFromRecommendation = async (item: XhsHotRecommendation) => {
    if (materializingNoteId) return;
    if (!token) {
      setQueuedTryOnNoteId(item.note_id);
      setPreviewItem(null);
      setAssistantLine("差最后一步，登录后我就能把这款美甲直接试到你的手上。");
      navigation.navigate("Login");
      return;
    }
    if (!hasHandSelection) {
      setQueuedTryOnNoteId(item.note_id);
      setPreviewItem(null);
      setNeedsHandFor("tryon");
      setAssistantLine(getAgentHandPrompt(intent ?? "generic", "tryon"));
      return;
    }
    await materializeAndStartTryOn(item.note_id);
  };

  const saveTryOnResult = async () => {
    if (!tryOnJobQuery.data?.result_image_url) return;
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要相册权限", "允许访问相册后，才能把试戴结果保存到本地。");
      return;
    }
    const download = await FileSystem.downloadAsync(resolveAssetUrl(tryOnJobQuery.data.result_image_url), `${FileSystem.cacheDirectory}ask-ai-result.jpg`);
    await MediaLibrary.saveToLibraryAsync(download.uri);
    setTryOnFeedback("satisfied");
    setAssistantLine("好呀，这款就先帮你记下来了。你也可以继续挑别的款式再试一轮。");
    Alert.alert("已保存", "试戴结果已经保存到你的系统相册。");
  };

  const openTryOnNextStep = () => {
    const styleId = tryOnJobQuery.data?.selected_style_id;
    if (!styleId || !activeStyleQuery.data) return;
    if (isHandmadeNail(activeStyleQuery.data.nail_type)) {
      setPendingBookingStyleId(styleId);
      setPendingBookingTryOnJobId(tryOnJobQuery.data?.job_id ?? null);
      navigation.navigate("MainTabs", { screen: "Market" });
      return;
    }
    navigation.navigate("WearableStore", { styleId, entryEdge: "right" });
  };

  const currentResultImageUrl = tryOnJobQuery.data?.result_image_url ? resolveAssetUrl(tryOnJobQuery.data.result_image_url) : null;
  const showingHandChooser = needsHandFor !== null;
  const composerBottomInset = Math.max(tabBarHeight - 74, 12);
  const scrollBottomPadding = composerHeight + 18;
  const openConversation = (conversation: AskAIConversation) => {
    const selected = selectConversation(conversation.id);
    if (!selected) return;
    setChatMessages(selected.messages);
    const lastAssistant = [...selected.messages].reverse().find((message) => message.role === "assistant");
    setAssistantLine(lastAssistant?.content ?? "这轮对话已经打开，你可以继续问我。");
    setRecommendations([]);
    setNeedsHandFor(null);
    setHandPickerMessage("");
    setPreviewItem(null);
    setHistoryVisible(false);
  };
  const createNewConversation = () => {
    startConversation();
    setAskedQuery("");
    setChatMessages([]);
    setIntent(null);
    setAssistantLine("想看热门款、适合你的款式，或者直接挑一款先试戴，都可以问我。");
    setRecommendations([]);
    setNeedsHandFor(null);
    setHandPickerMessage("");
    setSelectedStyleId(null);
    setActiveJobId(null);
    setTryOnFeedback("idle");
    chatMutation.reset();
    setHistoryVisible(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]} showsVerticalScrollIndicator={false}>
          <View style={styles.chatTopBar}>
            <AnimatedPressable
              style={[styles.historyIconButton, { backgroundColor: colors.surface }]}
              onPress={() => setHistoryVisible(true)}
              onLongPress={() => setDebugVisible(true)}
            >
              <Ionicons name="menu" size={22} color={colors.text} />
            </AnimatedPressable>
          </View>

          <View style={styles.conversationList}>
            {conversationMessages.map((message, index) => (
              <ChatBubble
                key={`${message.role}-${index}-${message.content.slice(0, 16)}`}
                message={message}
                pending={chatMutation.isPending && index === conversationMessages.length - 1 && message.role === "assistant"}
                colors={colors}
              />
            ))}
          </View>

          {handImageUri ? (
            <View style={[styles.currentHandCard, { backgroundColor: colors.surface }]}>
              <View style={styles.currentHandCopy}>
                <Text style={[styles.currentHandTitle, { color: colors.text }]}>当前使用的手图</Text>
                <Text style={[styles.currentHandText, { color: colors.subtext }]}>
                  {selectedHandPhotoId ? "来自你最近上传的手图" : "来自本次临时上传的手图"}
                </Text>
              </View>
              <Image source={{ uri: handImageUri }} style={[styles.currentHandImage, { backgroundColor: colors.accentSoft }]} />
            </View>
          ) : null}

          {showingHandChooser ? (
            <TryOnHandChooser
              title={needsHandFor === "recommend" ? "先选一张手图，再继续推荐" : "选一张手图，马上开始试戴"}
              description={
                needsHandFor === "recommend" && handPickerMessage
                  ? handPickerMessage
                  : recentHandPhotos.length
                  ? "我先把你最近的 5 张手图摆出来，你可以直接挑一张继续。"
                  : "你还没有可用的手图，先拍一张，或者从相册里选一张以前拍过的。"
              }
              recentHandPhotos={recentHandPhotos}
              selectedHandPhotoId={selectedHandPhotoId}
              loading={token ? savedHandsLoading : false}
              busy={isStartingTryOn}
              tip={
                needsHandFor === "recommend"
                  ? "选好手图后，我会继续按你的手型、肤色和文字需求推荐款式。"
                  : "选好手图后，我会直接拿当前这款美甲开始焕甲试戴。"
              }
              onSelectSavedHand={savedHandPicker.handleSavedHandSelect}
              onTakePhoto={() => void savedHandPicker.takePhotoNow()}
              onPickFromLibrary={() => void savedHandPicker.pickFromLibrary()}
            />
          ) : null}

          {displayedRecommendations.length ? (
            <View style={styles.resultSection}>
              <View style={styles.resultSectionHeader}>
                <Text style={[styles.resultSectionTitle, { color: colors.text }]}>为你推荐</Text>
                <Text style={[styles.resultSectionSubtitle, { color: colors.subtext }]} numberOfLines={1}>
                  {intent === "hand_match" ? "小嘉根据你的手图和需求挑了这些美甲" : "小嘉从热门池里挑了这些美甲"}
                </Text>
              </View>
              <View style={styles.recommendationList}>
                {displayedRecommendations.map((item) => (
                  <RecommendationCard
                    key={item.note_id}
                    item={item}
                    onPreview={() => {
                      void trackEvent("ai_recommendation_click", {
                        source: intent === "hand_match" ? "ask_ai_hand_match" : "ask_ai_text",
                        screen: "ask_ai",
                        properties: { note_id: item.note_id, score: item.score },
                      });
                      setPreviewItem(item);
                    }}
                    colors={colors}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {tryOnJobQuery.data?.status === "processing" || isStartingTryOn ? (
            <View style={[styles.processingCard, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.processingTitle, { color: colors.text }]}>正在帮你把美甲上手</Text>
              <Text style={[styles.processingText, { color: colors.subtext }]}>我正在用你选中的手图和款式生成试戴图，通常几秒内就会出来。</Text>
            </View>
          ) : null}

          {tryOnJobQuery.data?.status === "succeeded" && currentResultImageUrl ? (
            <View style={[styles.resultCard, { backgroundColor: colors.surface }]}>
              <View style={styles.resultCardHeader}>
                <Text style={[styles.resultCardTitle, { color: colors.text }]}>这次的上手效果</Text>
                {activeStyleQuery.data ? (
                  <View style={[styles.nailTypePill, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[styles.nailTypePillText, { color: colors.accent }]}>{getNailTypeLabel(activeStyleQuery.data.nail_type)}</Text>
                  </View>
                ) : null}
              </View>
              <Image source={{ uri: currentResultImageUrl }} style={[styles.resultImage, { backgroundColor: colors.accentSoft }]} />
              <View style={styles.resultActions}>
                <PrimaryButton label="满意，保存结果" onPress={saveTryOnResult} style={{ flex: 1 }} />
                <PrimaryButton
                  label={isHandmadeNail(activeStyleQuery.data?.nail_type) ? "选择商家预约" : "去超市下单"}
                  onPress={openTryOnNextStep}
                  disabled={!activeStyleQuery.data}
                  style={{ flex: 1 }}
                />
              </View>
              <View style={styles.resultActions}>
                <PrimaryButton
                  label="不太满意"
                  variant="ghost"
                  onPress={() => {
                    setTryOnFeedback("unsatisfied");
                    setAssistantLine(getAgentResultPrompt("unsatisfied"));
                  }}
                  style={{ flex: 1 }}
                />
                <PrimaryButton label="继续挑款" variant="ghost" onPress={() => setActiveJobId(null)} style={{ flex: 1 }} />
              </View>
              <View style={styles.resultSubActions}>
                <Pressable
                  style={[styles.subActionButton, { borderColor: colors.border }]}
                  onPress={() => setNeedsHandFor("tryon")}
                >
                  <Text style={[styles.subActionText, { color: colors.text }]}>换一张手图再试</Text>
                </Pressable>
                <Pressable
                  style={[styles.subActionButton, { borderColor: colors.border }]}
                  onPress={() => {
                    if (!activeJobId) return;
                    navigation.navigate("TryOnResult", { jobId: activeJobId });
                  }}
                >
                  <Text style={[styles.subActionText, { color: colors.text }]}>打开完整结果页</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {tryOnJobQuery.data?.status === "failed" ? (
            <View style={[styles.errorCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.dangerText} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.errorTitle, { color: colors.text }]}>这次试戴没有成功</Text>
                <Text style={[styles.errorText, { color: colors.subtext }]}>
                  {tryOnJobQuery.data.error_message ?? "可以换张手图，或者换一款美甲再试一次。"}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[styles.composerWrap, { backgroundColor: colors.background, paddingBottom: composerBottomInset }]}
          onLayout={(event) => {
            const nextHeight = Math.ceil(event.nativeEvent.layout.height);
            if (Math.abs(nextHeight - composerHeight) > 2) {
              setComposerHeight(nextHeight);
            }
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.quickPromptScroller}
            contentContainerStyle={styles.quickPromptList}
          >
            {ASK_AGENT_EXAMPLES.map((item) => (
              <ActionChip
                key={item}
                label={item}
                onPress={() => submitPrompt(item)}
                background={colors.surface}
                textColor={colors.text}
                disabled={chatMutation.isPending}
              />
            ))}
          </ScrollView>
          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.composerInput, { color: colors.text, opacity: chatMutation.isPending ? 0.45 : 1 }]}
              placeholder="有什么问题尽管问我..."
              placeholderTextColor={colors.subtext}
              value={promptText}
              onChangeText={setPromptText}
              returnKeyType="send"
              onSubmitEditing={() => submitPrompt()}
              editable={!chatMutation.isPending}
            />
            <AnimatedPressable style={styles.composerIcon} onPress={() => Alert.alert("语音输入即将上线", "这一步我先给你留好了入口。")}>
              <Ionicons name="mic-outline" size={22} color={colors.subtext} />
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.sendButton, { backgroundColor: colors.accent }]}
              onPress={() => submitPrompt()}
              disabled={chatMutation.isPending}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.sendButtonHalo,
                  {
                    backgroundColor: colors.accent,
                    opacity: sendHaloOpacity,
                    transform: [{ scale: sendHaloScale }],
                  },
                ]}
              />
              <Ionicons name="send" size={18} color="#ffffff" />
            </AnimatedPressable>
          </View>
        </View>

        <Modal visible={!!previewItem} transparent animationType="fade" onRequestClose={() => setPreviewItem(null)}>
          <Pressable style={styles.previewOverlay} onPress={() => setPreviewItem(null)}>
            <Pressable style={[styles.previewPanel, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
              {previewItem ? (
                <>
                  <Image source={{ uri: resolveAssetUrl(previewItem.image_url) }} style={[styles.previewImage, { backgroundColor: colors.accentSoft }]} />
                  <View style={styles.previewCopy}>
                    <View style={[styles.nailTypePill, { backgroundColor: colors.accentSoft }]}>
                      <Text style={[styles.nailTypePillText, { color: colors.accent }]}>穿戴甲</Text>
                    </View>
                    <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>
                      {previewItem.title}
                    </Text>
                    <Text style={[styles.previewReason, { color: colors.subtext }]} numberOfLines={2}>
                      {previewItem.reason}
                    </Text>
                    <PrimaryButton
                      label={materializingNoteId === previewItem.note_id ? "正在准备焕甲..." : "焕甲试戴"}
                      onPress={() => void startTryOnFromRecommendation(previewItem)}
                      disabled={materializingNoteId === previewItem.note_id || isStartingTryOn}
                    />
                  </View>
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
        <Modal visible={historyVisible} transparent animationType="fade" onRequestClose={() => setHistoryVisible(false)}>
          <View style={styles.historyOverlay}>
            <Pressable style={styles.historyBackdrop} onPress={() => setHistoryVisible(false)} />
            <View style={[styles.historyDrawer, { backgroundColor: colors.background }]}>
              <ScrollView contentContainerStyle={styles.historyDrawerContent} showsVerticalScrollIndicator={false}>
                <Pressable style={[styles.newConversationButton, { backgroundColor: colors.surface }]} onPress={createNewConversation}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.text} />
                  <Text style={[styles.newConversationText, { color: colors.text }]}>新建对话</Text>
                </Pressable>

                <Text style={[styles.historySectionLabel, { color: colors.subtext }]}>小嘉技能</Text>
                <View style={styles.historySkillRow}>
                  <Pressable
                    style={[styles.historySkillButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => {
                      setHistoryVisible(false);
                      submitPrompt("帮我找几款最近热门的显白猫眼");
                    }}
                  >
                    <Ionicons name="sparkles-outline" size={22} color={colors.text} />
                    <Text style={[styles.historySkillText, { color: colors.text }]}>找热门款</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.historySkillButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => {
                      setHistoryVisible(false);
                      submitPrompt("我的手适合哪些温柔裸粉美甲", { forceHandMatch: true });
                    }}
                  >
                    <Ionicons name="hand-left-outline" size={22} color={colors.text} />
                    <Text style={[styles.historySkillText, { color: colors.text }]}>适合我的手</Text>
                  </Pressable>
                </View>

                {historyGroups.length ? (
                  historyGroups.map((group) => (
                    <View key={group.title} style={styles.historyGroup}>
                      <Text style={[styles.historySectionLabel, { color: colors.subtext }]}>{group.title}</Text>
                      {group.items.map((conversation) => (
                        <Pressable key={conversation.id} style={styles.historyItem} onPress={() => openConversation(conversation)}>
                          <Text style={[styles.historyItemText, { color: colors.text }]} numberOfLines={1}>
                            {conversation.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ))
                ) : (
                  <View style={styles.historyEmpty}>
                    <Text style={[styles.historySectionLabel, { color: colors.subtext }]}>今天</Text>
                    <Text style={[styles.historyEmptyText, { color: colors.subtext }]}>还没有历史对话</Text>
                  </View>
                )}
                <Text style={[styles.historyEndText, { color: colors.subtext }]}>已经到底啦</Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal visible={debugVisible} transparent animationType="slide" onRequestClose={() => setDebugVisible(false)}>
          <View style={[styles.debugOverlay, { backgroundColor: colors.background }]}>
            <SafeAreaView style={styles.debugSafeArea}>
              <View style={[styles.debugHeader, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.debugTitle, { color: colors.text }]}>小嘉调试记录</Text>
                  <Text style={[styles.debugSubtitle, { color: colors.subtext }]}>最近 20 次 / 仅本机当前页面</Text>
                </View>
                <Pressable style={[styles.debugCloseButton, { backgroundColor: colors.surface }]} onPress={() => setDebugVisible(false)}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.debugContent} showsVerticalScrollIndicator>
                {chatDebugEntries.length ? (
                  chatDebugEntries.map((entry) => (
                    <View key={entry.id} style={[styles.debugCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.debugTime, { color: colors.subtext }]}>{new Date(entry.createdAt).toLocaleString()}</Text>
                      <Text style={[styles.debugLabel, { color: colors.text }]}>发送给后端</Text>
                      <Text selectable style={[styles.debugCode, { color: colors.text, backgroundColor: colors.surfaceAlt }]}>
                        {JSON.stringify(entry.request, null, 2)}
                      </Text>
                      <Text style={[styles.debugLabel, { color: colors.text }]}>{entry.error ? "错误" : entry.response ? "后端返回" : "等待返回"}</Text>
                      <Text selectable style={[styles.debugCode, { color: entry.error ? colors.dangerText : colors.text, backgroundColor: colors.surfaceAlt }]}>
                        {entry.error ?? (entry.response ? JSON.stringify(entry.response, null, 2) : "pending")}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.debugEmpty}>
                    <Text style={[styles.debugSubtitle, { color: colors.subtext }]}>还没有调试记录。发送一次问题后再长按菜单查看。</Text>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function groupConversations(conversations: AskAIConversation[]): ConversationGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const groups: ConversationGroup[] = [
    { title: "今天", items: [] },
    { title: "近 7 天", items: [] },
    { title: "更早", items: [] },
  ];

  for (const conversation of conversations) {
    if (conversation.updatedAt >= todayStart) {
      groups[0].items.push(conversation);
    } else if (conversation.updatedAt >= sevenDaysStart) {
      groups[1].items.push(conversation);
    } else {
      groups[2].items.push(conversation);
    }
  }
  return groups.filter((group) => group.items.length);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 16,
  },
  chatTopBar: {
    minHeight: 38,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  historyIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  conversationList: {
    gap: 10,
  },
  chatBubbleRow: {
    flexDirection: "row",
    width: "100%",
  },
  chatBubbleRowUser: {
    justifyContent: "flex-end",
  },
  chatBubbleRowAssistant: {
    justifyContent: "flex-start",
  },
  chatBubble: {
    maxWidth: "82%",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userBubble: {
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  chatBubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  chatBubbleSpinner: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  currentHandCard: {
    borderRadius: 24,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  currentHandCopy: {
    flex: 1,
    gap: 6,
  },
  currentHandTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  currentHandText: {
    lineHeight: 18,
  },
  currentHandImage: {
    width: 86,
    height: 86,
    borderRadius: 20,
  },
  selectionCard: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  selectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  selectionText: {
    lineHeight: 20,
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingInlineText: {
    fontSize: 13,
  },
  handList: {
    gap: 12,
    paddingRight: 8,
  },
  handSelectionCard: {
    width: 126,
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    gap: 8,
  },
  handSelectionImage: {
    width: 110,
    height: 110,
    borderRadius: 16,
  },
  handSelectionLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  handSelectionMeta: {
    fontSize: 12,
  },
  handActions: {
    flexDirection: "row",
    gap: 10,
  },
  resultSection: {
    gap: 14,
  },
  resultSectionHeader: {
    gap: 4,
  },
  resultSectionTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  resultSectionSubtitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  recommendationList: {
    gap: 12,
  },
  recommendationCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    gap: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  recommendationImageWrap: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
    width: 112,
    height: 134,
  },
  recommendationImage: {
    width: "100%",
    height: "100%",
  },
  recommendationBody: {
    flex: 1,
    gap: 8,
    minHeight: 134,
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  recommendationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  nailTypePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  nailTypePillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  recommendationTypeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  recommendationTypeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  recommendationReasonBox: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  recommendationReasonLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
  recommendationReason: {
    fontSize: 12,
    lineHeight: 17,
  },
  recommendationStats: {
    fontSize: 12,
    fontWeight: "700",
  },
  processingCard: {
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  processingTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  processingText: {
    textAlign: "center",
    lineHeight: 21,
  },
  resultCard: {
    borderRadius: 26,
    padding: 18,
    gap: 14,
  },
  resultCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  resultCardTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
  },
  resultImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
  },
  resultActions: {
    flexDirection: "row",
    gap: 10,
  },
  resultSubActions: {
    flexDirection: "row",
    gap: 10,
  },
  subActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  subActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  errorCard: {
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    lineHeight: 19,
  },
  composerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    gap: 10,
  },
  quickPromptScroller: {
    marginHorizontal: 0,
  },
  quickPromptList: {
    gap: 10,
    paddingHorizontal: 18,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 22,
    fontSize: 16,
  },
  composerIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sendButtonHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewPanel: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    aspectRatio: 0.82,
  },
  previewCopy: {
    padding: 16,
    gap: 6,
  },
  previewTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  previewReason: {
    fontSize: 14,
    lineHeight: 20,
  },
  historyOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  historyBackdrop: {
    flex: 1,
  },
  historyDrawer: {
    width: "68%",
    maxWidth: 360,
    minWidth: 282,
    height: "100%",
    shadowColor: "#000",
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
  },
  historyDrawerContent: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 44,
    gap: 24,
  },
  newConversationButton: {
    minHeight: 62,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  newConversationText: {
    fontSize: 16,
    fontWeight: "700",
  },
  historySectionLabel: {
    fontSize: 17,
    fontWeight: "700",
  },
  historySkillRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: -12,
  },
  historySkillButton: {
    flex: 1,
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  historySkillText: {
    fontSize: 15,
    fontWeight: "700",
  },
  historyGroup: {
    gap: 14,
  },
  historyItem: {
    minHeight: 34,
    justifyContent: "center",
  },
  historyItemText: {
    fontSize: 17,
    lineHeight: 23,
  },
  historyEmpty: {
    gap: 12,
  },
  historyEmptyText: {
    fontSize: 15,
    lineHeight: 21,
  },
  historyEndText: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 8,
  },
  debugOverlay: {
    flex: 1,
  },
  debugSafeArea: {
    flex: 1,
  },
  debugHeader: {
    minHeight: 68,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  debugTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  debugSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  debugCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  debugContent: {
    padding: 18,
    gap: 14,
  },
  debugCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  debugTime: {
    fontSize: 12,
  },
  debugLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  debugCode: {
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  debugEmpty: {
    paddingVertical: 40,
    alignItems: "center",
  },
});
