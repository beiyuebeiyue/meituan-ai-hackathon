import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { BookingSheet } from "../components/BookingSheet";
import { BrowseFeedCard } from "../components/BrowseFeedCard";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useMarketStore } from "../store/useMarketStore";
import { NailStyle, NearbyShop } from "../types/api";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const fallbackAvatar = require("../../assets/profile/default_avatar.png");
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const SHOP_COVER_TABS = ["封面", "效果展示", "门店环境", "相册"];
const SHOP_SECTION_TABS = ["团购", "美甲师", "评价", "相关推荐"];
const SHOP_TAGS = ["免费停车", "无隐性消费", "有沙发位", "支持预约"];

type MarketShopDetailRoute = {
  params?: {
    shop?: NearbyShop;
  };
};

function formatDistance(distanceMeters?: number | null) {
  if (distanceMeters == null) return "距离暂未开放";
  if (distanceMeters < 1000) return `${distanceMeters}m`;
  return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)}km`;
}

function formatRating(rating?: number | null) {
  return typeof rating === "number" && rating > 0 ? rating.toFixed(1) : null;
}

function joinMeta(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" · ");
}

function formatLocationLine(region?: string | null, address?: string | null) {
  const normalizedRegion = region?.trim();
  const normalizedAddress = address?.trim();
  if (!normalizedRegion) return normalizedAddress || "地址暂未开放";
  if (!normalizedAddress) return normalizedRegion;
  if (normalizedAddress.includes(normalizedRegion)) return normalizedAddress;
  return `${normalizedRegion} · ${normalizedAddress}`;
}

function formatPostDate(createdAt?: string | null) {
  if (!createdAt) return "";
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return createdAt.slice(0, 10);
  const now = new Date();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  if (parsed.getFullYear() === now.getFullYear()) return `${month}-${day}`;
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function getCreatedTime(item: NailStyle) {
  const parsed = new Date(item.created_at);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isReviewWithinLastYear(item: NailStyle) {
  const createdTime = getCreatedTime(item);
  if (!createdTime) return false;
  return Date.now() - createdTime <= ONE_YEAR_MS;
}

function sortReviewsByHot(a: NailStyle, b: NailStyle) {
  if (b.like_count !== a.like_count) return b.like_count - a.like_count;
  if (b.comment_count !== a.comment_count) return b.comment_count - a.comment_count;
  return getCreatedTime(b) - getCreatedTime(a);
}

function pickFeaturedReviews(items: NailStyle[]) {
  const recentItems = items.filter(isReviewWithinLastYear);
  const source = recentItems.length > 0 ? recentItems : items;
  return [...source].sort(sortReviewsByHot).slice(0, 2);
}

export function MarketShopDetailScreen() {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const navigation = useNavigation<any>();
  const route = useRoute() as MarketShopDetailRoute;
  const dismiss = useSlideOverlayDismiss();
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const pendingBookingStyleId = useMarketStore((state) => state.pendingBookingStyleId);
  const setPendingBookingStyleId = useMarketStore((state) => state.setPendingBookingStyleId);
  const shop = route.params?.shop;
  const authScope = !hydrated ? "booting" : token ? "authed" : "anon";
  const platformShopId = shop?.platform_shop_id ?? null;
  const canBookShop = Boolean(platformShopId);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [resumeBookingAfterLogin, setResumeBookingAfterLogin] = useState(false);

  const galleryQuery = useQuery({
    queryKey: ["market-shop-gallery", platformShopId, authScope],
    queryFn: () =>
      platformShopId
        ? api.getShopStyles(platformShopId)
        : Promise.resolve({ page: 1, page_size: 0, total: 0, items: [] }),
    enabled: hydrated && Boolean(shop),
  });

  const toggleLikeMutation = useMutation({
    mutationFn: (item: NailStyle) => (item.is_liked ? api.unlikeStyle(item.id) : api.likeStyle(item.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-shop-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["browse"] });
      queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

  const goBack = () => {
    if (dismiss) {
      dismiss();
      return;
    }
    navigation.goBack();
  };

  useEffect(() => {
    if (!token || !resumeBookingAfterLogin) return;
    setResumeBookingAfterLogin(false);
    if (platformShopId) {
      setBookingVisible(true);
    }
  }, [platformShopId, resumeBookingAfterLogin, token]);

  const openBooking = () => {
    if (!platformShopId) {
      Alert.alert("暂不支持预约", "该店暂未入驻焕甲，暂不支持在线预约。");
      return;
    }
    if (!token) {
      setResumeBookingAfterLogin(true);
      navigation.navigate("Login", { entryEdge: "right" });
      return;
    }
    setBookingVisible(true);
  };

  const handleCall = () => {
    Alert.alert("联系门店", shop?.phone_text || "该门店暂未开放电话。");
  };

  const handleConsult = () => {
    Alert.alert("在线咨询", "后续会接入门店客服会话。");
  };

  const handleNavigationShortcut = () => {
    Alert.alert("导航到店", "后续接入高德地图导航。");
  };

  const handleAskAI = () => {
    if (currentUser?.role === "merchant") {
      Alert.alert("问小嘉", "商家端暂不支持问小嘉。");
      return;
    }
    navigation.navigate("MainTabs", { screen: "AskAI" });
  };

  if (!shop) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable style={[styles.iconButton, { backgroundColor: colors.surface }]} onPress={goBack}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="storefront-outline" size={40} color={colors.subtext} />
          <Text style={[styles.emptyText, { color: colors.subtext }]}>门店信息不可用</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rating = formatRating(shop.rating);
  const isPlatformShop = Boolean(platformShopId);
  const galleryItems = galleryQuery.data?.items ?? [];
  const reviewItems = galleryItems.filter((item) => item.verified_consumption);
  const featuredReviewItems = pickFeaturedReviews(reviewItems);
  const merchantGalleryItems = galleryItems.filter((item) => !item.verified_consumption).slice(0, 2);
  const heroSourceUri = shop.cover_image_url || (isPlatformShop ? merchantGalleryItems[0]?.image_url || reviewItems[0]?.image_url : null);
  const heroUri = heroSourceUri ? resolveAssetUrl(heroSourceUri) : null;
  const priceAndTime = joinMeta([shop.average_price_text, shop.business_time_text]);
  const galleryCopy = "精选该店当前热门作品。";
  const hasRecentFeaturedReview = featuredReviewItems.some(isReviewWithinLastYear);
  const reviewCopy =
    reviewItems.length > 0
      ? `${hasRecentFeaturedReview ? "近一年高赞评价" : "历史高赞评价"} · 共 ${reviewItems.length} 条`
      : "当前店还没有评论";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, !isPlatformShop ? styles.contentNoBottomBar : null]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={[styles.heroImage, { backgroundColor: colors.surfaceAlt }]} />
          ) : (
            <View style={[styles.heroPhotoPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="storefront-outline" size={42} color={colors.subtext} />
              <Text style={[styles.heroPhotoPlaceholderText, { color: colors.subtext }]}>暂无门店照片</Text>
            </View>
          )}
          <View style={styles.heroOverlay} />
          <View style={styles.header}>
            <Pressable style={[styles.iconButton, { backgroundColor: isDark ? "rgba(27,28,32,0.78)" : "rgba(255,255,255,0.84)" }]} onPress={goBack}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
            {isPlatformShop ? (
              <>
                <View style={[styles.heroSearch, { backgroundColor: isDark ? "rgba(27,28,32,0.66)" : "rgba(255,255,255,0.62)" }]}>
                  <Ionicons name="search" size={18} color="rgba(255,255,255,0.92)" />
                  <Text style={styles.heroSearchText} numberOfLines={1}>
                    搜索店内美甲
                  </Text>
                </View>
                <View style={styles.heroActions}>
                  <Pressable style={[styles.actionButton, { backgroundColor: isDark ? "rgba(27,28,32,0.7)" : "rgba(255,255,255,0.72)" }]}>
                    <Ionicons name="star-outline" size={22} color={colors.text} />
                  </Pressable>
                  <Pressable style={[styles.actionButton, { backgroundColor: isDark ? "rgba(27,28,32,0.7)" : "rgba(255,255,255,0.72)" }]}>
                    <Ionicons name="arrow-redo-outline" size={22} color={colors.text} />
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
          {isPlatformShop ? (
            <View style={styles.coverTabs}>
              {SHOP_COVER_TABS.map((tab, index) => (
                <View key={tab} style={[styles.coverTab, index === 0 ? styles.coverTabActive : null]}>
                  <Text style={[styles.coverTabText, index === 0 ? styles.coverTabTextActive : null]}>{tab}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={[styles.heroInfo, !isPlatformShop ? styles.heroInfoCompact : null]}>
            <Text style={styles.shopName} numberOfLines={2}>
              {shop.name}
            </Text>
            <Text style={styles.shopSub} numberOfLines={1}>
              {formatLocationLine(shop.region, shop.address)}
            </Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          {pendingBookingStyleId && isPlatformShop ? (
            <View style={[styles.pendingBookingBanner, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="calendar-outline" size={17} color={colors.accent} />
              <Text style={[styles.pendingBookingText, { color: colors.subtext }]}>将为刚才试戴的手工甲创建预约。</Text>
            </View>
          ) : null}
          <View style={styles.infoTopRow}>
            {rating ? (
              <View style={styles.ratingWrap}>
                <Ionicons name="star" size={15} color="#ff6b26" />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            ) : null}
            <Text style={[styles.distanceText, { color: colors.subtext }]}>{formatDistance(shop.distance_meters)}</Text>
          </View>
          {isPlatformShop ? (
            <View style={styles.shopCategoryRow}>
              <Text style={styles.shopCategoryTag}>美甲</Text>
              {rating ? <Text style={styles.shopRankTag}>人气好店</Text> : null}
            </View>
          ) : null}
          {priceAndTime ? (
            <Text style={[styles.infoLine, { color: colors.text }]} numberOfLines={2}>
              {priceAndTime}
            </Text>
          ) : null}
          {shop.heat_text ? (
            <Text style={[styles.infoLine, { color: colors.subtext }]} numberOfLines={1}>
              商圈：{shop.heat_text}
            </Text>
          ) : null}
          {shop.phone_text ? (
            <Text style={[styles.infoLine, { color: colors.subtext }]} numberOfLines={1}>
              电话：{shop.phone_text}
            </Text>
          ) : null}
          {isPlatformShop ? (
            <View style={styles.tagRow}>
              {SHOP_TAGS.map((tag) => (
                <Text key={tag} style={[styles.facilityTag, { color: colors.subtext, backgroundColor: colors.surfaceAlt }]}>
                  {tag}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={[styles.addressBox, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="location-outline" size={17} color={colors.accent} />
            <Text style={[styles.addressText, { color: colors.text }]}>{formatLocationLine(shop.region, shop.address)}</Text>
            <Pressable
              style={[styles.navigationShortcut, { backgroundColor: colors.surface }]}
              onPress={handleNavigationShortcut}
            >
              <Ionicons name="navigate-outline" size={15} color={colors.accent} />
              <Text style={[styles.navigationShortcutText, { color: colors.accent }]}>导航</Text>
            </Pressable>
          </View>
        </View>

        {!isPlatformShop ? (
          <View style={[styles.notJoinedCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="information-circle-outline" size={22} color={colors.subtext} />
            <Text style={[styles.notJoinedText, { color: colors.subtext }]}>店铺尚未接入</Text>
          </View>
        ) : (
          <>
            <View style={[styles.sectionTabs, { backgroundColor: colors.surface }]}>
              {SHOP_SECTION_TABS.map((tab, index) => (
                <View key={tab} style={styles.sectionTab}>
                  <Text style={[styles.sectionTabText, { color: index === 0 ? colors.text : colors.subtext }]}>{tab}</Text>
                  {index === 0 ? <View style={[styles.sectionTabUnderline, { backgroundColor: colors.accent }]} /> : null}
                </View>
              ))}
            </View>

            <View style={styles.galleryHeader}>
              <Text style={[styles.galleryTitle, { color: colors.text }]}>热门美甲</Text>
              <Text style={[styles.galleryCopy, { color: colors.subtext }]}>{galleryCopy}</Text>
            </View>

            <View style={styles.galleryGrid}>
              {merchantGalleryItems.map((item) => (
                <View key={item.id} style={styles.galleryItem}>
                  <BrowseFeedCard
                    item={item}
                    onPress={() => navigation.navigate("StylePreview", { styleId: item.id })}
                    onToggleLike={() => toggleLikeMutation.mutate(item)}
                  />
                </View>
              ))}
            </View>

            {galleryQuery.isLoading ? (
              <Text style={[styles.loadingText, { color: colors.subtext }]}>正在加载店铺美甲...</Text>
            ) : null}
            {!galleryQuery.isLoading && merchantGalleryItems.length === 0 ? (
              <Text style={[styles.loadingText, { color: colors.subtext }]}>
                该店暂未上传热门美甲。
              </Text>
            ) : null}

            <View style={styles.galleryHeader}>
              <Text style={[styles.galleryTitle, { color: colors.text }]}>用户评价</Text>
              <Text style={[styles.galleryCopy, { color: colors.subtext }]}>{reviewCopy}</Text>
            </View>

            <View style={styles.reviewList}>
              {featuredReviewItems.map((item) => {
                const imageUri = resolveAssetUrl(item.image_url);
                const avatarUri = resolveAssetUrl(item.author_avatar_url);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.reviewCard, { backgroundColor: colors.surface }]}
                    onPress={() => navigation.navigate("StylePreview", { styleId: item.id })}
                  >
                    <View style={styles.reviewTopRow}>
                      <Image source={avatarUri ? { uri: avatarUri } : fallbackAvatar} style={styles.reviewAvatar} />
                      <View style={styles.reviewAuthorBlock}>
                        <Text style={[styles.reviewAuthor, { color: colors.text }]} numberOfLines={1}>
                          {item.author_name}
                        </Text>
                        <Text style={[styles.reviewDate, { color: colors.subtext }]}>{formatPostDate(item.created_at)}</Text>
                      </View>
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="shield-checkmark" size={13} color={colors.accent} />
                        <Text style={[styles.verifiedBadgeText, { color: colors.accent }]}>真实消费</Text>
                      </View>
                    </View>
                    <View style={styles.reviewBody}>
                      <Image source={{ uri: imageUri }} style={[styles.reviewImage, { backgroundColor: colors.surfaceAlt }]} />
                      <View style={styles.reviewTextBlock}>
                        <Text style={[styles.reviewTitle, { color: colors.text }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        {item.description ? (
                          <Text style={[styles.reviewDescription, { color: colors.subtext }]} numberOfLines={3}>
                            {item.description}
                          </Text>
                        ) : null}
                        <View style={styles.reviewMetaRow}>
                          <Ionicons name="heart" size={14} color={item.is_liked ? "#ff6b8a" : colors.subtext} />
                          <Text style={[styles.reviewMetaText, { color: colors.subtext }]}>{item.like_count}</Text>
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.subtext} />
                          <Text style={[styles.reviewMetaText, { color: colors.subtext }]}>{item.comment_count}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {!galleryQuery.isLoading && reviewItems.length === 0 ? (
              <Text style={[styles.loadingText, { color: colors.subtext }]}>当前店还没有评论</Text>
            ) : null}
          </>
        )}
      </ScrollView>
      {isPlatformShop ? (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable style={styles.bottomMiniAction} onPress={handleAskAI}>
            <Ionicons name="sparkles-outline" size={23} color={colors.accent} />
            <Text style={[styles.bottomMiniText, { color: colors.text }]}>问小嘉</Text>
          </Pressable>
          <Pressable style={styles.bottomMiniAction} onPress={handleCall}>
            <Ionicons name="call-outline" size={23} color={colors.text} />
            <Text style={[styles.bottomMiniText, { color: colors.text }]}>打电话</Text>
          </Pressable>
          <Pressable style={styles.bottomMiniAction} onPress={handleConsult}>
            <Ionicons name="headset-outline" size={23} color={colors.text} />
            <Text style={[styles.bottomMiniText, { color: colors.text }]}>在线咨询</Text>
          </Pressable>
          <Pressable
            style={[styles.bottomBookButton, { backgroundColor: canBookShop ? "#596047" : colors.surfaceAlt }]}
            onPress={openBooking}
          >
            <Text style={[styles.bottomBookText, { color: canBookShop ? "#ffe5df" : colors.subtext }]}>立即预约</Text>
          </Pressable>
        </View>
      ) : null}
      <BookingSheet
        visible={bookingVisible}
        shopId={platformShopId}
        shopName={shop.name}
        shopCity={shop.city}
        styleId={pendingBookingStyleId}
        onClose={() => setBookingVisible(false)}
        onSuccess={() => setPendingBookingStyleId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingBottom: 156,
  },
  contentNoBottomBar: {
    paddingBottom: 42,
  },
  heroWrap: {
    height: 360,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPhotoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  heroPhotoPlaceholderText: {
    fontSize: 15,
    fontWeight: "800",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  header: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSearch: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  heroSearchText: {
    flex: 1,
    color: "rgba(255,255,255,0.94)",
    fontSize: 15,
    fontWeight: "900",
  },
  heroActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  coverTabs: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(16,18,15,0.52)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  coverTab: {
    flex: 1,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  coverTabActive: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  coverTabText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    fontWeight: "900",
  },
  coverTabTextActive: {
    color: "#2b211d",
  },
  navPillText: {
    fontSize: 13,
    fontWeight: "900",
  },
  heroInfo: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 70,
    gap: 8,
  },
  heroInfoCompact: {
    bottom: 24,
  },
  shopName: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
  },
  shopSub: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    fontWeight: "700",
  },
  infoCard: {
    margin: 16,
    marginTop: -12,
    borderRadius: 26,
    padding: 16,
    gap: 10,
  },
  pendingBookingBanner: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pendingBookingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  infoTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shopCategoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shopCategoryTag: {
    overflow: "hidden",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    color: "#ff6b26",
    backgroundColor: "rgba(255,107,38,0.12)",
    fontSize: 12,
    fontWeight: "900",
  },
  shopRankTag: {
    overflow: "hidden",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    color: "#a66b21",
    backgroundColor: "rgba(245,188,77,0.18)",
    fontSize: 12,
    fontWeight: "900",
  },
  ratingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: "#ff6b26",
    fontSize: 16,
    fontWeight: "900",
  },
  distanceText: {
    fontSize: 13,
    fontWeight: "800",
  },
  infoLine: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  facilityTag: {
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "800",
  },
  addressBox: {
    marginTop: 2,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  navigationShortcut: {
    minWidth: 64,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navigationShortcutText: {
    fontSize: 12,
    fontWeight: "900",
  },
  notJoinedCard: {
    marginHorizontal: 16,
    marginTop: 2,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notJoinedText: {
    fontSize: 15,
    fontWeight: "900",
  },
  sectionTabs: {
    marginTop: 2,
    paddingHorizontal: 18,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  sectionTab: {
    height: 42,
    justifyContent: "center",
    gap: 6,
  },
  sectionTabText: {
    fontSize: 18,
    fontWeight: "900",
  },
  sectionTabUnderline: {
    width: 30,
    height: 3,
    borderRadius: 2,
  },
  galleryHeader: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
  },
  galleryTitle: {
    fontSize: 24,
    fontWeight: "900",
  },
  galleryCopy: {
    fontSize: 13,
    lineHeight: 19,
  },
  galleryGrid: {
    paddingHorizontal: 10,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  galleryItem: {
    width: "50%",
  },
  reviewList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  reviewCard: {
    borderRadius: 22,
    padding: 12,
    gap: 12,
  },
  reviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  reviewAuthorBlock: {
    flex: 1,
    gap: 2,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: "900",
  },
  reviewDate: {
    fontSize: 11,
    fontWeight: "700",
  },
  verifiedBadge: {
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,105,75,0.12)",
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  reviewBody: {
    flexDirection: "row",
    gap: 12,
  },
  reviewImage: {
    width: 96,
    height: 112,
    borderRadius: 16,
  },
  reviewTextBlock: {
    flex: 1,
    paddingVertical: 2,
    gap: 7,
  },
  reviewTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
  },
  reviewDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  reviewMetaRow: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  reviewMetaText: {
    marginRight: 8,
    fontSize: 12,
    fontWeight: "800",
  },
  loadingText: {
    paddingVertical: 28,
    textAlign: "center",
    fontSize: 13,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bottomMiniAction: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bottomMiniText: {
    fontSize: 11,
    fontWeight: "800",
  },
  bottomBookButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBookText: {
    fontSize: 18,
    fontWeight: "900",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
  },
});
