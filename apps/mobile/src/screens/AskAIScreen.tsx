import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { TryOnHandChooser } from "../components/TryOnHandChooser";
import { useHandPhotoPicker } from "../hooks/useHandPhotoPicker";
import { useTryOnLauncher } from "../hooks/useTryOnLauncher";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAskAIStore } from "../store/useAskAIStore";
import { useAuthStore } from "../store/useAuthStore";
import { AIChatMessage, RecommendationResponse } from "../types/api";
import {
  ASK_AGENT_EXAMPLES,
  ASK_AGENT_FILTERS,
  AskIntent,
  buildRecommendationQuery,
  getAgentHandPrompt,
  getAgentResultPrompt,
  inferAskIntent,
} from "../utils/askAgent";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

type RecommendationItem = RecommendationResponse["items"][number];

function formatPromptBoardDate() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return { month, day, year: now.getFullYear() };
}

function PreviewPromptCard({
  label,
  onPress,
  accent,
  background,
  textColor,
}: {
  label: string;
  onPress: () => void;
  accent: string;
  background: string;
  textColor: string;
}) {
  return (
    <Pressable style={[styles.previewPromptCard, { backgroundColor: background }]} onPress={onPress}>
      <View style={[styles.previewPromptIcon, { backgroundColor: accent }]}>
        <Ionicons name="sparkles" size={16} color="#ffffff" />
      </View>
      <Text style={[styles.previewPromptText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="arrow-forward" size={18} color={accent} />
    </Pressable>
  );
}

function ActionChip({
  label,
  onPress,
  background,
  textColor,
  active,
  activeBackground,
}: {
  label: string;
  onPress: () => void;
  background: string;
  textColor: string;
  active?: boolean;
  activeBackground?: string;
}) {
  return (
    <Pressable style={[styles.actionChip, { backgroundColor: active ? activeBackground ?? background : background }]} onPress={onPress}>
      <Text style={[styles.actionChipText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function RecommendationCard({
  item,
  active,
  disabled,
  buttonLabel,
  onPress,
  onPreview,
  colors,
}: {
  item: RecommendationItem;
  active: boolean;
  disabled: boolean;
  buttonLabel: string;
  onPress: () => void;
  onPreview: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={[
        styles.recommendationCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        active && { borderColor: colors.accent, shadowColor: colors.accent },
      ]}
    >
      <Pressable onPress={onPreview}>
        <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.recommendationImage, { backgroundColor: colors.accentSoft }]} />
      </Pressable>
      <View style={styles.recommendationBody}>
        <View style={styles.recommendationHeader}>
          <Text style={[styles.recommendationTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {active ? (
            <View style={[styles.activeBadge, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.activeBadgeText, { color: colors.accent }]}>当前方案</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.recommendationReason, { color: colors.subtext }]}>{item.reason}</Text>
        <View style={styles.tagRow}>
          {item.tags.slice(0, 4).map((tag) => (
            <View key={`${item.style_id}-${tag}`} style={[styles.tagPill, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.tagPillText, { color: colors.subtext }]}>#{tag}</Text>
            </View>
          ))}
        </View>
        <View style={styles.recommendationActions}>
          <PrimaryButton label={buttonLabel} onPress={onPress} disabled={disabled} style={{ flex: 1 }} />
          <Pressable style={[styles.previewButton, { borderColor: colors.border }]} onPress={onPreview}>
            <Text style={[styles.previewButtonText, { color: colors.text }]}>详情</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function AskAIScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const colors = useThemeColors();
  const isDarkMode = useIsDarkMode();
  const {
    handImageUri,
    promptText,
    selectedHandPhotoId,
    selectedStyleId,
    setHandImageUri,
    setPromptText,
    setSelectedHandPhotoId,
    setSelectedStyleId,
  } = useAskAIStore();
  const token = useAuthStore((state) => state.token);

  const [askedQuery, setAskedQuery] = useState("");
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
  const [intent, setIntent] = useState<AskIntent | null>(null);
  const [assistantLine, setAssistantLine] = useState("想看热门款、适合你的款式，或者直接挑一款先试戴，都可以问我。");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [needsHandFor, setNeedsHandFor] = useState<"recommend" | "tryon" | null>(null);
  const [queuedTryOnStyleId, setQueuedTryOnStyleId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [tryOnFeedback, setTryOnFeedback] = useState<"idle" | "satisfied" | "unsatisfied">("idle");
  const [composerHeight, setComposerHeight] = useState(158);
  const today = useMemo(formatPromptBoardDate, []);

  const chatMutation = useMutation({
    mutationFn: (messages: AIChatMessage[]) => api.chat(messages),
    onSuccess: (data, messages) => {
      setAssistantLine(data.reply);
      setChatMessages([...messages, { role: "assistant" as const, content: data.reply }].slice(-12));
    },
    onError: () => {
      setAssistantLine("我暂时没连上小嘉大模型，但仍会先按图库帮你挑适合试戴的款式。");
    },
  });

  const recommendMutation = useMutation({
    mutationFn: ({ queryText, nextIntent }: { queryText: string; nextIntent: AskIntent }) => api.recommend(queryText),
    onSuccess: (data) => {
      setRecommendations(data.items);
      setNeedsHandFor(null);
    },
    onError: () => {
      setRecommendations([]);
      if (!chatMutation.isPending) {
        setAssistantLine("这次没顺利找到结果，换个说法或者换个关键词再问我一次。");
      }
    },
  });

  const tryOnJobQuery = useQuery({
    queryKey: ["ask-ai-job", activeJobId],
    queryFn: () => api.getTryOnJob(activeJobId as string),
    enabled: !!token && !!activeJobId,
    refetchInterval: (queryState) => {
      const status = queryState.state.data?.status;
      return status === "succeeded" || status === "failed" ? false : 2000;
    },
  });

  const handleHandReady = (payload: { imageUri: string; handPhotoId?: string | null }) => {
    setSelectedHandPhotoId(payload.handPhotoId ?? null);
    setHandImageUri(payload.imageUri);
    setNeedsHandFor(null);

    if (intent === "hand_match" && askedQuery && recommendations.length === 0) {
      setAssistantLine("收到这张手图，我先按你的问题给你挑几款更适合先试的美甲。");
      recommendMutation.mutate({ queryText: buildRecommendationQuery("hand_match", askedQuery), nextIntent: "hand_match" });
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
  const displayedRecommendations = useMemo(() => {
    if (tryOnFeedback !== "unsatisfied" || !selectedStyleId) {
      return recommendations;
    }
    return recommendations.filter((item) => item.style_id !== selectedStyleId);
  }, [recommendations, selectedStyleId, tryOnFeedback]);

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
    } else if (status === "failed") {
      setAssistantLine(getAgentResultPrompt("failed"));
    }
  }, [queryClient, tryOnJobQuery.data?.status]);

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

  const submitPrompt = (nextPrompt?: string) => {
    const query = (nextPrompt ?? promptText).trim();
    if (!query) return;

    const nextIntent = inferAskIntent(query);
    setPromptText("");
    setAskedQuery(query);
    setIntent(nextIntent);
    setRecommendations([]);
    setSelectedStyleId(null);
    setActiveJobId(null);
    setTryOnFeedback("idle");
    setQueuedTryOnStyleId(null);
    recommendMutation.reset();
    chatMutation.reset();
    queryClient.removeQueries({ queryKey: ["ask-ai-job"] });

    if (nextIntent === "hand_match" && !hasHandSelection) {
      setNeedsHandFor("recommend");
      setAssistantLine(getAgentHandPrompt(nextIntent, "recommend"));
      return;
    }

    setNeedsHandFor(null);
    setAssistantLine("我先理解你的需求，再从图库里挑适合的款式。");
    const nextMessages: AIChatMessage[] = [...chatMessages, { role: "user" as const, content: query }].slice(-12);
    setChatMessages(nextMessages);
    chatMutation.mutate(nextMessages);
    recommendMutation.mutate({ queryText: buildRecommendationQuery(nextIntent, query), nextIntent });
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

  const currentResultImageUrl = tryOnJobQuery.data?.result_image_url ? resolveAssetUrl(tryOnJobQuery.data.result_image_url) : null;
  const showingHandChooser = needsHandFor !== null;
  const composerBottomInset = Math.max(tabBarHeight - 74, 12);
  const scrollBottomPadding = composerHeight + 18;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={[styles.heroGlow, { backgroundColor: isDarkMode ? "#271f2a" : "#e8defc" }]} />
            <View style={[styles.heroGlowSecondary, { backgroundColor: isDarkMode ? "#1e232d" : "#dce9ff" }]} />
            <Pressable
              style={[styles.historyButton, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate("TryOnHistory")}
            >
              <Ionicons name="time-outline" size={22} color={colors.text} />
            </Pressable>
            <View style={[styles.logoHalo, { borderColor: `${colors.surface}cc`, backgroundColor: `${colors.surface}aa` }]}>
              <Text style={[styles.logoTitle, { color: colors.text }]}>小嘉</Text>
              <Text style={[styles.logoSubtitle, { color: colors.subtext }]}>懂甲色，更懂你</Text>
            </View>
          </View>

          <View style={[styles.promptBoard, { backgroundColor: `${colors.surface}dd`, borderColor: `${colors.border}aa` }]}>
            <View style={styles.promptBoardHeader}>
              <Text style={[styles.promptBoardTitle, { color: colors.text }]}>试试这样问我</Text>
              <View style={styles.dateBlock}>
                <Text style={[styles.dateDay, { color: colors.text }]}>{today.day}</Text>
                <View>
                  <Text style={[styles.dateMeta, { color: colors.subtext }]}>{today.month}月</Text>
                  <Text style={[styles.dateMeta, { color: colors.subtext }]}>{today.year}</Text>
                </View>
              </View>
            </View>
            <View style={styles.previewPromptList}>
              {ASK_AGENT_EXAMPLES.map((item) => (
                <PreviewPromptCard
                  key={item}
                  label={item}
                  onPress={() => submitPrompt(item)}
                  accent={colors.accent}
                  background={colors.surface}
                  textColor={colors.text}
                />
              ))}
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>小嘉能帮你</Text>
            <View style={styles.filterRow}>
              {ASK_AGENT_FILTERS.map((item) => (
                <ActionChip
                  key={item}
                  label={item}
                  onPress={() => {
                    setPromptText(item);
                    submitPrompt(item);
                  }}
                  background={colors.surface}
                  activeBackground={colors.accentSoft}
                  textColor={colors.text}
                />
              ))}
            </View>
          </View>

          {askedQuery ? (
            <View style={[styles.messageCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.messageLabel, { color: colors.subtext }]}>你刚刚问</Text>
              <Text style={[styles.messageTitle, { color: colors.text }]}>{askedQuery}</Text>
            </View>
          ) : null}

          <View style={[styles.assistantCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.assistantBadge, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="sparkles" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.assistantTitleRow}>
                <Text style={[styles.assistantTitle, { color: colors.text }]}>{chatMutation.isPending ? "小嘉正在想" : "小嘉助手"}</Text>
                {chatMutation.isPending ? <ActivityIndicator size="small" color={colors.accent} /> : null}
              </View>
              <Text style={[styles.assistantText, { color: colors.subtext }]}>{assistantLine}</Text>
            </View>
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
                recentHandPhotos.length
                  ? "我先把你最近的 5 张手图摆出来，你可以直接挑一张继续。"
                  : "你还没有可用的手图，先拍一张，或者从相册里选一张以前拍过的。"
              }
              recentHandPhotos={recentHandPhotos}
              selectedHandPhotoId={selectedHandPhotoId}
              loading={token ? savedHandsLoading : false}
              busy={isStartingTryOn}
              onSelectSavedHand={savedHandPicker.handleSavedHandSelect}
              onTakePhoto={() => void savedHandPicker.takePhotoNow()}
              onPickFromLibrary={() => void savedHandPicker.pickFromLibrary()}
            />
          ) : null}

          {recommendMutation.isPending ? (
            <View style={[styles.stateCard, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.stateText, { color: colors.subtext }]}>小嘉正在整理推荐列表</Text>
            </View>
          ) : null}

          {displayedRecommendations.length ? (
            <View style={styles.resultSection}>
              <Text style={[styles.resultSectionTitle, { color: colors.text }]}>
                {intent === "hand_match" ? "这几款更适合先拿来上手看看" : "先从这几款开始看"}
              </Text>
              <View style={styles.recommendationList}>
                {displayedRecommendations.map((item) => {
                  const isActive = item.style_id === selectedStyleId;
                  let buttonLabel = "试试这款";
                  if (isStartingTryOn && isActive) {
                    buttonLabel = "试戴中";
                  } else if (tryOnJobQuery.data?.status === "processing" && isActive) {
                    buttonLabel = "融合中";
                  } else if (tryOnFeedback === "unsatisfied") {
                    buttonLabel = "换这款试戴";
                  } else if (tryOnFeedback === "satisfied" && isActive) {
                    buttonLabel = "当前最满意";
                  }
                  return (
                    <RecommendationCard
                      key={item.style_id}
                      item={item}
                      active={isActive}
                      disabled={isStartingTryOn || tryOnJobQuery.data?.status === "processing"}
                      buttonLabel={buttonLabel}
                      onPress={() => startTryOn(item.style_id)}
                      onPreview={() => navigation.navigate("StylePreview", { styleId: item.style_id })}
                      colors={colors}
                    />
                  );
                })}
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
              <Text style={[styles.resultCardTitle, { color: colors.text }]}>这次的上手效果</Text>
              <Image source={{ uri: currentResultImageUrl }} style={[styles.resultImage, { backgroundColor: colors.accentSoft }]} />
              <View style={styles.resultActions}>
                <PrimaryButton label="满意，保存结果" onPress={saveTryOnResult} style={{ flex: 1 }} />
                <PrimaryButton
                  label="不太满意"
                  variant="ghost"
                  onPress={() => {
                    setTryOnFeedback("unsatisfied");
                    setAssistantLine(getAgentResultPrompt("unsatisfied"));
                  }}
                  style={{ flex: 1 }}
                />
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
          <View style={[styles.quickActionRow, { backgroundColor: colors.background }]}>
            <ActionChip
              label="找热门款"
              onPress={() => submitPrompt("帮我找几款最近热门的显白美甲")}
              background={colors.surface}
              textColor={colors.text}
            />
            <ActionChip
              label="适合我的手"
              onPress={() => submitPrompt("我的手适合哪些显白又温柔的美甲")}
              background={colors.surface}
              textColor={colors.text}
            />
            <ActionChip
              label="看看裸粉"
              onPress={() => submitPrompt("帮我找几款适合通勤的裸粉美甲")}
              background={colors.surface}
              textColor={colors.text}
            />
          </View>
          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.composerInput, { color: colors.text }]}
              placeholder="有什么问题尽管问我..."
              placeholderTextColor={colors.subtext}
              value={promptText}
              onChangeText={setPromptText}
              returnKeyType="send"
              onSubmitEditing={() => submitPrompt()}
            />
            <Pressable style={styles.composerIcon} onPress={() => Alert.alert("语音输入即将上线", "这一步我先给你留好了入口。")}>
              <Ionicons name="mic-outline" size={22} color={colors.subtext} />
            </Pressable>
            <Pressable style={[styles.sendButton, { backgroundColor: colors.accent }]} onPress={() => submitPrompt()}>
              <Ionicons name="send" size={18} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 16,
  },
  hero: {
    height: 220,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -30,
    opacity: 0.85,
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    bottom: -50,
    left: -30,
    opacity: 0.58,
  },
  historyButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  logoHalo: {
    width: 206,
    height: 206,
    borderRadius: 103,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    gap: 8,
  },
  logoTitle: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 1,
  },
  logoSubtitle: {
    fontSize: 16,
    letterSpacing: 2,
  },
  promptBoard: {
    borderRadius: 28,
    padding: 18,
    gap: 14,
    borderWidth: 1,
  },
  promptBoardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promptBoardTitle: {
    fontSize: 28,
    fontWeight: "800",
  },
  dateBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateDay: {
    fontSize: 28,
    fontWeight: "800",
  },
  dateMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  previewPromptList: {
    gap: 12,
  },
  previewPromptCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewPromptIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  previewPromptText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionChip: {
    minHeight: 42,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipText: {
    fontSize: 15,
    fontWeight: "600",
  },
  messageCard: {
    borderRadius: 24,
    padding: 18,
    gap: 6,
  },
  messageLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  assistantCard: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
    flexDirection: "row",
    borderWidth: 1,
  },
  assistantBadge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  assistantTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  assistantTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assistantText: {
    fontSize: 14,
    lineHeight: 20,
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
  stateCard: {
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stateText: {
    fontSize: 14,
  },
  resultSection: {
    gap: 12,
  },
  resultSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  recommendationList: {
    gap: 14,
  },
  recommendationCard: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: "hidden",
  },
  recommendationImage: {
    width: "100%",
    aspectRatio: 1.1,
  },
  recommendationBody: {
    padding: 16,
    gap: 10,
  },
  recommendationHeader: {
    gap: 8,
  },
  recommendationTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  activeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  recommendationReason: {
    lineHeight: 19,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  recommendationActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  previewButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  previewButtonText: {
    fontSize: 14,
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
  resultCardTitle: {
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
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
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
  },
});
