import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { BookingSheet } from "../components/BookingSheet";
import {
  ConsumerDrawerActionKey,
  ConsumerSideDrawer,
  MerchantDrawerActionKey,
  MerchantSideDrawer,
} from "../components/MerchantSideDrawer";
import { PrimaryButton } from "../components/PrimaryButton";
import { ShareSheet } from "../components/ShareSheet";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import {
  AuthorPost,
  AuthorProfile,
  MyStyleCommentItem,
  NailStyle,
  NearbyShop,
} from "../types/api";
import { getStoredValue, setStoredValue } from "../utils/sessionStorage";
import { formatRelativeRegionTime } from "../utils/postTime";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");
const profileBgDefault = require("../../assets/profile/profile_bg_default.png");
const PROFILE_HEADER_HEIGHT = Math.min(
  330,
  Math.max(300, Math.round(Dimensions.get("window").height * 0.34)),
);

const selfShortcutActions = [
  {
    key: "browse-history",
    icon: "time-outline",
    title: "浏览记录",
    subtitle: "看过的美甲",
  },
  {
    key: "hand-photos",
    icon: "hand-left-outline",
    title: "手图管理",
    subtitle: "管理本地手图",
  },
  {
    key: "tryon-history",
    icon: "sparkles-outline",
    title: "AI焕甲",
    subtitle: "查看试戴记录",
  },
] as const;

type SelfShortcutKey = (typeof selfShortcutActions)[number]["key"];
type ProfileContentTab = "posts" | "comments" | "liked";
type PostVisibilityTab = "public" | "private";

type AuthorProfileScreenProps = {
  authorId?: string;
  asProfileTab?: boolean;
};

function buildAuthorShopDetail(author: AuthorProfile): NearbyShop | null {
  if (!author.shop_id) return null;
  const city = author.shop_city || "深圳";
  return {
    id: author.shop_id,
    platform_shop_id: author.shop_id,
    name: author.shop_name || author.username,
    cover_image_url: author.avatar_url || "",
    city,
    region: city,
    address: author.shop_address || "",
    latitude: null,
    longitude: null,
    distance_meters: null,
    rating: null,
    heat_text: "平台入驻商家",
    average_price_text: "",
    business_time_text: null,
    phone_text: null,
  };
}

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
  return <View style={styles.statBlock}>{content}</View>;
}

export function AuthorProfileScreen({
  authorId,
  asProfileTab = false,
}: AuthorProfileScreenProps) {
  const navigation = useNavigation<any>();
  const dismissOverlay = useSlideOverlayDismiss();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const isDarkMode = useIsDarkMode();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const currentUser = useAuthStore((state) => state.user);
  const authScope = !hydrated ? "booting" : token ? "authed" : "anon";
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [editingPost, setEditingPost] = useState<AuthorPost | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [activeContentTab, setActiveContentTab] =
    useState<ProfileContentTab>("posts");
  const [postVisibilityTab, setPostVisibilityTab] =
    useState<PostVisibilityTab>("public");
  const [profileBgUri, setProfileBgUri] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [bookingVisible, setBookingVisible] = useState(false);
  const refreshSpin = useRef(new Animated.Value(0)).current;
  const profilePullY = useRef(new Animated.Value(0)).current;
  const selfPanelBackground = isDarkMode ? "rgba(8,8,12,0.86)" : colors.surface;
  const selfPanelBorder = isDarkMode ? "rgba(255,255,255,0.08)" : colors.border;
  const selfTabActiveColor = isDarkMode ? "#ffffff" : colors.text;
  const selfTabInactiveColor = isDarkMode
    ? "rgba(255,255,255,0.48)"
    : colors.subtext;

  const resolvedAuthorId = authorId ?? route.params?.authorId;
  const dismiss = () => dismissOverlay?.() ?? navigation.goBack();

  const query = useQuery({
    queryKey: ["author-profile", resolvedAuthorId, authScope],
    queryFn: () => api.getAuthorProfile(resolvedAuthorId),
    enabled: hydrated && Boolean(resolvedAuthorId),
  });

  const canQueryComments = Boolean(
    query.data && (query.data.is_mine || query.data.can_view_comments),
  );
  const canQueryLikedStyles = Boolean(
    query.data && (query.data.is_mine || query.data.can_view_likes),
  );
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
  const merchantShopQuery = useQuery({
    queryKey: ["merchant-shops"],
    queryFn: api.getMyMerchantShops,
    enabled: Boolean(token && asProfileTab && currentUser?.role === "merchant"),
  });
  const profileBgStorageKey = query.data?.is_mine
    ? `profile-bg:${query.data.uid}`
    : null;

  useEffect(() => {
    let cancelled = false;
    if (!profileBgStorageKey) {
      setProfileBgUri(null);
      return;
    }
    getStoredValue(profileBgStorageKey)
      .then((value) => {
        if (!cancelled) {
          setProfileBgUri(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfileBgUri(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profileBgStorageKey]);

  useEffect(() => {
    const initialTab = route.params?.initialTab;
    if (
      initialTab === "posts" ||
      initialTab === "comments" ||
      initialTab === "liked"
    ) {
      setActiveContentTab(initialTab);
      return;
    }
    setActiveContentTab("posts");
  }, [resolvedAuthorId, route.params?.initialTab]);

  useEffect(() => {
    if (!query.data) return;
    if (activeContentTab === "comments" && !canQueryComments) {
      setActiveContentTab("posts");
    }
    if (activeContentTab === "liked" && !canQueryLikedStyles) {
      setActiveContentTab("posts");
    }
  }, [activeContentTab, canQueryComments, canQueryLikedStyles, query.data]);

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
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [isPullRefreshing, refreshSpin]);

  const followMutation = useMutation({
    mutationFn: async ({
      targetId,
      isFollowing,
    }: {
      targetId: string;
      isFollowing: boolean;
    }) => {
      if (isFollowing) {
        await api.unfollowUser(targetId);
      } else {
        await api.followUser(targetId);
      }
    },
    onMutate: async ({ isFollowing }) => {
      await queryClient.cancelQueries({
        queryKey: ["author-profile", resolvedAuthorId],
      });
      const previousProfiles = queryClient.getQueriesData<AuthorProfile>({
        queryKey: ["author-profile", resolvedAuthorId],
      });
      queryClient.setQueriesData<AuthorProfile>(
        { queryKey: ["author-profile", resolvedAuthorId] },
        (old) => {
          if (!old) return old;
          const followerDelta = isFollowing ? -1 : 1;
          return {
            ...old,
            is_following: !isFollowing,
            follower_count: Math.max(0, old.follower_count + followerDelta),
          };
        },
      );
      return { previousProfiles };
    },
    onError: (_error, _variables, context) => {
      context?.previousProfiles.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["author-profile", resolvedAuthorId],
      });
      void queryClient.invalidateQueries({ queryKey: ["follow-list"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      postId,
      payload,
    }: {
      postId: string;
      payload: {
        title?: string;
        description?: string;
        tags?: string[];
        is_hidden?: boolean;
      };
    }) => api.updateMyPost(postId, payload),
    onSuccess: () => {
      setEditingPost(null);
      void queryClient.invalidateQueries({
        queryKey: ["author-profile", resolvedAuthorId],
      });
      void queryClient.invalidateQueries({ queryKey: ["my-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.deleteMyPost(postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["author-profile", resolvedAuthorId],
      });
      void queryClient.invalidateQueries({ queryKey: ["my-posts"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
    },
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async ({
      styleId,
      isLiked,
    }: {
      styleId: string;
      isLiked: boolean;
    }) => {
      if (isLiked) {
        await api.unlikeStyle(styleId);
      } else {
        await api.likeStyle(styleId);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["user-liked-styles"] });
      void queryClient.invalidateQueries({
        queryKey: ["author-profile", resolvedAuthorId],
      });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

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
      void queryClient.invalidateQueries({
        queryKey: ["author-profile", resolvedAuthorId],
      });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
      void queryClient.invalidateQueries({
        queryKey: ["conversation", resolvedAuthorId],
      });
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

  const handleMerchantDrawerAction = (key: MerchantDrawerActionKey) => {
    if (key === "market-data") {
      navigation.navigate("MerchantMarketData", { entryEdge: "left" });
      return;
    }
    if (key === "booking-management") {
      navigation.navigate("MerchantBookings");
      return;
    }
    if (key === "order-management") {
      navigation.navigate("MerchantOrders", { entryEdge: "left" });
      return;
    }
    if (key === "settings") {
      navigation.navigate("ProfileSettings", { entryEdge: "left" });
      return;
    }
  };

  const handleConsumerDrawerAction = (key: ConsumerDrawerActionKey) => {
    if (key === "orders") {
      navigation.navigate("ConsumerOrders", { entryEdge: "left" });
      return;
    }
    if (key === "browse-history") {
      navigation.navigate("BrowseHistory", { entryEdge: "left" });
      return;
    }
    if (key === "tryon-history") {
      navigation.navigate("TryOnHistory", { entryEdge: "left" });
      return;
    }
    if (key === "hand-photos") {
      navigation.navigate("HandPhotoManagement", { entryEdge: "left" });
      return;
    }
    if (key === "blocked-users") {
      navigation.navigate("BlockedUsers", { entryEdge: "left" });
      return;
    }
    if (key === "settings") {
      navigation.navigate("ProfileSettings", { entryEdge: "left" });
    }
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
  };

  const closeDrawer = () => {
    setDrawerMounted(false);
  };

  const pickProfileBackground = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要相册权限", "请允许访问相册后再更换主页背景。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const nextUri = result.assets[0].uri;
      setProfileBgUri(nextUri);
      if (profileBgStorageKey) {
        await setStoredValue(profileBgStorageKey, nextUri);
      }
    }
  };

  if (!resolvedAuthorId || query.isError) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            {!resolvedAuthorId ? "作者信息缺失，无法打开主页。" : "作者主页加载失败。"}
          </Text>
          <PrimaryButton
            label="返回"
            onPress={dismiss}
            style={styles.loadingBackButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!query.data) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            正在加载作者主页...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const author = query.data;
  const dmDisabled =
    author.has_blocked_viewer || author.viewer_has_blocked_author;
  const shouldCompactSelfProfile = Boolean(asProfileTab && author.is_mine);
  const heroTextColor = shouldCompactSelfProfile ? "#ffffff" : colors.text;
  const heroSubtextColor = shouldCompactSelfProfile
    ? "rgba(255,255,255,0.78)"
    : colors.subtext;
  const pullCenterAvatarOpacity = profilePullY.interpolate({
    inputRange: [0, 72, 128],
    outputRange: [0, 0.55, 1],
    extrapolate: "clamp",
  });
  const pullCenterAvatarScale = profilePullY.interpolate({
    inputRange: [0, 72, 128],
    outputRange: [0.58, 0.82, 1],
    extrapolate: "clamp",
  });
  const pullCenterAvatarTranslateY = profilePullY.interpolate({
    inputRange: [0, 128],
    outputRange: [-18, 0],
    extrapolate: "clamp",
  });
  const pullProfileInfoOpacity = profilePullY.interpolate({
    inputRange: [0, 72, 128],
    outputRange: [1, 0.45, 0],
    extrapolate: "clamp",
  });
  const pullProfileInfoTranslateY = profilePullY.interpolate({
    inputRange: [0, 128],
    outputRange: [0, -36],
    extrapolate: "clamp",
  });
  const pullProfileInfoStyle = shouldCompactSelfProfile
    ? {
        opacity: pullProfileInfoOpacity,
        transform: [{ translateY: pullProfileInfoTranslateY }],
      }
    : undefined;
  const isMerchantViewer = currentUser?.role === "merchant";
  const isMerchantAuthor = author.role === "merchant";
  const isMerchantSelfProfile = Boolean(
    asProfileTab && author.is_mine && currentUser?.role === "merchant",
  );
  const canBookMerchant = Boolean(
    !author.is_mine &&
    isMerchantAuthor &&
    author.shop_id &&
    currentUser?.role !== "merchant",
  );
  const authorShopDetail = isMerchantAuthor
    ? buildAuthorShopDetail(author)
    : null;
  const canFollowAuthor = Boolean(!author.is_mine);
  const visibleSelfShortcutActions: Array<
    (typeof selfShortcutActions)[number]
  > = [];
  const merchantShop = isMerchantSelfProfile
    ? (merchantShopQuery.data?.items[0] ?? null)
    : null;
  const bioText = author.bio?.trim() ?? "";
  const canShowComments = author.is_mine || author.can_view_comments;
  const canShowLikes = author.is_mine || author.can_view_likes;
  const commentsLockedForOthers = false;
  const likesLockedForOthers = false;
  const publicPosts = author.posts.filter((post) => !post.is_hidden);
  const privatePosts = author.posts.filter((post) => post.is_hidden);
  const visiblePosts = author.is_mine
    ? postVisibilityTab === "private"
      ? privatePosts
      : publicPosts
    : author.posts;
  const profileTabs = [
    {
      key: "posts" as const,
      label: author.is_mine ? "笔记" : "作品",
      count: author.is_mine ? visiblePosts.length : author.posts.length,
    },
    ...(canShowComments
      ? [
          {
            key: "comments" as const,
            label: "评论",
            count: commentsQuery.data?.items.length ?? 0,
            locked: commentsLockedForOthers,
          },
        ]
      : []),
    ...(canShowLikes
      ? [
          {
            key: "liked" as const,
            label: author.is_mine ? "喜欢" : "赞过",
            count: likedStylesQuery.data?.items.length ?? 0,
            locked: likesLockedForOthers,
          },
        ]
      : []),
  ];
  const listData: Array<AuthorPost | MyStyleCommentItem | NailStyle> =
    activeContentTab === "comments"
      ? (commentsQuery.data?.items ?? [])
      : activeContentTab === "liked"
        ? (likedStylesQuery.data?.items ?? [])
        : visiblePosts;
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
        : author.is_mine && postVisibilityTab === "private"
          ? "还没有私密笔记"
          : "这个作者还没有发布作品";

  const openFollowList = (kind: "following" | "followers") => {
    const canView =
      kind === "following"
        ? author.can_view_following
        : author.can_view_followers;
    if (!canView && !author.is_mine) {
      Alert.alert(
        "暂不可见",
        kind === "following"
          ? "该用户已设置关注列表不可见"
          : "该用户已设置粉丝列表不可见",
      );
      return;
    }
    navigation.navigate("FollowList", {
      authorId: author.id,
      kind,
      title: kind === "following" ? "关注" : "粉丝",
    });
  };
  const selfStats = [
    {
      key: "following",
      value: author.following_count,
      label: "关注",
      onPress: () => openFollowList("following"),
    },
    {
      key: "follower",
      value: author.follower_count,
      label: "粉丝",
      onPress: () => openFollowList("followers"),
    },
    {
      key: "liked",
      value: author.total_like_count,
      label: "获赞",
      onPress: undefined,
    },
  ];
  const selfFloatingTopBar = shouldCompactSelfProfile ? (
    <View
      style={[styles.floatingTopBar, { top: Math.max(insets.top, 26) + 10 }]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[
          styles.topButton,
          styles.compactTopButton,
          styles.profileGlassButton,
        ]}
        onPress={openDrawer}
      >
        <Ionicons name="menu-outline" size={28} color={heroTextColor} />
      </Pressable>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.floatingCenterAvatarWrap,
          {
            opacity: pullCenterAvatarOpacity,
            transform: [
              { translateY: pullCenterAvatarTranslateY },
              { scale: pullCenterAvatarScale },
            ],
          },
        ]}
      >
        <Image
          source={
            author.avatar_url
              ? { uri: resolveAssetUrl(author.avatar_url) }
              : defaultAvatar
          }
          style={[
            styles.floatingCenterAvatar,
            { backgroundColor: colors.surfaceAlt },
          ]}
        />
      </Animated.View>
      <View style={styles.topRightActions}>
        <Pressable
          style={styles.topEditPill}
          onPress={() => navigation.navigate("ProfileEdit")}
        >
          <Ionicons name="create-outline" size={17} color="#ffffff" />
          <Text style={styles.topEditPillText}>
            {isMerchantSelfProfile ? "编辑商户信息" : "编辑主页"}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.topButton,
            styles.compactTopButton,
            styles.profileGlassButton,
          ]}
          onPress={pickProfileBackground}
        >
          <Ionicons name="image-outline" size={21} color={heroTextColor} />
        </Pressable>
        <Pressable
          style={[
            styles.topButton,
            styles.compactTopButton,
            styles.profileGlassButton,
          ]}
          onPress={() => setShareVisible(true)}
        >
          <Ionicons name="arrow-redo-outline" size={22} color={heroTextColor} />
        </Pressable>
      </View>
    </View>
  ) : null;

  const profileHeader = (
    <View
      style={[
        styles.headerCard,
        shouldCompactSelfProfile && styles.compactHeaderCard,
        shouldCompactSelfProfile && { width: windowWidth, alignSelf: "center" },
        { backgroundColor: colors.surface },
      ]}
    >
      {shouldCompactSelfProfile ? (
        <>
          <Image
            source={profileBgUri ? { uri: profileBgUri } : profileBgDefault}
            resizeMode="cover"
            style={[styles.profileBackgroundImage, { width: windowWidth }]}
          />
          <View style={styles.profileBackgroundOverlay} />
        </>
      ) : (
        <View
          style={[
            styles.headerBackdrop,
            { backgroundColor: colors.accentSoft },
          ]}
        />
      )}
      {!shouldCompactSelfProfile ? (
        <View style={styles.topBar}>
          {asProfileTab && author.is_mine ? (
            <>
              <Pressable
                style={[
                  styles.topButton,
                  shouldCompactSelfProfile && styles.compactTopButton,
                  shouldCompactSelfProfile && styles.profileGlassButton,
                ]}
                onPress={openDrawer}
              >
                <Ionicons name="menu-outline" size={28} color={heroTextColor} />
              </Pressable>
              <View style={styles.topRightActions}>
                <Pressable
                  style={styles.topEditPill}
                  onPress={() => navigation.navigate("ProfileEdit")}
                >
                  <Ionicons name="create-outline" size={17} color="#ffffff" />
                  <Text style={styles.topEditPillText}>
                    {isMerchantSelfProfile ? "编辑商户信息" : "编辑主页"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.topButton,
                    shouldCompactSelfProfile && styles.compactTopButton,
                    styles.profileGlassButton,
                  ]}
                  onPress={pickProfileBackground}
                >
                  <Ionicons
                    name="image-outline"
                    size={21}
                    color={heroTextColor}
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.topButton,
                    shouldCompactSelfProfile && styles.compactTopButton,
                    styles.profileGlassButton,
                  ]}
                  onPress={() => setShareVisible(true)}
                >
                  <Ionicons
                    name="arrow-redo-outline"
                    size={22}
                    color={heroTextColor}
                  />
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable
                style={[
                  styles.topButton,
                  shouldCompactSelfProfile && styles.compactTopButton,
                ]}
                onPress={dismiss}
              >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </Pressable>
              <Pressable
                style={[
                  styles.topButton,
                  shouldCompactSelfProfile && styles.compactTopButton,
                ]}
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
                      text: author.viewer_has_blocked_author
                        ? "恢复查看"
                        : "不再看她",
                      style: author.viewer_has_blocked_author
                        ? "default"
                        : "destructive",
                      onPress: () => blockMutation.mutate(),
                    },
                  ]);
                }}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.heroRow,
          shouldCompactSelfProfile && styles.compactHeroRow,
          pullProfileInfoStyle,
        ]}
      >
        <Image
          source={
            author.avatar_url
              ? { uri: resolveAssetUrl(author.avatar_url) }
              : defaultAvatar
          }
          style={[
            styles.avatar,
            shouldCompactSelfProfile && styles.compactAvatar,
            { backgroundColor: colors.surfaceAlt },
          ]}
        />
        <View
          style={[
            styles.heroText,
            shouldCompactSelfProfile && styles.compactHeroText,
          ]}
        >
          <Text
            style={[
              styles.authorName,
              shouldCompactSelfProfile && styles.compactAuthorName,
              { color: heroTextColor },
            ]}
          >
            {author.username}
          </Text>
          <Text
            style={[
              styles.authorMeta,
              shouldCompactSelfProfile && styles.compactAuthorMeta,
              { color: heroSubtextColor },
            ]}
          >
            {isMerchantSelfProfile ? "商家焕甲号" : "焕甲号"}：{author.uid}
          </Text>
          <Text
            style={[
              styles.authorMeta,
              shouldCompactSelfProfile && styles.compactAuthorMeta,
              { color: heroSubtextColor },
            ]}
          >
            IP：{author.ip_location}
          </Text>
        </View>
      </Animated.View>

      {author.is_mine ? (
        <Animated.View
          style={[
            styles.selfSummaryRow,
            shouldCompactSelfProfile && styles.compactSelfSummaryRow,
            pullProfileInfoStyle,
          ]}
        >
          <View
            style={[
              styles.compactStatsRow,
              shouldCompactSelfProfile && styles.tightCompactStatsRow,
            ]}
          >
            {selfStats.map((item) => (
              <Pressable
                key={item.key}
                style={[
                  styles.compactStatItem,
                  shouldCompactSelfProfile && styles.tightCompactStatItem,
                ]}
                onPress={item.onPress}
                disabled={!item.onPress}
              >
                <Text
                  style={[
                    styles.compactStatText,
                    shouldCompactSelfProfile && styles.tightCompactStatText,
                    { color: heroTextColor },
                  ]}
                  numberOfLines={1}
                >
                  <Text
                    style={[
                      styles.compactStatValue,
                      shouldCompactSelfProfile && styles.tightCompactStatValue,
                    ]}
                  >
                    {item.value}
                  </Text>
                  <Text
                    style={[
                      styles.compactStatLabel,
                      shouldCompactSelfProfile && styles.tightCompactStatLabel,
                      { color: heroSubtextColor },
                    ]}
                  >
                    {" "}
                    {item.label}
                  </Text>
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : (
        <View style={styles.statsRow}>
          <StatBlock
            value={author.following_count}
            label="关注"
            color={colors.text}
            subtextColor={colors.subtext}
            onPress={() => openFollowList("following")}
          />
          <StatBlock
            value={author.follower_count}
            label="粉丝"
            color={colors.text}
            subtextColor={colors.subtext}
            onPress={() => openFollowList("followers")}
          />
          <StatBlock
            value={author.total_like_count}
            label="获赞"
            color={colors.text}
            subtextColor={colors.subtext}
          />
        </View>
      )}

      {bioText ? (
        <Animated.View
          style={[
            styles.bioWrap,
            shouldCompactSelfProfile && styles.compactBioWrap,
            pullProfileInfoStyle,
          ]}
        >
          <Text
            style={[
              styles.bio,
              shouldCompactSelfProfile && styles.compactBio,
              { color: heroTextColor },
            ]}
          >
            {bioText}
          </Text>
        </Animated.View>
      ) : null}

      {author.has_blocked_viewer ? (
        <View
          style={[styles.noticeBanner, { backgroundColor: colors.dangerSoft }]}
        >
          <Text style={[styles.noticeBannerText, { color: colors.dangerText }]}>
            对方已设置不再看你
          </Text>
        </View>
      ) : null}

      {author.viewer_has_blocked_author ? (
        <View
          style={[styles.noticeBanner, { backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.noticeBannerText, { color: colors.subtext }]}>
            你已设置不再看她，恢复后才能继续私信
          </Text>
        </View>
      ) : null}

      {authorShopDetail ? (
        <Pressable
          style={[
            styles.merchantShopCard,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
          onPress={() =>
            navigation.navigate("MarketShopDetail", {
              shop: authorShopDetail,
              entryEdge: "right",
            })
          }
        >
          <View
            style={[
              styles.merchantShopIcon,
              { backgroundColor: colors.accentSoft },
            ]}
          >
            <Ionicons
              name="storefront-outline"
              size={20}
              color={colors.accent}
            />
          </View>
          <View style={styles.merchantShopInfo}>
            <Text
              style={[styles.merchantShopTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {authorShopDetail.name}
            </Text>
            <Text
              style={[styles.merchantShopMeta, { color: colors.subtext }]}
              numberOfLines={1}
            >
              {[authorShopDetail.city, authorShopDetail.address]
                .filter(Boolean)
                .join(" · ") || "平台入驻商家"}
            </Text>
          </View>
          <View
            style={[
              styles.merchantShopAction,
              { backgroundColor: colors.accent },
            ]}
          >
            <Text style={styles.merchantShopActionText}>进入店铺</Text>
          </View>
        </Pressable>
      ) : null}

      {!author.is_mine ? (
        <View style={styles.profileActions}>
          <>
            {canFollowAuthor ? (
              <PrimaryButton
                label={author.is_following ? "已关注" : "关注"}
                onPress={() => {
                  if (!currentUser) {
                    navigation.navigate("Login");
                    return;
                  }
                  if (
                    author.has_blocked_viewer ||
                    author.viewer_has_blocked_author
                  )
                    return;
                  followMutation.mutate({
                    targetId: author.id,
                    isFollowing: author.is_following,
                  });
                }}
                loading={followMutation.isPending}
                disabled={
                  author.has_blocked_viewer || author.viewer_has_blocked_author
                }
                variant={author.is_following ? "ghost" : "filled"}
                style={{ flex: 1 }}
              />
            ) : null}
            <PrimaryButton
              label={
                author.has_blocked_viewer
                  ? "无法私信"
                  : author.viewer_has_blocked_author
                    ? "不再看她"
                    : "发私信"
              }
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
            {canBookMerchant ? (
              <PrimaryButton
                label="预约门店"
                onPress={() => {
                  if (!currentUser) {
                    navigation.navigate("Login");
                    return;
                  }
                  setBookingVisible(true);
                }}
                style={{ flex: 1 }}
              />
            ) : null}
          </>
        </View>
      ) : null}

      {author.is_mine && visibleSelfShortcutActions.length ? (
        <View
          style={[
            styles.shortcutsWrap,
            shouldCompactSelfProfile && styles.compactShortcutsWrap,
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shortcutsRow}
          >
            {visibleSelfShortcutActions.map((item) => (
              <Pressable
                key={item.key}
                style={[
                  styles.shortcutCard,
                  shouldCompactSelfProfile && styles.compactShortcutCard,
                  { backgroundColor: colors.surfaceAlt },
                ]}
                onPress={() => handleSelfShortcutPress(item.key)}
              >
                <View style={styles.shortcutHeader}>
                  <Ionicons
                    name={item.icon}
                    size={shouldCompactSelfProfile ? 16 : 20}
                    color={colors.text}
                  />
                  <Text
                    style={[
                      styles.shortcutTitle,
                      shouldCompactSelfProfile && styles.compactShortcutTitle,
                      { color: colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.shortcutSubtitle,
                    shouldCompactSelfProfile && styles.compactShortcutSubtitle,
                    { color: colors.subtext },
                  ]}
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
        <View
          style={[
            styles.profileTabBar,
            shouldCompactSelfProfile && styles.selfProfileTabBar,
            {
              backgroundColor: shouldCompactSelfProfile
                ? selfPanelBackground
                : undefined,
              borderColor: shouldCompactSelfProfile
                ? selfPanelBorder
                : colors.border,
            },
          ]}
        >
          {profileTabs.map((item) => {
            const active = activeContentTab === item.key;
            const tabActiveColor = shouldCompactSelfProfile
              ? selfTabActiveColor
              : colors.text;
            const tabInactiveColor = shouldCompactSelfProfile
              ? selfTabInactiveColor
              : colors.subtext;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.profileTabButton,
                  shouldCompactSelfProfile && styles.selfProfileTabButton,
                ]}
                onPress={() => setActiveContentTab(item.key)}
              >
                <View style={styles.profileTabLabelRow}>
                  {item.locked ? (
                    <Ionicons
                      name="lock-closed-outline"
                      size={13}
                      color={active ? tabActiveColor : tabInactiveColor}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.profileTabText,
                      { color: active ? tabActiveColor : tabInactiveColor },
                    ]}
                  >
                    {item.label}
                    {!author.is_mine ? (
                      <Text
                        style={[
                          styles.profileTabCount,
                          { color: active ? tabActiveColor : tabInactiveColor },
                        ]}
                      >
                        {" "}
                        {item.count}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                {active ? (
                  <View
                    style={[
                      styles.profileTabUnderline,
                      { backgroundColor: colors.accent },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View
          style={[
            styles.sectionHeader,
            shouldCompactSelfProfile && styles.compactSectionHeader,
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              shouldCompactSelfProfile && styles.compactSectionTitle,
              { color: colors.text },
            ]}
          >
            作品
          </Text>
        </View>
      )}
      {author.is_mine && activeContentTab === "posts" ? (
        <View
          style={[
            styles.postVisibilityBar,
            {
              backgroundColor: selfPanelBackground,
              borderColor: selfPanelBorder,
            },
          ]}
        >
          {[
            {
              key: "public" as const,
              label: "公开",
              count: publicPosts.length,
            },
            {
              key: "private" as const,
              label: "私密",
              count: privatePosts.length,
            },
          ].map((item) => {
            const active = postVisibilityTab === item.key;
            return (
              <Pressable
                key={item.key}
                style={styles.postVisibilityButton}
                onPress={() => setPostVisibilityTab(item.key)}
              >
                <View style={styles.postVisibilityLabelRow}>
                  {item.key === "private" ? (
                    <Ionicons
                      name="lock-closed-outline"
                      size={13}
                      color={active ? selfTabActiveColor : selfTabInactiveColor}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.postVisibilityText,
                      {
                        color: active
                          ? selfTabActiveColor
                          : selfTabInactiveColor,
                      },
                    ]}
                  >
                    {item.label} {item.count}
                  </Text>
                </View>
                {active ? (
                  <View
                    style={[
                      styles.postVisibilityUnderline,
                      { backgroundColor: colors.accent },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <FlatList
        key={`author-content-${activeContentTab}-${listIsTwoColumns ? "grid" : "list"}`}
        style={styles.contentList}
        data={listData}
        keyExtractor={(item) =>
          "comment_id" in item ? item.comment_id : item.id
        }
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: profilePullY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        bounces
        alwaysBounceVertical={Boolean(asProfileTab && author.is_mine)}
        contentContainerStyle={[
          styles.list,
          shouldCompactSelfProfile && styles.compactList,
        ]}
        ListHeaderComponent={profileHeader}
        ListEmptyComponent={
          <View
            style={[
              shouldCompactSelfProfile && styles.selfEmptyWrap,
              {
                backgroundColor: shouldCompactSelfProfile
                  ? isDarkMode
                    ? colors.background
                    : colors.surface
                  : "transparent",
              },
            ]}
          >
            <Text style={[styles.empty, { color: colors.subtext }]}>
              {emptyText}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if ("comment_id" in item) {
            return (
              <Pressable
                style={[
                  styles.commentRow,
                  { backgroundColor: colors.background },
                ]}
                onPress={() =>
                  navigation.navigate("StylePreview", {
                    styleId: item.style_id,
                  })
                }
              >
                <Image
                  source={
                    author.avatar_url
                      ? { uri: resolveAssetUrl(author.avatar_url) }
                      : defaultAvatar
                  }
                  style={[
                    styles.commentAvatar,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                />
                <View style={styles.commentBody}>
                  <Text
                    style={[styles.commentAuthor, { color: colors.subtext }]}
                  >
                    {author.username}
                  </Text>
                  <Text
                    style={[styles.commentContent, { color: colors.text }]}
                    numberOfLines={3}
                  >
                    {item.comment_content}
                  </Text>
                  <Text
                    style={[styles.commentSource, { color: colors.subtext }]}
                    numberOfLines={1}
                  >
                    来自作品 · {item.style_title}
                  </Text>
                  <Text style={[styles.commentTime, { color: colors.subtext }]}>
                    {formatRelativeRegionTime(item.comment_created_at, "广东")}{" "}
                    · 公开
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.subtext}
                />
              </Pressable>
            );
          }

          if ("author_name" in item) {
            return (
              <Pressable
                style={[styles.postCard, { backgroundColor: colors.surface }]}
                onPress={() =>
                  navigation.navigate("StylePreview", { styleId: item.id })
                }
              >
                <Image
                  source={{ uri: resolveAssetUrl(item.image_url) }}
                  style={[
                    styles.postImage,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                />
                <View style={styles.postBody}>
                  <Text
                    style={[styles.postTitle, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <View style={styles.likedMetaRow}>
                    <Image
                      source={
                        item.author_avatar_url
                          ? { uri: resolveAssetUrl(item.author_avatar_url) }
                          : defaultAvatar
                      }
                      style={styles.likedAuthorAvatar}
                    />
                    <Text
                      style={[styles.likedAuthor, { color: colors.subtext }]}
                      numberOfLines={1}
                    >
                      {item.author_name}
                    </Text>
                    {!isMerchantViewer ? (
                      <Pressable
                        style={styles.likedHeart}
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          if (!currentUser) {
                            navigation.navigate("Login");
                            return;
                          }
                          toggleLikeMutation.mutate({
                            styleId: item.id,
                            isLiked: item.is_liked,
                          });
                        }}
                      >
                        <Ionicons
                          name={item.is_liked ? "heart" : "heart-outline"}
                          size={18}
                          color={item.is_liked ? colors.accent : colors.subtext}
                        />
                        <Text
                          style={[styles.likedCount, { color: colors.subtext }]}
                        >
                          {item.like_count}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }

          const managePostId = item.manage_post_id ?? null;
          return (
            <Pressable
              style={[styles.postCard, { backgroundColor: colors.surface }]}
              onPress={() =>
                navigation.navigate("StylePreview", { styleId: item.id })
              }
            >
              <View>
                <Image
                  source={{ uri: resolveAssetUrl(item.image_url) }}
                  style={[
                    styles.postImage,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                />
                {author.is_mine ? (
                  <View
                    style={[
                      styles.postViewBadge,
                      { backgroundColor: colors.overlay },
                    ]}
                  >
                    <Ionicons name="eye-outline" size={15} color="#ffffff" />
                    <Text style={styles.postViewBadgeText}>
                      {item.unique_viewer_count}
                    </Text>
                  </View>
                ) : null}
                {item.is_hidden ? (
                  <View
                    style={[
                      styles.hiddenBadge,
                      { backgroundColor: colors.overlay },
                    ]}
                  >
                    <Text style={styles.hiddenBadgeText}>已隐藏</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.postBody}>
                <Text
                  style={[styles.postTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <View style={styles.likedMetaRow}>
                  <Image
                    source={
                      author.avatar_url
                        ? { uri: resolveAssetUrl(author.avatar_url) }
                        : defaultAvatar
                    }
                    style={styles.likedAuthorAvatar}
                  />
                  <Text
                    style={[styles.likedAuthor, { color: colors.subtext }]}
                    numberOfLines={1}
                  >
                    {author.username}
                  </Text>
                  {!isMerchantViewer ? (
                    <Pressable
                      style={styles.likedHeart}
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        if (!currentUser) {
                          navigation.navigate("Login");
                          return;
                        }
                        toggleLikeMutation.mutate({
                          styleId: item.id,
                          isLiked: item.is_liked,
                        });
                      }}
                    >
                      <Ionicons
                        name={item.is_liked ? "heart" : "heart-outline"}
                        size={18}
                        color={item.is_liked ? colors.accent : colors.subtext}
                      />
                      <Text
                        style={[styles.likedCount, { color: colors.subtext }]}
                      >
                        {item.like_count}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {author.is_mine && managePostId ? (
                  <View style={styles.postActions}>
                    <Pressable
                      style={[
                        styles.postActionButton,
                        { backgroundColor: colors.surfaceAlt },
                      ]}
                      onPress={(event) => {
                        event.stopPropagation();
                        openEdit(item);
                      }}
                    >
                      <Text
                        style={[styles.postActionText, { color: colors.text }]}
                      >
                        编辑
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.postActionButton,
                        { backgroundColor: colors.surfaceAlt },
                      ]}
                      onPress={(event) => {
                        event.stopPropagation();
                        updateMutation.mutate({
                          postId: managePostId,
                          payload: { is_hidden: !item.is_hidden },
                        });
                      }}
                    >
                      <Text
                        style={[styles.postActionText, { color: colors.text }]}
                      >
                        {item.is_hidden ? "显示" : "隐藏"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.postActionButton,
                        { backgroundColor: colors.dangerSoft },
                      ]}
                      onPress={(event) => {
                        event.stopPropagation();
                        Alert.alert(
                          "删除作品",
                          "删除后将永久无法找回，确认删除吗？",
                          [
                            { text: "取消", style: "cancel" },
                            {
                              text: "删除",
                              style: "destructive",
                              onPress: () =>
                                deleteMutation.mutate(managePostId),
                            },
                          ],
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.postActionText,
                          { color: colors.dangerText },
                        ]}
                      >
                        删除
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
      {selfFloatingTopBar}

      {asProfileTab && author.is_mine && isPullRefreshing ? (
        <View style={styles.profileRefreshIndicatorWrap} pointerEvents="none">
          <View
            style={[
              styles.profileRefreshIndicator,
              { backgroundColor: colors.navBackground },
            ]}
          >
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
              <Ionicons
                name="refresh-outline"
                size={34}
                color={colors.accent}
              />
            </Animated.View>
          </View>
        </View>
      ) : null}

      <Modal
        visible={!!editingPost}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPost(null)}
      >
        <KeyboardAvoidingView
          style={[
            styles.modalOverlay,
            { backgroundColor: "rgba(9, 11, 16, 0.45)" },
          ]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              编辑作品
            </Text>
            <TextInput
              value={editingTitle}
              onChangeText={setEditingTitle}
              placeholder="标题"
              placeholderTextColor={colors.subtext}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceAlt,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
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
                {
                  backgroundColor: colors.surfaceAlt,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />
            <TextInput
              value={editingTags}
              onChangeText={setEditingTags}
              placeholder="标签，逗号分隔"
              placeholderTextColor={colors.subtext}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceAlt,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <PrimaryButton
                label="取消"
                onPress={() => setEditingPost(null)}
                variant="ghost"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label="保存"
                onPress={saveEdit}
                loading={updateMutation.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {asProfileTab && author.is_mine && currentUser?.role === "merchant" ? (
        <MerchantSideDrawer
          visible={drawerMounted}
          onClose={closeDrawer}
          onAction={handleMerchantDrawerAction}
        />
      ) : null}
      {asProfileTab && author.is_mine && currentUser?.role !== "merchant" ? (
        <ConsumerSideDrawer
          visible={drawerMounted}
          onClose={closeDrawer}
          onAction={handleConsumerDrawerAction}
        />
      ) : null}
      <BookingSheet
        visible={bookingVisible}
        onClose={() => setBookingVisible(false)}
        shopId={author.shop_id}
        shopName={author.shop_name ?? author.username}
        shopCity={author.shop_city ?? "深圳"}
        onSuccess={() =>
          Alert.alert("预约已提交", "商家会在预约列表里处理你的门店预约。")
        }
      />
      <ShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 28 },
  loadingText: { fontSize: 15 },
  loadingBackButton: { minWidth: 120 },
  contentList: { flex: 1 },
  list: { paddingBottom: 120, paddingHorizontal: 14, gap: 14 },
  compactList: { paddingHorizontal: 10, gap: 10 },
  headerCard: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 18,
    marginBottom: 12,
  },
  compactHeaderCard: {
    borderRadius: 0,
    paddingHorizontal: 22,
    paddingTop: 76,
    paddingBottom: 14,
    marginBottom: 0,
    minHeight: PROFILE_HEADER_HEIGHT,
  },
  headerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
  },
  profileBackgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    height: PROFILE_HEADER_HEIGHT,
  },
  profileBackgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: PROFILE_HEADER_HEIGHT,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  compactTopBar: {
    marginBottom: 20,
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
  profileGlassButton: {
    backgroundColor: "rgba(20,20,24,0.28)",
  },
  pullCenterAvatarWrap: {
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    zIndex: 4,
    alignItems: "center",
  },
  pullCenterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)",
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topEditPill: {
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  topEditPillText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  floatingTopBar: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 12,
    minHeight: 62,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingCenterAvatarWrap: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  floatingCenterAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)",
  },
  heroRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  compactHeroRow: {
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  compactAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  compactHeroText: {
    gap: 2,
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
    fontSize: 12,
    lineHeight: 16,
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
    justifyContent: "flex-start",
    gap: 0,
    marginTop: 22,
    marginBottom: 12,
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
    flex: 0,
    gap: 20,
    paddingRight: 2,
  },
  compactStatItem: {
    flexShrink: 1,
  },
  tightCompactStatItem: {
    maxWidth: 94,
  },
  compactStatText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tightCompactStatText: {
    fontSize: 13,
  },
  compactStatValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  tightCompactStatValue: {
    fontSize: 22,
  },
  compactStatLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  tightCompactStatLabel: {
    fontSize: 14,
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
    marginBottom: 10,
  },
  compactBio: {
    fontSize: 15,
    lineHeight: 21,
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
  merchantShopCard: {
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  merchantShopIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantShopInfo: {
    flex: 1,
    gap: 3,
  },
  merchantShopTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  merchantShopMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  merchantShopAction: {
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantShopActionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
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
  selfProfileTabBar: {
    marginHorizontal: -26,
    paddingLeft: 26,
    borderTopWidth: 0,
    backgroundColor: "rgba(8,8,12,0.68)",
    justifyContent: "flex-start",
    gap: 30,
  },
  profileTabButton: {
    flex: 1,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 12,
    position: "relative",
  },
  selfProfileTabButton: {
    flex: 0,
    alignItems: "flex-start",
    paddingHorizontal: 0,
    minWidth: 54,
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
  postVisibilityBar: {
    marginHorizontal: -26,
    paddingLeft: 26,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 26,
    backgroundColor: "rgba(8,8,12,0.86)",
  },
  postVisibilityButton: {
    position: "relative",
    paddingBottom: 6,
  },
  postVisibilityLabelRow: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postVisibilityText: {
    fontSize: 14,
    fontWeight: "800",
  },
  postVisibilityUnderline: {
    position: "absolute",
    left: 0,
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
  selfEmptyWrap: {
    minHeight: 360,
    alignItems: "center",
    justifyContent: "flex-start",
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
});
