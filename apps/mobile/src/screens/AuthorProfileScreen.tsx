import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Dimensions,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuthStore } from "../store/useAuthStore";
import { AuthorPost, MyStyleCommentItem, NailStyle } from "../types/api";
import { formatRelativeRegionTime } from "../utils/postTime";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");
const FEED_HEART_ACTIVE_COLOR = "#ff7a8a";
const FEED_HEART_INACTIVE_COLOR = "#d0d0d5";

const REGION_NAME_MAP: Record<string, string> = {
  Guangdong: "广东",
  "Guangdong Province": "广东",
  Beijing: "北京",
  Shanghai: "上海",
  Tianjin: "天津",
  Chongqing: "重庆",
  Zhejiang: "浙江",
  Jiangsu: "江苏",
  Fujian: "福建",
  Shandong: "山东",
  Henan: "河南",
  Hebei: "河北",
  Hunan: "湖南",
  Hubei: "湖北",
  Sichuan: "四川",
  Yunnan: "云南",
  Guizhou: "贵州",
  Jiangxi: "江西",
  Anhui: "安徽",
  Shanxi: "山西",
  Shaanxi: "陕西",
  Liaoning: "辽宁",
  Jilin: "吉林",
  Heilongjiang: "黑龙江",
  Hainan: "海南",
  Gansu: "甘肃",
  Qinghai: "青海",
  Taiwan: "台湾",
  Xinjiang: "新疆",
  Tibet: "西藏",
  "Inner Mongolia": "内蒙古",
  Ningxia: "宁夏",
  Guangxi: "广西",
  "Hong Kong": "香港",
  Macau: "澳门",
};

function normalizeLocationLabel(value?: string | null) {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const mapped = REGION_NAME_MAP[raw] ?? raw;
  return mapped.replace(/特别行政区$/, "").replace(/自治区$/, "").replace(/维吾尔$/, "").replace(/省$/, "").replace(/市$/, "");
}

function resolveProfileLocationLabel(address?: Location.LocationGeocodedAddress | null) {
  return (
    normalizeLocationLabel(address?.region) ??
    normalizeLocationLabel(address?.city) ??
    normalizeLocationLabel(address?.subregion) ??
    normalizeLocationLabel(address?.district) ??
    normalizeLocationLabel(address?.country)
  );
}

const selfShortcutActions = [
  { key: "browse-history", icon: "time-outline", title: "浏览记录", subtitle: "看过的美甲" },
  { key: "hand-photos", icon: "hand-left-outline", title: "手图管理", subtitle: "管理已上传手图" },
  { key: "tryon-history", icon: "sparkles-outline", title: "AI焕甲", subtitle: "查看试戴记录" },
] as const;

const drawerGroups = [
  [
    { key: "browse-history", icon: "time-outline", label: "浏览记录" },
    { key: "hand-photos", icon: "hand-left-outline", label: "手图管理" },
    { key: "tryon-history", icon: "sparkles-outline", label: "AI焕甲" },
  ],
  [{ key: "support", icon: "headset-outline", label: "帮助与客服" }],
] as const;

type SelfShortcutKey = (typeof selfShortcutActions)[number]["key"];
type DrawerActionKey = SelfShortcutKey | "settings" | "support";
type ProfileContentTab = "posts" | "comments" | "liked";

type AuthorProfileScreenProps = {
  authorId?: string;
  asProfileTab?: boolean;
};

function StatBlock({
  value,
  label,
  color,
  subtextColor,
  onPress,
}: {
  value: string | number;
  label: string;
  color: string;
  subtextColor: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: subtextColor }]}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable style={styles.statBlock} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return (
    <View style={styles.statBlock}>
      {content}
    </View>
  );
}

export function AuthorProfileScreen({ authorId, asProfileTab = false }: AuthorProfileScreenProps) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const drawerWidth = Math.min(Dimensions.get("window").width * 0.82, 360);
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const currentUser = useAuthStore((state) => state.user);
  const setCurrentUser = useAuthStore((state) => state.setUser);
  const authScope = !hydrated ? "booting" : token ? "authed" : "anon";
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [locationSyncAttempted, setLocationSyncAttempted] = useState(false);
  const [editingPost, setEditingPost] = useState<AuthorPost | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [isBioOverflowing, setIsBioOverflowing] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState<ProfileContentTab>("posts");
  const refreshSpin = useRef(new Animated.Value(0)).current;
  const drawerProgress = useRef(new Animated.Value(0)).current;

  const resolvedAuthorId = authorId ?? route.params?.authorId;

  const query = useQuery({
    queryKey: ["author-profile", resolvedAuthorId, authScope],
    queryFn: () => api.getAuthorProfile(resolvedAuthorId),
    enabled: hydrated && Boolean(resolvedAuthorId),
  });

  const canQueryComments = Boolean(query.data && (query.data.is_mine || query.data.can_view_comments));
  const canQueryLikedStyles = Boolean(query.data && (query.data.is_mine || query.data.can_view_likes));
  const commentsQuery = useQuery({
    queryKey: ["user-style-comments", resolvedAuthorId, authScope],
    queryFn: () => api.getUserStyleComments(resolvedAuthorId),
    enabled: hydrated && Boolean(resolvedAuthorId) && canQueryComments,
  });
  const likedStylesQuery = useQuery({
    queryKey: ["user-liked-styles", resolvedAuthorId, authScope],
    queryFn: () => api.getUserLikedStyles(resolvedAuthorId),
    enabled: hydrated && Boolean(resolvedAuthorId) && canQueryLikedStyles,
  });

  useEffect(() => {
    if (activeContentTab === "comments" && !canQueryComments) {
      setActiveContentTab("posts");
    }
    if (activeContentTab === "liked" && !canQueryLikedStyles) {
      setActiveContentTab("posts");
    }
  }, [activeContentTab, canQueryComments, canQueryLikedStyles]);

  useEffect(() => {
    if (!isPullRefreshing) {
      refreshSpin.stopAnimation();
      refreshSpin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(refreshSpin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isPullRefreshing, refreshSpin]);

  useEffect(() => {
    setIsBioExpanded(false);
    setIsBioOverflowing(false);
  }, [resolvedAuthorId, query.data?.bio]);

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!query.data) return;
      if (query.data.is_following) {
        await api.unfollowUser(query.data.id);
      } else {
        await api.followUser(query.data.id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["author-profile", resolvedAuthorId] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ postId, payload }: { postId: string; payload: { title?: string; description?: string; tags?: string[]; is_hidden?: boolean } }) =>
      api.updateMyPost(postId, payload),
    onSuccess: () => {
      setEditingPost(null);
      void queryClient.invalidateQueries({ queryKey: ["author-profile", resolvedAuthorId] });
      void queryClient.invalidateQueries({ queryKey: ["my-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.deleteMyPost(postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["author-profile", resolvedAuthorId] });
      void queryClient.invalidateQueries({ queryKey: ["my-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
    },
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async ({ styleId, isLiked }: { styleId: string; isLiked: boolean }) => {
      if (isLiked) {
        await api.unlikeStyle(styleId);
      } else {
        await api.likeStyle(styleId);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["user-liked-styles"] });
      void queryClient.invalidateQueries({ queryKey: ["author-profile", resolvedAuthorId] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

  const locationMutation = useMutation({
    mutationFn: (city: string) => api.updateMyLocation(city),
    onSuccess: (user) => {
      setCurrentUser(user);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["author-profile", resolvedAuthorId] });
    },
  });

  useEffect(() => {
    if (!hydrated || !token || !asProfileTab || !query.data?.is_mine || locationSyncAttempted) return;
    setLocationSyncAttempted(true);
    let cancelled = false;

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted" || cancelled) return;
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (cancelled) return;
        const nextCity = resolveProfileLocationLabel(geocoded[0]);
        if (nextCity && nextCity !== query.data?.city) {
          locationMutation.mutate(nextCity);
        }
      } catch {
        // 定位失败时保留上一次属地，不阻塞个人主页展示。
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asProfileTab, hydrated, locationMutation, locationSyncAttempted, query.data?.city, query.data?.is_mine, token]);

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!query.data) return;
      if (query.data.viewer_has_blocked_author) {
        await api.unblockUser(query.data.id);
      } else {
        await api.blockUser(query.data.id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["author-profile", resolvedAuthorId] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", resolvedAuthorId] });
    },
  });

  const openEdit = (post: AuthorPost) => {
    setEditingPost(post);
    setEditingTitle(post.title);
    setEditingDescription(post.description);
    setEditingTags(post.tags.join(", "));
  };

  const saveEdit = () => {
    if (!editingPost) return;
    const title = editingTitle.trim();
    if (!title) {
      Alert.alert("标题不能为空", "请先输入标题再保存。");
      return;
    }
    const tags = editingTags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!editingPost.manage_post_id) {
      Alert.alert("暂不支持", "这条作品暂不支持直接编辑。");
      return;
    }
    updateMutation.mutate({
      postId: editingPost.manage_post_id,
      payload: {
        title,
        description: editingDescription,
        tags,
      },
    });
  };

  const handleSelfShortcutPress = (key: SelfShortcutKey) => {
    if (key === "browse-history") {
      navigation.navigate("BrowseHistory");
      return;
    }
    if (key === "hand-photos") {
      navigation.navigate("HandPhotoManagement");
      return;
    }
    if (key === "tryon-history") {
      navigation.navigate("TryOnHistory");
      return;
    }
  };

  const handleDrawerActionPress = (key: DrawerActionKey) => {
    closeDrawer();
    if (key === "settings") {
      navigation.navigate("ProfileSettings");
      return;
    }
    if (key === "support") {
      Alert.alert("帮助与客服", "在线客服功能演示中，后续会接入真实客服。");
      return;
    }
    handleSelfShortcutPress(key);
  };

  const handleRefresh = async () => {
    if (!(asProfileTab && query.data?.is_mine)) return;
    setIsPullRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  };

  const openDrawer = () => {
    setDrawerMounted(true);
    drawerProgress.setValue(0);
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    if (!drawerMounted) return;
    Animated.timing(drawerProgress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setDrawerMounted(false);
      }
    });
  };

  if (!query.data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingText, { color: colors.subtext }]}>正在加载作者主页...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const author = query.data;
  const dmDisabled = author.has_blocked_viewer || author.viewer_has_blocked_author;
  const shouldCompactSelfProfile = Boolean(asProfileTab && author.is_mine);
  const bioText = author.bio?.trim() ?? "";
  const canShowComments = author.is_mine || author.can_view_comments;
  const canShowLikes = author.is_mine || author.can_view_likes;
  const commentsLockedForOthers = Boolean(author.is_mine && currentUser?.show_comments_public === false);
  const likesLockedForOthers = Boolean(author.is_mine && currentUser?.show_likes_public === false);
  const profileTabs = [
    { key: "posts" as const, label: "作品", count: author.posts.length },
    ...(canShowComments
      ? [{ key: "comments" as const, label: "评论", count: commentsQuery.data?.items.length ?? 0, locked: commentsLockedForOthers }]
      : []),
    ...(canShowLikes
      ? [{ key: "liked" as const, label: "赞过", count: likedStylesQuery.data?.items.length ?? 0, locked: likesLockedForOthers }]
      : []),
  ];
  const listData: Array<AuthorPost | MyStyleCommentItem | NailStyle> =
    activeContentTab === "comments"
      ? commentsQuery.data?.items ?? []
      : activeContentTab === "liked"
        ? likedStylesQuery.data?.items ?? []
        : author.posts;
  const listIsTwoColumns = activeContentTab !== "comments";
  const emptyText =
    activeContentTab === "comments"
      ? author.is_mine
        ? "你还没有发表过评论"
        : "这个作者还没有公开评论"
      : activeContentTab === "liked"
        ? author.is_mine
          ? "你还没有赞过作品"
          : "这个作者还没有公开赞过的作品"
        : "这个作者还没有发布作品";

  const openFollowList = (kind: "following" | "followers") => {
    const canView = kind === "following" ? author.can_view_following : author.can_view_followers;
    if (!canView && !author.is_mine) {
      Alert.alert("暂不可见", kind === "following" ? "该用户已设置关注列表不可见" : "该用户已设置粉丝列表不可见");
      return;
    }
    navigation.navigate("FollowList", {
      authorId: author.id,
      kind,
      title: kind === "following" ? "关注" : "粉丝",
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        key={`author-content-${activeContentTab}-${listIsTwoColumns ? "grid" : "list"}`}
        data={listData}
        keyExtractor={(item) => ("comment_id" in item ? item.comment_id : item.id)}
        numColumns={listIsTwoColumns ? 2 : 1}
        columnWrapperStyle={listIsTwoColumns ? styles.columnWrap : undefined}
        refreshControl={
          asProfileTab && author.is_mine ? (
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handleRefresh}
              tintColor="transparent"
              colors={["transparent"]}
              progressBackgroundColor="transparent"
            />
          ) : undefined
        }
        contentContainerStyle={[styles.list, shouldCompactSelfProfile && styles.compactList]}
        ListHeaderComponent={
          <View style={[styles.headerCard, shouldCompactSelfProfile && styles.compactHeaderCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.headerBackdrop, { backgroundColor: colors.accentSoft }]} />
            <View style={[styles.topBar, shouldCompactSelfProfile && styles.compactTopBar]}>
              {asProfileTab && author.is_mine ? (
                <>
                  <Pressable style={[styles.topButton, shouldCompactSelfProfile && styles.compactTopButton]} onPress={openDrawer}>
                    <Ionicons name="menu-outline" size={28} color={colors.text} />
                  </Pressable>
                  <View style={styles.topRightActions}>
                    <Pressable
                      style={[styles.topButton, shouldCompactSelfProfile && styles.compactTopButton, { backgroundColor: colors.surfaceAlt }]}
                      onPress={() => Alert.alert("分享主页", "分享主页功能后续补充。")}
                    >
                      <Ionicons name="arrow-redo-outline" size={22} color={colors.text} />
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Pressable style={[styles.topButton, shouldCompactSelfProfile && styles.compactTopButton]} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={28} color={colors.text} />
                  </Pressable>
                  <Pressable
                    style={[styles.topButton, shouldCompactSelfProfile && styles.compactTopButton]}
                    onPress={() => {
                      if (author.is_mine) {
                        Alert.alert("更多", "更多功能后续补充。");
                        return;
                      }
                      if (!currentUser) {
                        navigation.navigate("Login");
                        return;
                      }
                      Alert.alert("更多操作", "可以在这里管理与作者的关系。", [
                        { text: "取消", style: "cancel" },
                        {
                          text: author.viewer_has_blocked_author ? "解除拉黑" : "拉黑",
                          style: "destructive",
                          onPress: () => blockMutation.mutate(),
                        },
                      ]);
                    }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
                  </Pressable>
                </>
              )}
            </View>

            <View style={[styles.heroRow, shouldCompactSelfProfile && styles.compactHeroRow]}>
              <Image
                source={author.avatar_url ? { uri: resolveAssetUrl(author.avatar_url) } : defaultAvatar}
                style={[styles.avatar, shouldCompactSelfProfile && styles.compactAvatar, { backgroundColor: colors.surfaceAlt }]}
              />
              <View style={[styles.heroText, shouldCompactSelfProfile && styles.compactHeroText]}>
                <Text style={[styles.authorName, shouldCompactSelfProfile && styles.compactAuthorName, { color: colors.text }]}>{author.username}</Text>
                <Text style={[styles.authorMeta, shouldCompactSelfProfile && styles.compactAuthorMeta, { color: colors.subtext }]}>
                  焕甲号：{author.uid}
                </Text>
                <Text style={[styles.authorMeta, shouldCompactSelfProfile && styles.compactAuthorMeta, { color: colors.subtext }]}>
                  IP：{author.city}
                </Text>
              </View>
            </View>

            {author.is_mine ? (
              <View style={[styles.selfSummaryRow, shouldCompactSelfProfile && styles.compactSelfSummaryRow]}>
                <View style={[styles.compactStatsRow, shouldCompactSelfProfile && styles.tightCompactStatsRow]}>
                  {[
                    { key: "following", value: author.following_count, label: "关注", onPress: () => openFollowList("following") },
                    { key: "follower", value: author.follower_count, label: "粉丝", onPress: () => openFollowList("followers") },
                    { key: "liked", value: author.total_like_count, label: "获赞", onPress: undefined },
                  ].map((item) => (
                    <Pressable
                      key={item.key}
                      style={[styles.compactStatItem, shouldCompactSelfProfile && styles.tightCompactStatItem]}
                      onPress={item.onPress}
                      disabled={!item.onPress}
                    >
                      <Text
                        style={[styles.compactStatText, shouldCompactSelfProfile && styles.tightCompactStatText, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        <Text style={[styles.compactStatValue, shouldCompactSelfProfile && styles.tightCompactStatValue]}>{item.value}</Text>
                        <Text style={[styles.compactStatLabel, shouldCompactSelfProfile && styles.tightCompactStatLabel, { color: colors.subtext }]}>
                          {" "}
                          {item.label}
                        </Text>
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={[styles.selfActionRow, shouldCompactSelfProfile && styles.tightSelfActionRow]}>
                  <Pressable
                    style={[styles.compactEditButton, shouldCompactSelfProfile && styles.tightCompactEditButton, { backgroundColor: colors.accent }]}
                    onPress={() => navigation.navigate("ProfileEdit")}
                  >
                    <Text style={[styles.compactEditButtonText, shouldCompactSelfProfile && styles.tightCompactEditButtonText]}>编辑资料</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.settingsIconButton, shouldCompactSelfProfile && styles.tightSettingsIconButton, { backgroundColor: colors.accentSoft }]}
                    onPress={() => navigation.navigate("ProfileSettings")}
                  >
                    <Ionicons name="settings-outline" size={shouldCompactSelfProfile ? 18 : 20} color={colors.accent} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.statsRow}>
                <StatBlock value={author.following_count} label="关注" color={colors.text} subtextColor={colors.subtext} onPress={() => openFollowList("following")} />
                <StatBlock value={author.follower_count} label="粉丝" color={colors.text} subtextColor={colors.subtext} onPress={() => openFollowList("followers")} />
                <StatBlock value={author.total_like_count} label="获赞" color={colors.text} subtextColor={colors.subtext} />
              </View>
            )}

            {bioText ? (
              <View style={[styles.bioWrap, shouldCompactSelfProfile && styles.compactBioWrap]}>
                <Text
                  style={[styles.bio, shouldCompactSelfProfile && styles.compactBio, { color: colors.text }]}
                  numberOfLines={shouldCompactSelfProfile && !isBioExpanded ? 3 : undefined}
                  onTextLayout={(event) => {
                    if (!shouldCompactSelfProfile || isBioExpanded) return;
                    const nextOverflowing = event.nativeEvent.lines.length > 3;
                    if (nextOverflowing !== isBioOverflowing) {
                      setIsBioOverflowing(nextOverflowing);
                    }
                  }}
                >
                  {bioText}
                </Text>
                {shouldCompactSelfProfile && isBioOverflowing ? (
                  <Pressable style={styles.bioToggle} onPress={() => setIsBioExpanded((value) => !value)}>
                    <Text style={[styles.bioToggleText, { color: colors.subtext }]}>{isBioExpanded ? "收起" : "展开"}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {author.has_blocked_viewer ? (
              <View style={[styles.noticeBanner, { backgroundColor: colors.dangerSoft }]}>
                <Text style={[styles.noticeBannerText, { color: colors.dangerText }]}>对方已将您拉黑</Text>
              </View>
            ) : null}

            {author.viewer_has_blocked_author ? (
              <View style={[styles.noticeBanner, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.noticeBannerText, { color: colors.subtext }]}>你已拉黑对方，解除后才能继续私信</Text>
              </View>
            ) : null}

            {!author.is_mine ? (
              <View style={styles.profileActions}>
                <>
                  <PrimaryButton
                    label={author.is_following ? "已关注" : "关注"}
                    onPress={() => {
                      if (!currentUser) {
                        navigation.navigate("Login");
                        return;
                      }
                      if (author.has_blocked_viewer || author.viewer_has_blocked_author) return;
                      followMutation.mutate();
                    }}
                    loading={followMutation.isPending}
                    disabled={author.has_blocked_viewer || author.viewer_has_blocked_author}
                    style={{ flex: 1 }}
                  />
                  <PrimaryButton
                    label={author.has_blocked_viewer ? "无法私信" : author.viewer_has_blocked_author ? "已拉黑" : "发私信"}
                    onPress={() => {
                      if (!currentUser) {
                        navigation.navigate("Login");
                        return;
                      }
                      if (dmDisabled) return;
                      navigation.navigate("DirectMessage", { userId: author.id });
                    }}
                    variant="ghost"
                    disabled={dmDisabled}
                    style={{ flex: 1 }}
                  />
                </>
              </View>
            ) : null}

            {author.is_mine ? (
              <View style={[styles.shortcutsWrap, shouldCompactSelfProfile && styles.compactShortcutsWrap]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsRow}>
                  {selfShortcutActions.map((item) => (
                    <Pressable
                      key={item.key}
                      style={[styles.shortcutCard, shouldCompactSelfProfile && styles.compactShortcutCard, { backgroundColor: colors.surfaceAlt }]}
                      onPress={() => handleSelfShortcutPress(item.key)}
                    >
                      <View style={styles.shortcutHeader}>
                        <Ionicons name={item.icon} size={shouldCompactSelfProfile ? 16 : 20} color={colors.text} />
                        <Text style={[styles.shortcutTitle, shouldCompactSelfProfile && styles.compactShortcutTitle, { color: colors.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                      </View>
                      <Text
                        style={[styles.shortcutSubtitle, shouldCompactSelfProfile && styles.compactShortcutSubtitle, { color: colors.subtext }]}
                        numberOfLines={1}
                      >
                        {item.subtitle}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {profileTabs.length > 1 ? (
              <View style={[styles.profileTabBar, { borderColor: colors.border }]}>
                {profileTabs.map((item) => {
                  const active = activeContentTab === item.key;
                  return (
                    <Pressable key={item.key} style={styles.profileTabButton} onPress={() => setActiveContentTab(item.key)}>
                      <View style={styles.profileTabLabelRow}>
                        {item.locked ? <Ionicons name="lock-closed-outline" size={13} color={active ? colors.text : colors.subtext} /> : null}
                        <Text style={[styles.profileTabText, { color: active ? colors.text : colors.subtext }]}>
                          {item.label}
                          <Text style={[styles.profileTabCount, { color: active ? colors.text : colors.subtext }]}> {item.count}</Text>
                        </Text>
                      </View>
                      {active ? <View style={[styles.profileTabUnderline, { backgroundColor: colors.accent }]} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.sectionHeader, shouldCompactSelfProfile && styles.compactSectionHeader]}>
                <Text style={[styles.sectionTitle, shouldCompactSelfProfile && styles.compactSectionTitle, { color: colors.text }]}>作品</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>{emptyText}</Text>}
        renderItem={({ item }) => {
          if ("comment_id" in item) {
            return (
              <Pressable
                style={[styles.commentRow, { backgroundColor: colors.background }]}
                onPress={() => navigation.navigate("StylePreview", { styleId: item.style_id })}
              >
                <Image
                  source={author.avatar_url ? { uri: resolveAssetUrl(author.avatar_url) } : defaultAvatar}
                  style={[styles.commentAvatar, { backgroundColor: colors.surfaceAlt }]}
                />
                <View style={styles.commentBody}>
                  <Text style={[styles.commentAuthor, { color: colors.subtext }]}>{author.username}</Text>
                  <Text style={[styles.commentContent, { color: colors.text }]} numberOfLines={3}>
                    {item.comment_content}
                  </Text>
                  <Text style={[styles.commentSource, { color: colors.subtext }]} numberOfLines={1}>
                    来自作品 · {item.style_title}
                  </Text>
                  <Text style={[styles.commentTime, { color: colors.subtext }]}>
                    {formatRelativeRegionTime(item.comment_created_at, "广东")} · 公开
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
              </Pressable>
            );
          }

          if ("author_name" in item) {
            return (
              <Pressable
                style={[styles.postCard, { backgroundColor: colors.surface }]}
                onPress={() => navigation.navigate("StylePreview", { styleId: item.id })}
              >
                <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.postImage, { backgroundColor: colors.surfaceAlt }]} />
                <View style={styles.postBody}>
                  <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.likedMetaRow}>
                    <Image
                      source={item.author_avatar_url ? { uri: resolveAssetUrl(item.author_avatar_url) } : defaultAvatar}
                      style={styles.likedAuthorAvatar}
                    />
                    <Text style={[styles.likedAuthor, { color: colors.subtext }]} numberOfLines={1}>
                      {item.author_name}
                    </Text>
                    <Pressable
                      style={styles.likedHeart}
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        if (!currentUser) {
                          navigation.navigate("Login");
                          return;
                        }
                        toggleLikeMutation.mutate({ styleId: item.id, isLiked: item.is_liked });
                      }}
                    >
                      <Ionicons
                        name={item.is_liked ? "heart" : "heart-outline"}
                        size={18}
                        color={item.is_liked ? FEED_HEART_ACTIVE_COLOR : FEED_HEART_INACTIVE_COLOR}
                      />
                      <Text style={[styles.likedCount, { color: colors.subtext }]}>{item.like_count}</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }

          const managePostId = item.manage_post_id ?? null;
          return (
            <Pressable
              style={[styles.postCard, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate("StylePreview", { styleId: item.id })}
            >
              <View>
                <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.postImage, { backgroundColor: colors.surfaceAlt }]} />
                {author.is_mine ? (
                  <View style={[styles.postViewBadge, { backgroundColor: colors.overlay }]}>
                    <Ionicons name="eye-outline" size={15} color="#ffffff" />
                    <Text style={styles.postViewBadgeText}>{item.unique_viewer_count}</Text>
                  </View>
                ) : null}
                {item.is_hidden ? (
                  <View style={[styles.hiddenBadge, { backgroundColor: colors.overlay }]}>
                    <Text style={styles.hiddenBadgeText}>已隐藏</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.postBody}>
                <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.likedMetaRow}>
                  <Image
                    source={author.avatar_url ? { uri: resolveAssetUrl(author.avatar_url) } : defaultAvatar}
                    style={styles.likedAuthorAvatar}
                  />
                  <Text style={[styles.likedAuthor, { color: colors.subtext }]} numberOfLines={1}>
                    {author.username}
                  </Text>
                  <Pressable
                    style={styles.likedHeart}
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      if (!currentUser) {
                        navigation.navigate("Login");
                        return;
                      }
                      toggleLikeMutation.mutate({ styleId: item.id, isLiked: item.is_liked });
                    }}
                  >
                    <Ionicons
                      name={item.is_liked ? "heart" : "heart-outline"}
                      size={18}
                      color={item.is_liked ? FEED_HEART_ACTIVE_COLOR : FEED_HEART_INACTIVE_COLOR}
                    />
                    <Text style={[styles.likedCount, { color: colors.subtext }]}>{item.like_count}</Text>
                  </Pressable>
                </View>
                {author.is_mine && managePostId ? (
                  <View style={styles.postActions}>
                    <Pressable
                      style={[styles.postActionButton, { backgroundColor: colors.surfaceAlt }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        openEdit(item);
                      }}
                    >
                      <Text style={[styles.postActionText, { color: colors.text }]}>编辑</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.postActionButton, { backgroundColor: colors.surfaceAlt }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        updateMutation.mutate({
                          postId: managePostId,
                          payload: { is_hidden: !item.is_hidden },
                        });
                      }}
                    >
                      <Text style={[styles.postActionText, { color: colors.text }]}>{item.is_hidden ? "显示" : "隐藏"}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.postActionButton, { backgroundColor: colors.dangerSoft }]}
                      onPress={(event) => {
                        event.stopPropagation();
                        Alert.alert("删除作品", "删除后将永久无法找回，确认删除吗？", [
                          { text: "取消", style: "cancel" },
                          { text: "删除", style: "destructive", onPress: () => deleteMutation.mutate(managePostId) },
                        ]);
                      }}
                    >
                      <Text style={[styles.postActionText, { color: colors.dangerText }]}>删除</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {asProfileTab && author.is_mine && isPullRefreshing ? (
        <View style={styles.profileRefreshIndicatorWrap} pointerEvents="none">
          <View style={[styles.profileRefreshIndicator, { backgroundColor: colors.navBackground }]}>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: refreshSpin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name="refresh-outline" size={34} color={colors.accent} />
            </Animated.View>
          </View>
        </View>
      ) : null}

      <Modal visible={!!editingPost} transparent animationType="fade" onRequestClose={() => setEditingPost(null)}>
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { backgroundColor: "rgba(9, 11, 16, 0.45)" }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>编辑作品</Text>
            <TextInput
              value={editingTitle}
              onChangeText={setEditingTitle}
              placeholder="标题"
              placeholderTextColor={colors.subtext}
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={editingDescription}
              onChangeText={setEditingDescription}
              placeholder="描述"
              placeholderTextColor={colors.subtext}
              multiline
              style={[
                styles.input,
                styles.textarea,
                { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border },
              ]}
            />
            <TextInput
              value={editingTags}
              onChangeText={setEditingTags}
              placeholder="标签，逗号分隔"
              placeholderTextColor={colors.subtext}
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
            />
            <View style={styles.modalActions}>
              <PrimaryButton label="取消" onPress={() => setEditingPost(null)} variant="ghost" style={{ flex: 1 }} />
              <PrimaryButton label="保存" onPress={saveEdit} loading={updateMutation.isPending} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {asProfileTab && author.is_mine ? (
        <Modal visible={drawerMounted} transparent animationType="none" onRequestClose={closeDrawer}>
          <View style={styles.drawerRoot}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.drawerOverlay,
                {
                  opacity: drawerProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ]}
            />
            <Pressable style={styles.drawerOverlayPressable} onPress={closeDrawer} />
            <Animated.View
              style={[
                styles.drawerPanel,
                {
                  width: drawerWidth,
                  backgroundColor: colors.navBackground,
                  transform: [
                    {
                      translateX: drawerProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-drawerWidth, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <SafeAreaView style={styles.drawerSafe}>
                <ScrollView contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
                  {drawerGroups.map((group, index) => (
                    <View key={`group-${index}`} style={[styles.drawerGroup, { backgroundColor: colors.surface }]}>
                      {group.map((item) => (
                        <Pressable
                          key={item.key}
                          style={styles.drawerItem}
                          onPress={() => handleDrawerActionPress(item.key as DrawerActionKey)}
                        >
                          <Ionicons name={item.icon} size={24} color={colors.text} style={styles.drawerItemIcon} />
                          <Text style={[styles.drawerItemText, { color: colors.text }]}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.drawerBottomRow}>
                  <Pressable
                    style={[styles.drawerBottomButton, { backgroundColor: colors.surface }]}
                    onPress={() => Alert.alert("扫一扫", "扫一扫功能后续补充。")}
                  >
                    <Ionicons name="scan-outline" size={24} color={colors.text} />
                    <Text style={[styles.drawerBottomLabel, { color: colors.text }]}>扫一扫</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.drawerBottomButton, { backgroundColor: colors.surface }]}
                    onPress={() => handleDrawerActionPress("support")}
                  >
                    <Ionicons name="headset-outline" size={24} color={colors.text} />
                    <Text style={[styles.drawerBottomLabel, { color: colors.text }]}>帮助与客服</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.drawerBottomButton, { backgroundColor: colors.surface }]}
                    onPress={() => handleDrawerActionPress("settings")}
                  >
                    <Ionicons name="settings-outline" size={24} color={colors.text} />
                    <Text style={[styles.drawerBottomLabel, { color: colors.text }]}>设置</Text>
                  </Pressable>
                </View>
              </SafeAreaView>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 15 },
  list: { paddingBottom: 120, paddingHorizontal: 14, gap: 14 },
  compactList: { paddingHorizontal: 10, gap: 10 },
  headerCard: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 18,
    marginBottom: 12,
  },
  compactHeaderCard: {
    borderRadius: 24,
    padding: 14,
    marginBottom: 8,
  },
  headerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  compactTopBar: {
    marginBottom: 12,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  compactHeroRow: {
    gap: 12,
    alignItems: "flex-start",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  compactAvatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  compactHeroText: {
    gap: 3,
    paddingTop: 2,
  },
  authorName: {
    fontSize: 34,
    fontWeight: "800",
  },
  compactAuthorName: {
    fontSize: 28,
    lineHeight: 32,
  },
  authorMeta: {
    fontSize: 15,
  },
  compactAuthorMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 24,
    marginBottom: 18,
    justifyContent: "space-between",
  },
  selfSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 22,
    marginBottom: 14,
  },
  compactSelfSummaryRow: {
    gap: 8,
    marginTop: 14,
    marginBottom: 10,
  },
  compactStatsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 10,
    paddingRight: 4,
  },
  tightCompactStatsRow: {
    gap: 6,
    paddingRight: 2,
  },
  compactStatItem: {
    flexShrink: 1,
  },
  tightCompactStatItem: {
    maxWidth: 54,
  },
  compactStatText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tightCompactStatText: {
    fontSize: 11,
  },
  compactStatValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  tightCompactStatValue: {
    fontSize: 14,
  },
  compactStatLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  tightCompactStatLabel: {
    fontSize: 10,
  },
  selfActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  tightSelfActionRow: {
    gap: 6,
  },
  compactEditButton: {
    height: 42,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tightCompactEditButton: {
    height: 36,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  compactEditButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  tightCompactEditButtonText: {
    fontSize: 13,
  },
  statBlock: {
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 13,
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
  },
  bioWrap: {
    marginTop: 2,
  },
  compactBioWrap: {
    marginTop: 0,
  },
  compactBio: {
    fontSize: 15,
    lineHeight: 22,
  },
  bioToggle: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  bioToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  profileActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  settingsIconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tightSettingsIconButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
  },
  shortcutsWrap: {
    marginTop: 16,
    marginHorizontal: -2,
  },
  compactShortcutsWrap: {
    marginTop: 8,
    marginHorizontal: 0,
  },
  shortcutsRow: {
    paddingRight: 8,
    gap: 10,
  },
  shortcutCard: {
    width: 140,
    minHeight: 82,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    justifyContent: "center",
  },
  compactShortcutCard: {
    width: 116,
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 2,
  },
  shortcutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shortcutTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  compactShortcutTitle: {
    fontSize: 12,
  },
  shortcutSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    paddingLeft: 28,
  },
  compactShortcutSubtitle: {
    fontSize: 9,
    lineHeight: 12,
    paddingLeft: 24,
  },
  noticeBanner: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  noticeBannerText: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionHeader: {
    marginTop: 24,
  },
  compactSectionHeader: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "800",
  },
  compactSectionTitle: {
    fontSize: 22,
  },
  profileTabBar: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
  },
  profileTabButton: {
    flex: 1,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 12,
    position: "relative",
  },
  profileTabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  profileTabText: {
    fontSize: 15,
    fontWeight: "800",
  },
  profileTabCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  profileTabUnderline: {
    position: "absolute",
    bottom: 0,
    width: 28,
    height: 3,
    borderRadius: 999,
  },
  profileRefreshIndicatorWrap: {
    position: "absolute",
    top: 116,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  profileRefreshIndicator: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  empty: {
    textAlign: "center",
    fontSize: 15,
    paddingTop: 40,
  },
  columnWrap: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  postCard: {
    width: "48%",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
  },
  postImage: {
    width: "100%",
    aspectRatio: 0.9,
  },
  postViewBadge: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  postViewBadgeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  hiddenBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  hiddenBadgeText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  postBody: {
    padding: 12,
    gap: 10,
  },
  postTitle: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23,
  },
  postActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  postActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  postActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  commentRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 16,
    gap: 12,
  },
  commentAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  commentBody: {
    flex: 1,
    gap: 5,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: "600",
  },
  commentContent: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  commentSource: {
    fontSize: 13,
    lineHeight: 18,
  },
  commentTime: {
    fontSize: 13,
    lineHeight: 18,
  },
  likedCard: {
    width: "48%",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 12,
  },
  likedImage: {
    width: "100%",
    aspectRatio: 0.9,
  },
  likedBody: {
    padding: 10,
    gap: 9,
  },
  likedTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  likedMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likedAuthorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  likedAuthor: {
    flex: 1,
    fontSize: 12,
  },
  likedHeart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likedCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  textarea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  drawerRoot: {
    flex: 1,
    justifyContent: "flex-start",
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 7, 11, 0.55)",
  },
  drawerOverlayPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerPanel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    paddingRight: 14,
  },
  drawerSafe: {
    flex: 1,
  },
  drawerContent: {
    paddingHorizontal: 16,
    paddingTop: 72,
    paddingBottom: 24,
    gap: 14,
  },
  drawerGroup: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
  },
  drawerItemIcon: {
    width: 26,
    textAlign: "center",
  },
  drawerItemText: {
    fontSize: 18,
    fontWeight: "600",
  },
  drawerBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 12,
  },
  drawerBottomButton: {
    flex: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  drawerBottomLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
