import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import { SlideOverlayScreen } from "../components/SlideOverlayScreen";
import { TryOnHandChooser } from "../components/TryOnHandChooser";
import { useHandPhotoPicker } from "../hooks/useHandPhotoPicker";
import { useTryOnLauncher } from "../hooks/useTryOnLauncher";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAuthStore } from "../store/useAuthStore";
import { StyleDetail } from "../types/api";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

type ScreenRoute = RouteProp<RootStackParamList, "StylePreview">;
const defaultAvatar = require("../../assets/profile/default_avatar.png");
const emojiGroups = [
  {
    key: "recent",
    label: "常用",
    items: ["😍", "🥰", "😘", "😆", "🤣", "👏", "👍", "💅", "✨", "🔥", "🌸", "🎀"],
  },
  {
    key: "mood",
    label: "表情",
    items: ["😊", "😄", "🥹", "😚", "🤭", "😎", "😴", "😤", "😭", "😡", "🤯", "🙈"],
  },
  {
    key: "love",
    label: "氛围",
    items: ["💖", "💗", "💘", "💞", "💕", "💫", "🌷", "🌹", "🫶", "🎉", "🪩", "🍓"],
  },
] as const;

function formatCommentDate(value: string) {
  return value.slice(5, 16).replace("T", " ");
}

function formatSocialCount(value: number) {
  if (value >= 100000) return "10万+";
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function resolvePublishDate(createdAt: string, authorName: string) {
  if (authorName === "admin") {
    const createdAtDate = new Date(createdAt);
    const year = Number.isNaN(createdAtDate.getTime()) ? new Date().getFullYear() : createdAtDate.getFullYear();
    return new Date(year, 3, 22, 12, 21, 0);
  }
  return new Date(createdAt);
}

function formatPublishMeta(createdAt: string, authorName: string) {
  const publishDate = resolvePublishDate(createdAt, authorName);
  if (Number.isNaN(publishDate.getTime())) return "广东";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const publishStart = new Date(publishDate.getFullYear(), publishDate.getMonth(), publishDate.getDate()).getTime();
  const diffDays = Math.floor((todayStart - publishStart) / 86400000);
  const timePart = `${pad2(publishDate.getHours())}:${pad2(publishDate.getMinutes())}`;
  const monthDayPart = `${pad2(publishDate.getMonth() + 1)}-${pad2(publishDate.getDate())}`;

  if (diffDays <= 0) return `${timePart} 广东`;
  if (diffDays === 1) return `昨天${timePart} 广东`;
  return `${monthDayPart} 广东`;
}

function buildStyleTryOnPrompt(style: StyleDetail) {
  const tagText = style.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ");
  return [style.title, style.description, tagText, "请直接把这款美甲焕到我的手上"]
    .filter(Boolean)
    .join("，");
}

export function StylePreviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ScreenRoute>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authScope = !hydrated ? "booting" : token ? "authed" : "anon";
  const recordedViewStyleIdRef = useRef<string | null>(null);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const inputRef = useRef<TextInput>(null);
  const pageBackground = isDark ? colors.surfaceAlt : colors.surface;
  const lightCardBackground = isDark ? colors.surface : colors.surfaceAlt;
  const [commentText, setCommentText] = useState("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [pendingCommentImageUri, setPendingCommentImageUri] = useState<string | null>(null);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const [activeEmojiGroup, setActiveEmojiGroup] = useState<(typeof emojiGroups)[number]["key"]>("recent");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [tryOnChooserVisible, setTryOnChooserVisible] = useState(false);
  const [resumeTryOnAfterLogin, setResumeTryOnAfterLogin] = useState(false);

  const query = useQuery({
    queryKey: ["style", route.params.styleId, authScope],
    queryFn: () => api.getStyle(route.params.styleId),
    enabled: hydrated,
  });
  const commentsQuery = useQuery({
    queryKey: ["style-comments", route.params.styleId],
    queryFn: () => api.getStyleComments(route.params.styleId),
  });
  const tryOnPrompt = query.data ? buildStyleTryOnPrompt(query.data) : "请直接把这款美甲焕到我的手上";

  const tryOnLauncher = useTryOnLauncher({
    onSuccess: (job) => {
      setTryOnChooserVisible(false);
      navigation.navigate("TryOnResult", { jobId: job.job_id });
    },
    onError: () => {
      Alert.alert("焕甲没有成功开始", "你可以换一张手图，或者稍后再试一次。");
    },
  });

  const handPicker = useHandPhotoPicker({
    enabled: tryOnChooserVisible && !!token,
    onHandReady: (payload) => {
      tryOnLauncher.launchTryOn({
        styleId: route.params.styleId,
        promptText: tryOnPrompt,
        handImageUri: payload.imageUri,
        savedHandPhotoId: payload.handPhotoId ?? null,
      });
    },
  });

  useEffect(() => {
    if (!token) return;
    if (recordedViewStyleIdRef.current === route.params.styleId) return;
    recordedViewStyleIdRef.current = route.params.styleId;
    void api.recordBrowseHistory(route.params.styleId).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["browse-history"] });
    });
    void api.recordStyleView(route.params.styleId).catch(() => undefined);
  }, [queryClient, route.params.styleId, token]);

  useEffect(() => {
    if (!token || !resumeTryOnAfterLogin) return;
    setResumeTryOnAfterLogin(false);
    setTryOnChooserVisible(true);
  }, [resumeTryOnAfterLogin, token]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!query.data) return;
      if (query.data.is_liked) {
        await api.unlikeStyle(query.data.id);
      } else {
        await api.likeStyle(query.data.id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["style", route.params.styleId] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!query.data?.author_id) return;
      if (query.data.is_following_author) {
        await api.unfollowUser(query.data.author_id);
      } else {
        await api.followUser(query.data.author_id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["style", route.params.styleId] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: () => api.createStyleComment(route.params.styleId, commentText.trim()),
    onSuccess: () => {
      setCommentText("");
      setPendingCommentImageUri(null);
      setComposerExpanded(false);
      setEmojiPanelOpen(false);
      Keyboard.dismiss();
      void queryClient.invalidateQueries({ queryKey: ["style", route.params.styleId] });
      void queryClient.invalidateQueries({ queryKey: ["style-comments", route.params.styleId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.deleteStyleComment(route.params.styleId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["style", route.params.styleId] });
      void queryClient.invalidateQueries({ queryKey: ["style-comments", route.params.styleId] });
    },
  });

  const ensureAuthed = () => {
    if (token) return true;
    navigation.navigate("Login");
    return false;
  };

  const closeTryOnChooser = () => {
    if (tryOnLauncher.mutation.isPending) return;
    setTryOnChooserVisible(false);
  };

  const openTryOnFlow = () => {
    if (!token) {
      setResumeTryOnAfterLogin(true);
      navigation.navigate("Login");
      return;
    }
    setTryOnChooserVisible(true);
  };

  const openComposer = () => {
    if (!ensureAuthed()) return;
    setComposerExpanded(true);
    setEmojiPanelOpen(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const pickCommentImage = async () => {
    if (!ensureAuthed()) return;
    setComposerExpanded(true);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled) {
      setPendingCommentImageUri(result.assets[0].uri);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const insertMention = () => {
    if (!ensureAuthed()) return;
    setComposerExpanded(true);
    setCommentText((current) => `${current}${current ? " " : ""}@`);
    setEmojiPanelOpen(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const toggleEmojiPanel = () => {
    if (!ensureAuthed()) return;
    setComposerExpanded(true);
    setEmojiPanelOpen((current) => {
      const next = !current;
      if (next) {
        Keyboard.dismiss();
      } else {
        setTimeout(() => inputRef.current?.focus(), 80);
      }
      return next;
    });
  };

  const insertEmoji = (emoji: string) => {
    const start = selection.start ?? commentText.length;
    const end = selection.end ?? commentText.length;
    const nextText = `${commentText.slice(0, start)}${emoji}${commentText.slice(end)}`;
    const nextCursor = start + emoji.length;
    setCommentText(nextText);
    setSelection({ start: nextCursor, end: nextCursor });
  };

  const sendComment = () => {
    if (!ensureAuthed()) return;
    if (!commentText.trim()) return;
    createCommentMutation.mutate();
  };

  const renderContent = (dismiss: () => void) => {
    if (!query.data) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: pageBackground }]}>
          <View style={styles.loadingWrap}>
            <Text style={[styles.loadingText, { color: colors.subtext }]}>正在加载款式详情...</Text>
          </View>
        </SafeAreaView>
      );
    }

    const publishMeta = formatPublishMeta(query.data.created_at, query.data.author_name);

    return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBackground }]}>
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: pageBackground }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { backgroundColor: pageBackground }]}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: isDark ? "transparent" : lightCardBackground }]}
            onPress={dismiss}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.authorWrap}
            disabled={!query.data.author_id}
            onPress={() => {
              if (!query.data.author_id) return;
              navigation.navigate("AuthorProfile", { authorId: query.data.author_id });
            }}
          >
            <Image
              source={query.data.author_avatar_url ? { uri: resolveAssetUrl(query.data.author_avatar_url) } : defaultAvatar}
              style={[styles.authorAvatar, { backgroundColor: colors.input }]}
            />
            <View style={styles.authorText}>
              <Text style={[styles.authorName, { color: colors.text }]}>{query.data.author_name}</Text>
              <Text style={[styles.authorMeta, { color: colors.subtext }]}>{query.data.is_trending ? "热门推荐" : "焕甲社区"}</Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            {query.data.author_id && !query.data.is_authored_by_me ? (
              <Pressable
                style={[
                  styles.followButton,
                  { borderColor: colors.accent },
                  query.data.is_following_author && [styles.followButtonActive, { backgroundColor: colors.accent }],
                ]}
                onPress={() => {
                  if (!ensureAuthed()) return;
                  followMutation.mutate();
                }}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    { color: colors.accent },
                    query.data.is_following_author && styles.followButtonTextActive,
                  ]}
                >
                  {query.data.is_following_author ? "已关注" : "关注"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.headerButton, { backgroundColor: isDark ? "transparent" : lightCardBackground }]}
              onPress={() => Alert.alert("分享", "分享功能演示中，后续会接入系统分享。")}
            >
              <Ionicons name="share-social-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={{ backgroundColor: pageBackground }}
          contentContainerStyle={[
            styles.content,
            { backgroundColor: pageBackground, paddingBottom: composerExpanded ? (emojiPanelOpen ? 400 : 220) : 108 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={{ uri: resolveAssetUrl(query.data.image_url) }} style={[styles.image, { backgroundColor: colors.input }]} />

          <View style={styles.infoBlock}>
            <Text style={[styles.title, { color: colors.text }]}>{query.data.title}</Text>
            <Text style={[styles.desc, { color: colors.subtext }]}>{query.data.description}</Text>
            <Text style={[styles.publishMeta, { color: colors.subtext }]}>{publishMeta}</Text>
            {query.data.tags.length ? (
              <View style={styles.tagRow}>
                {query.data.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: isDark ? "#26262c" : lightCardBackground }]}>
                    <Text style={[styles.tagText, { color: colors.accent }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.commentHeader}>
            <Text style={[styles.commentHeaderTitle, { color: colors.text }]}>共 {query.data.comment_count} 条评论</Text>
          </View>

          <View style={styles.commentList}>
            {commentsQuery.data?.items.length ? (
              commentsQuery.data.items.map((item) => (
                <View key={item.id} style={styles.commentItem}>
                  <Image
                    source={item.author_avatar_url ? { uri: resolveAssetUrl(item.author_avatar_url) } : defaultAvatar}
                    style={[styles.commentAvatar, { backgroundColor: colors.input }]}
                  />
                  <View style={[styles.commentBody, { borderBottomColor: colors.border }]}>
                    <View style={styles.commentTop}>
                      <View style={styles.commentNameRow}>
                        <Text style={[styles.commentAuthor, { color: isDark ? "#cfcfd4" : colors.subtext }]}>{item.author_name}</Text>
                        {item.author_name === query.data.author_name ? (
                          <Text
                            style={[
                              styles.authorBadge,
                              { backgroundColor: isDark ? "rgba(255, 87, 87, 0.12)" : "#ffe8e3", color: "#ff7e7e" },
                            ]}
                          >
                            作者
                          </Text>
                        ) : null}
                        {item.is_mine ? (
                          <Text
                            style={[
                              styles.mineBadge,
                              { backgroundColor: isDark ? "rgba(240, 139, 109, 0.12)" : colors.accentSoft, color: colors.accent },
                            ]}
                          >
                            我
                          </Text>
                        ) : null}
                      </View>
                      {item.is_mine ? (
                        <Pressable
                          onPress={() =>
                            Alert.alert("删除评论", "确定删除这条评论吗？", [
                              { text: "取消", style: "cancel" },
                              {
                                text: "删除",
                                style: "destructive",
                                onPress: () => deleteCommentMutation.mutate(item.id),
                              },
                            ])
                          }
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.subtext} />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={[styles.commentContent, { color: colors.text }]}>{item.content}</Text>
                    <Text style={[styles.commentDate, { color: colors.subtext }]}>{formatCommentDate(item.created_at)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={[styles.emptyComments, { backgroundColor: lightCardBackground }]}>
                <Ionicons name="chatbubbles-outline" size={30} color={colors.subtext} />
                <Text style={[styles.emptyCommentsText, { color: colors.subtext }]}>还没有评论，来抢个沙发</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {composerExpanded ? (
          <View style={[styles.expandedComposer, { borderTopColor: colors.border, backgroundColor: pageBackground }]}>
            <View style={[styles.expandedInputShell, { backgroundColor: colors.input }]}>
              <TextInput
                ref={inputRef}
                style={[styles.expandedInput, { color: colors.text }]}
                value={commentText}
                onChangeText={setCommentText}
                onFocus={() => setEmojiPanelOpen(false)}
                onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
                placeholder="有话要说，快来评论"
                placeholderTextColor={colors.subtext}
                multiline
                textAlignVertical="top"
              />
              {pendingCommentImageUri ? (
                <View style={[styles.pendingImageCard, { backgroundColor: pageBackground }]}>
                  <Image source={{ uri: pendingCommentImageUri }} style={styles.pendingImagePreview} />
                  <View style={styles.pendingImageText}>
                    <Text style={[styles.pendingImageTitle, { color: colors.text }]}>已选择评论图片</Text>
                    <Text style={[styles.pendingImageHint, { color: colors.subtext }]}>图片评论正在接入，当前先发送文字内容</Text>
                  </View>
                  <Pressable onPress={() => setPendingCommentImageUri(null)}>
                    <Ionicons name="close-circle" size={22} color={colors.subtext} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.toolRow}>
              <View style={styles.toolActions}>
                <Pressable
                  style={styles.toolButton}
                  onPress={() => Alert.alert("语音输入", "语音评论功能演示中，后续接入真实语音转文字。")}
                >
                  <Ionicons name="mic-outline" size={26} color={colors.subtext} />
                </Pressable>
                <Pressable style={styles.toolButton} onPress={() => void pickCommentImage()}>
                  <Ionicons name="image-outline" size={26} color={colors.subtext} />
                </Pressable>
                <Pressable style={styles.toolButton} onPress={insertMention}>
                  <Ionicons name="at-outline" size={26} color={colors.subtext} />
                </Pressable>
                <Pressable
                  style={styles.toolButton}
                  onPress={toggleEmojiPanel}
                >
                  <Ionicons name={emojiPanelOpen ? "happy" : "happy-outline"} size={26} color={emojiPanelOpen ? colors.accent : colors.subtext} />
                </Pressable>
                <Pressable
                  style={styles.toolButton}
                  onPress={() => Alert.alert("更多能力", "更多评论能力后续接入。")}
                >
                  <Ionicons name="add-circle-outline" size={26} color={colors.subtext} />
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.sendPill,
                  { backgroundColor: colors.accent },
                  (!commentText.trim() || createCommentMutation.isPending) && styles.sendPillDisabled,
                ]}
                onPress={sendComment}
                disabled={!commentText.trim() || createCommentMutation.isPending}
              >
                <Text style={styles.sendPillText}>发送</Text>
              </Pressable>
            </View>

            {emojiPanelOpen ? (
              <View style={[styles.emojiPanel, { backgroundColor: colors.input }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiCategoryRow}>
                  {emojiGroups.map((group) => {
                    const active = activeEmojiGroup === group.key;
                    return (
                      <Pressable
                        key={group.key}
                        style={[
                          styles.emojiCategoryChip,
                          { backgroundColor: active ? colors.accent : pageBackground },
                        ]}
                        onPress={() => setActiveEmojiGroup(group.key)}
                      >
                        <Text style={[styles.emojiCategoryText, { color: active ? "#ffffff" : colors.subtext }]}>{group.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.emojiGrid}>
                  {emojiGroups
                    .find((group) => group.key === activeEmojiGroup)
                    ?.items.map((emoji) => (
                      <Pressable key={emoji} style={styles.emojiCell} onPress={() => insertEmoji(emoji)}>
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </Pressable>
                    ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.collapsedComposer, { borderTopColor: colors.border, backgroundColor: pageBackground }]}>
            <Pressable style={[styles.collapsedInput, { backgroundColor: colors.input }]} onPress={openComposer}>
              <Ionicons name="create-outline" size={18} color={colors.subtext} />
              <Text style={[styles.collapsedPlaceholder, { color: colors.subtext }]}>说点什么...</Text>
            </Pressable>

            <Pressable
              style={styles.socialAction}
              onPress={() => {
                if (!ensureAuthed()) return;
                likeMutation.mutate();
              }}
            >
              <Ionicons name={query.data.is_liked ? "heart" : "heart-outline"} size={24} color={query.data.is_liked ? colors.accent : colors.text} />
              <Text style={[styles.socialCount, { color: colors.text }]}>{formatSocialCount(query.data.like_count)}</Text>
            </Pressable>

            <Pressable style={styles.socialAction} onPress={openComposer}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.text} />
              <Text style={[styles.socialCount, { color: colors.text }]}>{formatSocialCount(query.data.comment_count)}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.tryOnButton,
                { backgroundColor: colors.accent },
                tryOnLauncher.mutation.isPending && styles.tryOnButtonDisabled,
              ]}
              onPress={openTryOnFlow}
              disabled={tryOnLauncher.mutation.isPending}
            >
              {tryOnLauncher.mutation.isPending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color="#ffffff" />
                  <Text style={styles.tryOnButtonText}>焕甲</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        <Modal visible={tryOnChooserVisible} transparent animationType="fade" onRequestClose={closeTryOnChooser}>
          <View style={[styles.tryOnModalBackdrop, { backgroundColor: colors.overlay }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeTryOnChooser} disabled={tryOnLauncher.mutation.isPending} />
            <View style={styles.tryOnModalSheet}>
              <View style={[styles.tryOnSheetHandle, { backgroundColor: colors.border }]} />
              <TryOnHandChooser
                title="选一张手图，马上开始焕甲"
                description={
                  handPicker.recentHandPhotos.length
                    ? "我先把你最近的 5 张手图摆出来，你可以直接挑一张把这款美甲试到手上。"
                    : "你还没有可用的手图，先拍一张，或者从相册里选一张以前拍过的。"
                }
                recentHandPhotos={handPicker.recentHandPhotos}
                loading={handPicker.savedHandsQuery.isPending}
                busy={tryOnLauncher.mutation.isPending}
                onSelectSavedHand={handPicker.handleSavedHandSelect}
                onTakePhoto={() => void handPicker.takePhotoNow()}
                onPickFromLibrary={() => void handPicker.pickFromLibrary()}
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
    );
  };

  return (
    <SlideOverlayScreen direction="right" backgroundColor={pageBackground} onDismiss={() => navigation.goBack()}>
      {(dismiss) => renderContent(dismiss)}
    </SlideOverlayScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authorWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 10,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorText: {
    gap: 3,
  },
  authorName: {
    fontSize: 20,
    fontWeight: "700",
  },
  authorMeta: {
    fontSize: 12,
  },
  followButton: {
    minWidth: 78,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  followButtonActive: {},
  followButtonText: {
    fontWeight: "700",
  },
  followButtonTextActive: {
    color: "#ffffff",
  },
  content: {
    paddingBottom: 108,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {},
  image: {
    width: "100%",
    aspectRatio: 0.92,
  },
  infoBlock: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
  },
  desc: {
    lineHeight: 22,
  },
  publishMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tagText: {
    fontWeight: "700",
  },
  commentHeader: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 10,
  },
  commentHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  commentList: {
    paddingHorizontal: 18,
    gap: 18,
  },
  commentItem: {
    flexDirection: "row",
    gap: 12,
  },
  commentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  commentBody: {
    flex: 1,
    gap: 8,
    paddingBottom: 18,
    borderBottomWidth: 1,
  },
  commentTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  commentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  commentAuthor: {
    fontSize: 15,
    fontWeight: "700",
  },
  authorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontWeight: "700",
    fontSize: 12,
    overflow: "hidden",
  },
  mineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontWeight: "700",
    fontSize: 12,
    overflow: "hidden",
  },
  commentContent: {
    fontSize: 19,
    lineHeight: 28,
  },
  commentDate: {
    fontSize: 12,
  },
  emptyComments: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 32,
    borderRadius: 20,
  },
  emptyCommentsText: {
    fontSize: 14,
  },
  collapsedComposer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  collapsedInput: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  collapsedPlaceholder: {
    fontSize: 15,
  },
  socialAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  socialCount: {
    fontSize: 16,
    fontWeight: "600",
  },
  tryOnButton: {
    minWidth: 82,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tryOnButtonDisabled: {
    opacity: 0.72,
  },
  tryOnButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  expandedComposer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
    borderTopWidth: 1,
  },
  expandedInputShell: {
    minHeight: 120,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  expandedInput: {
    minHeight: 76,
    fontSize: 17,
    lineHeight: 26,
  },
  pendingImageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 10,
  },
  pendingImagePreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  pendingImageText: {
    flex: 1,
    gap: 4,
  },
  pendingImageTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  pendingImageHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toolActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  toolButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sendPill: {
    minWidth: 86,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sendPillDisabled: {
    opacity: 0.45,
  },
  sendPillText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  emojiPanel: {
    borderRadius: 22,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 12,
    gap: 14,
  },
  emojiCategoryRow: {
    gap: 10,
    paddingRight: 8,
  },
  emojiCategoryChip: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiCategoryText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emojiCell: {
    width: "16.66%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  emojiText: {
    fontSize: 28,
  },
  tryOnModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  tryOnModalSheet: {
    gap: 12,
  },
  tryOnSheetHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
  },
});
