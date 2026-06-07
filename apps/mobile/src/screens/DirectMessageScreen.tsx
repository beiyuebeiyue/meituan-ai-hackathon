import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { BookingSheet } from "../components/BookingSheet";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuthStore } from "../store/useAuthStore";
import { DirectMessage } from "../types/api";
import { useThemeColors } from "../utils/theme";
import { DEFAULT_AVATAR_SOURCE } from "../constants/imageSources";

const defaultAvatar = DEFAULT_AVATAR_SOURCE;

type ScreenRoute = RouteProp<RootStackParamList, "DirectMessage">;
const emojiGroups = [
  {
    key: "smile",
    label: "精选",
    items: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "🙃",
    ],
  },
  {
    key: "love",
    label: "黄脸",
    items: [
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😙",
      "😚",
      "😋",
      "😛",
      "😝",
      "😜",
    ],
  },
  {
    key: "mood",
    label: "情绪",
    items: [
      "🤪",
      "🤨",
      "🧐",
      "🤓",
      "😎",
      "🥳",
      "😏",
      "😒",
      "😞",
      "😔",
      "😟",
      "😕",
    ],
  },
  {
    key: "sad",
    label: "哭笑",
    items: [
      "🙁",
      "☹️",
      "😣",
      "😖",
      "😫",
      "😩",
      "🥺",
      "😢",
      "😭",
      "😤",
      "😠",
      "😡",
    ],
  },
] as const;

function formatMessageTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function DirectMessageScreen() {
  const navigation = useNavigation<any>();
  const dismissOverlay = useSlideOverlayDismiss();
  const route = useRoute<ScreenRoute>();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const currentUser = useAuthStore((state) => state.user);
  const [message, setMessage] = useState("");
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const [morePanelOpen, setMorePanelOpen] = useState(false);
  const [likedStylesOpen, setLikedStylesOpen] = useState(false);
  const [bookingInviteShop, setBookingInviteShop] = useState<
    DirectMessage["booking_invite"] | null
  >(null);
  const [activeEmojiGroup, setActiveEmojiGroup] =
    useState<(typeof emojiGroups)[number]["key"]>("smile");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const sentInitialPayloadRef = useRef(false);

  const query = useQuery({
    queryKey: ["conversation", route.params.userId],
    queryFn: () => api.getConversation(route.params.userId),
  });
  const thread = query.data;
  const likedStylesQuery = useQuery({
    queryKey: ["liked-styles", "direct-message-picker"],
    queryFn: api.getLikedStyles,
    enabled: morePanelOpen && likedStylesOpen,
  });

  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    void queryClient.invalidateQueries({ queryKey: ["message-inbox"] });
    void queryClient.invalidateQueries({ queryKey: ["stranger-messages"] });
  }, [query.dataUpdatedAt, queryClient]);

  const scrollToLatest = (animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  useEffect(() => {
    if (!thread?.items.length) return;
    scrollToLatest(false);
  }, [thread?.items.length, route.params.userId]);

  const sendMutation = useMutation({
    mutationFn: () => api.sendMessage(route.params.userId, message),
    onSuccess: async () => {
      setMessage("");
      setEmojiPanelOpen(false);
      setMorePanelOpen(false);
      setLikedStylesOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversation", route.params.userId],
        }),
        queryClient.invalidateQueries({ queryKey: ["message-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["stranger-messages"] }),
      ]);
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        detail = parsed.detail ?? detail;
      } catch {
        // ignore parse failures
      }
      Alert.alert("发送失败", detail);
    },
  });

  const imageMutation = useMutation({
    mutationFn: ({
      imageUri,
      content,
    }: {
      imageUri: string;
      content: string;
    }) => api.sendImageMessage(route.params.userId, imageUri, content),
    onSuccess: async () => {
      setMessage("");
      setEmojiPanelOpen(false);
      setMorePanelOpen(false);
      setLikedStylesOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversation", route.params.userId],
        }),
        queryClient.invalidateQueries({ queryKey: ["message-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["stranger-messages"] }),
      ]);
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        detail = parsed.detail ?? detail;
      } catch {
        // ignore parse failures
      }
      Alert.alert("图片发送失败", detail);
    },
  });

  const styleMessageMutation = useMutation({
    mutationFn: ({ styleId, content }: { styleId: string; content?: string }) =>
      api.sendStyleMessage(route.params.userId, styleId, content ?? ""),
    onSuccess: async () => {
      setMessage("");
      setEmojiPanelOpen(false);
      setMorePanelOpen(false);
      setLikedStylesOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversation", route.params.userId],
        }),
        queryClient.invalidateQueries({ queryKey: ["message-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["stranger-messages"] }),
      ]);
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        detail = parsed.detail ?? detail;
      } catch {
        // ignore parse failures
      }
      Alert.alert("发送失败", detail);
    },
  });

  const tryOnResultMessageMutation = useMutation({
    mutationFn: ({
      tryOnJobId,
      content,
    }: {
      tryOnJobId: string;
      content?: string;
    }) =>
      api.sendTryOnResultMessage(
        route.params.userId,
        tryOnJobId,
        content ?? "",
      ),
    onSuccess: async () => {
      setMessage("");
      setEmojiPanelOpen(false);
      setMorePanelOpen(false);
      setLikedStylesOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversation", route.params.userId],
        }),
        queryClient.invalidateQueries({ queryKey: ["message-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["stranger-messages"] }),
      ]);
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        detail = parsed.detail ?? detail;
      } catch {
        // ignore parse failures
      }
      Alert.alert("发送失败", detail);
    },
  });

  const bookingInviteMutation = useMutation({
    mutationFn: () => api.sendBookingInviteMessage(route.params.userId),
    onSuccess: async () => {
      setEmojiPanelOpen(false);
      setMorePanelOpen(false);
      setLikedStylesOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversation", route.params.userId],
        }),
        queryClient.invalidateQueries({ queryKey: ["message-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["stranger-messages"] }),
      ]);
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        detail = parsed.detail ?? detail;
      } catch {
        // ignore parse failures
      }
      Alert.alert("邀请失败", detail);
    },
  });

  const hasDraft = Boolean(message.trim());
  const isSending =
    sendMutation.isPending ||
    imageMutation.isPending ||
    styleMessageMutation.isPending ||
    tryOnResultMessageMutation.isPending ||
    bookingInviteMutation.isPending;
  const canSend = Boolean(thread?.can_send && !isSending && hasDraft);
  const canUseMoreActions = Boolean(thread?.can_send && !isSending);
  const canSendImage = canUseMoreActions;
  const canSendBookingInvite = Boolean(
    canUseMoreActions &&
    currentUser?.role === "merchant" &&
    thread?.target.role === "consumer",
  );

  const bubbleBorderColor = useMemo(() => colors.border, [colors.border]);

  useEffect(() => {
    if (sentInitialPayloadRef.current || !thread?.can_send) return;
    if (route.params.initialTryOnJobId) {
      sentInitialPayloadRef.current = true;
      tryOnResultMessageMutation.mutate({
        tryOnJobId: route.params.initialTryOnJobId,
        content: route.params.initialMessage,
      });
      return;
    }
    if (route.params.initialStyleId) {
      sentInitialPayloadRef.current = true;
      styleMessageMutation.mutate({
        styleId: route.params.initialStyleId,
        content: route.params.initialMessage,
      });
    }
  }, [
    route.params.initialMessage,
    route.params.initialStyleId,
    route.params.initialTryOnJobId,
    styleMessageMutation,
    thread?.can_send,
    tryOnResultMessageMutation,
  ]);

  const insertEmoji = (emoji: string) => {
    const start = selection.start ?? message.length;
    const end = selection.end ?? message.length;
    const nextMessage = `${message.slice(0, start)}${emoji}${message.slice(end)}`;
    const nextCursor = start + emoji.length;
    setMessage(nextMessage);
    setSelection({ start: nextCursor, end: nextCursor });
  };

  const toggleEmojiPanel = () => {
    setEmojiPanelOpen((current) => {
      const next = !current;
      if (next) {
        setMorePanelOpen(false);
        setLikedStylesOpen(false);
        Keyboard.dismiss();
      }
      return next;
    });
  };

  const toggleMorePanel = () => {
    setMorePanelOpen((current) => {
      const next = !current;
      if (next) {
        setEmojiPanelOpen(false);
        Keyboard.dismiss();
      } else {
        setLikedStylesOpen(false);
      }
      return next;
    });
  };

  const pickMessageImage = async () => {
    if (!canSendImage) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!result.canceled) {
      imageMutation.mutate({
        imageUri: result.assets[0].uri,
        content: message.trim(),
      });
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <Pressable
            style={styles.headerAction}
            onPress={() => dismissOverlay?.() ?? navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerCenter}
            disabled={!thread || thread.target.role !== "merchant"}
            onPress={() => {
              if (thread?.target.role === "merchant") {
                navigation.navigate("AuthorProfile", {
                  authorId: thread.target.id,
                });
              }
            }}
          >
            <Image
              source={
                thread?.target.avatar_url
                  ? { uri: resolveAssetUrl(thread.target.avatar_url) }
                  : defaultAvatar
              }
              style={[
                styles.headerAvatar,
                { backgroundColor: colors.surfaceAlt },
              ]}
            />
            <Text style={[styles.headerName, { color: colors.text }]}>
              {thread?.target.username ?? "私信"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.headerAction}
            onPress={() =>
              Alert.alert("更多", "不再看她的操作请在作者主页右上角中完成。")
            }
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={colors.text}
            />
          </Pressable>
        </View>

        {thread?.notice ? (
          <Text style={[styles.notice, { color: colors.subtext }]}>
            {thread.notice}
          </Text>
        ) : null}

        <FlatList
          ref={listRef}
          data={thread?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => {
            if (thread?.items.length) {
              scrollToLatest();
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                发一条消息，开始这段对话。
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageRow,
                item.is_mine ? styles.mineRow : styles.otherRow,
              ]}
            >
              {!item.is_mine ? (
                <Image
                  source={
                    thread?.target.avatar_url
                      ? { uri: resolveAssetUrl(thread.target.avatar_url) }
                      : defaultAvatar
                  }
                  style={[
                    styles.messageAvatar,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                />
              ) : null}
              <View style={styles.messageContent}>
                <View
                  style={[
                    styles.messageBubble,
                    {
                      backgroundColor: item.is_mine
                        ? colors.accent
                        : colors.surface,
                      borderColor: item.is_mine ? colors.accent : bubbleBorderColor,
                    },
                  ]}
                >
                  {item.image_url && item.shared_style ? (
                    <Text
                      style={[
                        styles.tryOnImageLabel,
                        {
                          color: item.is_mine
                            ? "rgba(255,255,255,0.82)"
                            : colors.subtext,
                        },
                      ]}
                    >
                      焕甲结果图
                    </Text>
                  ) : null}
                  {item.image_url ? (
                    <Image
                      source={{ uri: resolveAssetUrl(item.image_url) }}
                      style={styles.messageImage}
                    />
                  ) : null}
                  {item.shared_style ? (
                    <Pressable
                      style={[
                        styles.sharedStyleCard,
                        {
                          backgroundColor: item.is_mine
                            ? "rgba(255,255,255,0.14)"
                            : colors.surfaceAlt,
                        },
                      ]}
                      onPress={() =>
                        navigation.navigate("StylePreview", {
                          styleId: item.shared_style?.id,
                        })
                      }
                    >
                      <Image
                        source={{
                          uri: resolveAssetUrl(item.shared_style.image_url),
                        }}
                        style={styles.sharedStyleImage}
                      />
                      <View style={styles.sharedStyleTextBlock}>
                        <Text
                          style={[
                            styles.sharedStyleTitle,
                            { color: item.is_mine ? "#ffffff" : colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {item.shared_style.title}
                        </Text>
                        <Text
                          style={[
                            styles.sharedStyleMeta,
                            {
                              color: item.is_mine
                                ? "rgba(255,255,255,0.78)"
                                : colors.subtext,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.shared_style.author_name} ·{" "}
                          {item.shared_style.like_count}赞
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                  {item.booking_invite ? (
                    <Pressable
                      style={[
                        styles.bookingInviteCard,
                        {
                          backgroundColor: item.is_mine
                            ? "rgba(255,255,255,0.14)"
                            : colors.surfaceAlt,
                        },
                      ]}
                      disabled={
                        item.is_mine || currentUser?.role !== "consumer"
                      }
                      onPress={() =>
                        setBookingInviteShop(item.booking_invite ?? null)
                      }
                    >
                      <View style={styles.bookingInviteHeader}>
                        <View
                          style={[
                            styles.bookingInviteIcon,
                            {
                              backgroundColor: item.is_mine
                                ? "rgba(255,255,255,0.2)"
                                : colors.accentSoft,
                            },
                          ]}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={18}
                            color={item.is_mine ? "#ffffff" : colors.accent}
                          />
                        </View>
                        <Text
                          style={[
                            styles.bookingInviteTitle,
                            { color: item.is_mine ? "#ffffff" : colors.text },
                          ]}
                        >
                          邀请预约
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.bookingInviteMeta,
                          {
                            color: item.is_mine
                              ? "rgba(255,255,255,0.78)"
                              : colors.subtext,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.booking_invite.shop_name} ·{" "}
                        {item.booking_invite.shop_city}
                        {item.booking_invite.shop_address
                          ? `\n${item.booking_invite.shop_address}`
                          : ""}
                      </Text>
                      <Text
                        style={[
                          styles.bookingInviteCta,
                          { color: item.is_mine ? "#ffffff" : colors.accent },
                        ]}
                      >
                        {item.is_mine
                          ? "等待对方选择时间"
                          : currentUser?.role === "consumer"
                            ? "选择时间预约"
                            : "预约邀请"}
                      </Text>
                    </Pressable>
                  ) : null}
                  {item.content ? (
                    <Text
                      style={[
                        styles.messageText,
                        { color: item.is_mine ? "#ffffff" : colors.text },
                      ]}
                    >
                      {item.content}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.messageTime, { color: colors.subtext }]}>
                  {formatMessageTime(item.created_at)}
                </Text>
              </View>
            </View>
          )}
        />

        <View
          style={[
            styles.composerWrap,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <View
            style={[
              styles.inputShell,
              { backgroundColor: colors.input, borderColor: colors.border },
            ]}
          >
            <Pressable
              style={styles.iconButton}
              onPress={() => Alert.alert("语音", "语音私信后续补充。")}
            >
              <Ionicons name="mic-outline" size={22} color={colors.subtext} />
            </Pressable>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="发消息..."
              placeholderTextColor={colors.subtext}
              style={[styles.input, { color: colors.text }]}
              editable={Boolean(thread?.can_send)}
              onFocus={() => {
                setEmojiPanelOpen(false);
                setMorePanelOpen(false);
              }}
              onSelectionChange={(event) =>
                setSelection(event.nativeEvent.selection)
              }
            />
            <Pressable style={styles.iconButton} onPress={toggleEmojiPanel}>
              <Ionicons
                name={emojiPanelOpen ? "happy" : "happy-outline"}
                size={22}
                color={emojiPanelOpen ? colors.accent : colors.subtext}
              />
            </Pressable>
            {hasDraft ? (
              <Pressable
                style={[
                  styles.inlineSendButton,
                  { backgroundColor: canSend ? colors.accent : colors.border },
                ]}
                disabled={!canSend}
                onPress={() => sendMutation.mutate()}
              >
                <Ionicons name="paper-plane" size={18} color="#ffffff" />
              </Pressable>
            ) : (
              <Pressable
                style={styles.iconButton}
                disabled={!canSendImage}
                onPress={toggleMorePanel}
              >
                <Ionicons
                  name={morePanelOpen ? "add-circle" : "add-circle-outline"}
                  size={25}
                  color={morePanelOpen ? colors.accent : colors.subtext}
                />
              </Pressable>
            )}
          </View>
          {morePanelOpen && !hasDraft ? (
            <View style={[styles.morePanel, { backgroundColor: colors.input }]}>
              <View style={styles.moreActionRow}>
                <Pressable
                  style={[
                    styles.moreAction,
                    {
                      backgroundColor: colors.background,
                      opacity: canSendImage ? 1 : 0.5,
                    },
                  ]}
                  disabled={!canSendImage}
                  onPress={() => void pickMessageImage()}
                >
                  <View
                    style={[
                      styles.moreActionIcon,
                      { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={[styles.moreActionText, { color: colors.text }]}>
                    图片
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.moreAction,
                    {
                      backgroundColor: colors.background,
                      opacity: canSendImage ? 1 : 0.5,
                    },
                  ]}
                  disabled={!canSendImage}
                  onPress={() => setLikedStylesOpen((current) => !current)}
                >
                  <View
                    style={[
                      styles.moreActionIcon,
                      { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Ionicons
                      name="heart-outline"
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={[styles.moreActionText, { color: colors.text }]}>
                    喜爱美甲
                  </Text>
                </Pressable>
                {currentUser?.role === "merchant" ? (
                  <Pressable
                    style={[
                      styles.moreAction,
                      {
                        backgroundColor: colors.background,
                        opacity: canSendBookingInvite ? 1 : 0.5,
                      },
                    ]}
                    disabled={!canSendBookingInvite}
                    onPress={() => bookingInviteMutation.mutate()}
                  >
                    <View
                      style={[
                        styles.moreActionIcon,
                        { backgroundColor: colors.accentSoft },
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={22}
                        color={colors.accent}
                      />
                    </View>
                    <Text
                      style={[styles.moreActionText, { color: colors.text }]}
                    >
                      邀请预约
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {likedStylesOpen ? (
                <View style={styles.likedPicker}>
                  {likedStylesQuery.isLoading ? (
                    <Text
                      style={[
                        styles.likedPickerHint,
                        { color: colors.subtext },
                      ]}
                    >
                      正在加载喜爱美甲...
                    </Text>
                  ) : (likedStylesQuery.data?.items ?? []).length ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.likedPickerScroll}
                    >
                      {(likedStylesQuery.data?.items ?? []).map((style) => (
                        <Pressable
                          key={style.id}
                          style={[
                            styles.likedStyleCard,
                            { backgroundColor: colors.background },
                          ]}
                          disabled={styleMessageMutation.isPending}
                          onPress={() =>
                            styleMessageMutation.mutate({ styleId: style.id })
                          }
                        >
                          <Image
                            source={{ uri: resolveAssetUrl(style.image_url) }}
                            style={styles.likedStyleImage}
                          />
                          <Text
                            style={[
                              styles.likedStyleTitle,
                              { color: colors.text },
                            ]}
                            numberOfLines={2}
                          >
                            {style.title}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text
                      style={[
                        styles.likedPickerHint,
                        { color: colors.subtext },
                      ]}
                    >
                      还没有点赞过的美甲。
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
          {emojiPanelOpen ? (
            <View
              style={[styles.emojiPanel, { backgroundColor: colors.input }]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.emojiCategoryRow}
              >
                {emojiGroups.map((group) => {
                  const active = activeEmojiGroup === group.key;
                  return (
                    <Pressable
                      key={group.key}
                      style={[
                        styles.emojiCategoryChip,
                        {
                          backgroundColor: active
                            ? colors.accent
                            : colors.background,
                        },
                      ]}
                      onPress={() => setActiveEmojiGroup(group.key)}
                    >
                      <Text
                        style={[
                          styles.emojiCategoryText,
                          { color: active ? "#ffffff" : colors.subtext },
                        ]}
                      >
                        {group.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.emojiGrid}>
                {emojiGroups
                  .find((group) => group.key === activeEmojiGroup)
                  ?.items.map((emoji) => (
                    <Pressable
                      key={emoji}
                      style={styles.emojiCell}
                      onPress={() => insertEmoji(emoji)}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <BookingSheet
        visible={Boolean(bookingInviteShop)}
        shopId={bookingInviteShop?.shop_id ?? null}
        shopName={bookingInviteShop?.shop_name ?? null}
        shopCity={bookingInviteShop?.shop_city ?? null}
        styleId={null}
        onClose={() => setBookingInviteShop(null)}
        onSuccess={() => setBookingInviteShop(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerAction: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerName: {
    fontSize: 18,
    fontWeight: "700",
  },
  notice: {
    textAlign: "center",
    paddingHorizontal: 28,
    paddingTop: 18,
    lineHeight: 24,
    fontSize: 15,
  },
  messageList: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 16,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
  },
  messageRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  mineRow: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  otherRow: {
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  messageAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  messageContent: {
    gap: 6,
    maxWidth: "78%",
  },
  messageBubble: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 8,
  },
  messageImage: {
    width: 180,
    height: 180,
    borderRadius: 16,
  },
  tryOnImageLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  sharedStyleCard: {
    width: 220,
    borderRadius: 18,
    overflow: "hidden",
  },
  sharedStyleImage: {
    width: "100%",
    height: 132,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  sharedStyleTextBlock: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  sharedStyleTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  sharedStyleMeta: {
    fontSize: 12,
    fontWeight: "700",
  },
  bookingInviteCard: {
    width: 220,
    borderRadius: 18,
    padding: 12,
    gap: 8,
  },
  bookingInviteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bookingInviteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bookingInviteTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  bookingInviteMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  bookingInviteCta: {
    fontSize: 13,
    fontWeight: "900",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 12,
  },
  composerWrap: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
  },
  inputShell: {
    minHeight: 54,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineSendButton: {
    width: 38,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  morePanel: {
    borderRadius: 20,
    padding: 12,
  },
  moreActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  moreAction: {
    width: 72,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    gap: 8,
  },
  moreActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  moreActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  likedPicker: {
    marginTop: 12,
  },
  likedPickerHint: {
    paddingVertical: 16,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  likedPickerScroll: {
    gap: 10,
    paddingRight: 4,
  },
  likedStyleCard: {
    width: 116,
    borderRadius: 16,
    padding: 8,
    gap: 7,
  },
  likedStyleImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
  },
  likedStyleTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  emojiPanel: {
    borderRadius: 20,
    padding: 12,
    gap: 12,
  },
  emojiCategoryRow: {
    gap: 8,
  },
  emojiCategoryChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emojiCategoryText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiCell: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 26,
  },
});
