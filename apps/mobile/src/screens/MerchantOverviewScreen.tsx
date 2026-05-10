import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { WeeklyHotNailsModal } from "../components/WeeklyHotNailsModal";
import { RequireLogin } from "../components/RequireLogin";
import { Booking } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { getBookingStatusTextColor, merchantBookingStatusLabel } from "../utils/bookingStatus";
import { useThemeColors } from "../utils/theme";

function countByStatus(items: Booking[], statuses: Booking["status"][]) {
  return items.filter((item) => statuses.includes(item.status)).length;
}

function currentLocalDateKey() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function MerchantOverviewScreen({ navigation }: any) {
  const colors = useThemeColors();
  const { token, user } = useAuthStore();
  const [weeklyHotVisible, setWeeklyHotVisible] = useState(false);
  const bookingsQuery = useQuery({
    queryKey: ["merchant-bookings"],
    queryFn: api.getMerchantBookings,
    enabled: Boolean(token && user?.role === "merchant"),
  });
  const shopsQuery = useQuery({
    queryKey: ["merchant-shops"],
    queryFn: api.getMyMerchantShops,
    enabled: Boolean(token && user?.role === "merchant"),
  });
  const hotQuery = useQuery({
    queryKey: ["merchant-overview-hot-style"],
    queryFn: api.getDiscover,
    enabled: Boolean(token && user?.role === "merchant"),
    staleTime: 30000,
  });

  if (!token || user?.role !== "merchant") {
    return <RequireLogin onLogin={() => navigation.navigate("Login")} message="商家账号登录后查看后台" />;
  }

  const bookings = bookingsQuery.data?.items ?? [];
  const activeBookings = bookings.filter((item) => item.status === "pending" || item.status === "accepted");
  const shop = shopsQuery.data?.items[0] ?? null;
  const hotStyle = hotQuery.data?.items[0] ?? null;
  const todayKey = currentLocalDateKey();
  const todayBookings = bookings.filter((item) => item.appointment_time.includes(todayKey) || item.created_at.startsWith(todayKey));
  const stats = [
    { label: "今日预约", value: String(todayBookings.length), icon: "calendar-outline" },
    { label: "待处理", value: String(countByStatus(bookings, ["pending"])), icon: "time-outline" },
    { label: "已完成", value: String(countByStatus(bookings, ["completed"])), icon: "checkmark-circle-outline" },
    { label: "取消/拒绝", value: String(countByStatus(bookings, ["cancelled", "rejected"])), icon: "close-circle-outline" },
  ] as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.kicker, { color: colors.accent }]}>店铺后台</Text>
            <Text style={[styles.title, { color: colors.text }]}>经营概览</Text>
          </View>
          <View style={styles.titleActions}>
            <Pressable style={[styles.trendButton, { backgroundColor: colors.surface }]} onPress={() => setWeeklyHotVisible(true)}>
              <Ionicons name="flame-outline" size={17} color={colors.accent} />
              <Text style={[styles.trendButtonText, { color: colors.accent }]}>本周热门</Text>
            </Pressable>
            <Pressable style={[styles.iconButton, { backgroundColor: colors.surface }]} onPress={() => navigation.navigate("MerchantMarketData")}>
              <Ionicons name="stats-chart-outline" size={20} color={colors.accent} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.shopCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.shopIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="storefront-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.shopBody}>
            <Text style={[styles.shopName, { color: colors.text }]} numberOfLines={1}>
              {shop?.name ?? user.username}
            </Text>
            <Text style={[styles.shopMeta, { color: colors.subtext }]} numberOfLines={1}>
              {shop?.city ?? "城市待完善"} · {shop?.address || "地址待完善"}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {stats.map((item) => (
            <View key={item.label} style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Ionicons name={item.icon} size={19} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.text }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>当前预约</Text>
            <Pressable onPress={() => navigation.navigate("MerchantBookings")}>
              <Text style={[styles.sectionLink, { color: colors.accent }]}>查看全部</Text>
            </Pressable>
          </View>
          {activeBookings.slice(0, 3).map((item) => (
            <Pressable key={item.id} style={[styles.bookingRow, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate("MerchantBookings")}>
              <View style={styles.bookingBody}>
                <Text style={[styles.bookingTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.style_title || "门店预约"}
                </Text>
                <Text style={[styles.bookingMeta, { color: colors.subtext }]} numberOfLines={1}>
                  {item.user_name} · {item.appointment_time}
                </Text>
              </View>
              <Text style={[styles.bookingStatus, { color: getBookingStatusTextColor(item.status, colors) }]}>
                {merchantBookingStatusLabel[item.status]}
              </Text>
            </Pressable>
          ))}
          {!activeBookings.length ? <Text style={[styles.emptyText, { color: colors.subtext }]}>当前没有待处理预约。</Text> : null}
        </View>

        {hotStyle ? (
          <Pressable style={[styles.hotCard, { backgroundColor: colors.surface }]} onPress={() => navigation.navigate("StylePreview", { styleId: hotStyle.id })}>
            <Image source={{ uri: resolveAssetUrl(hotStyle.image_url) }} style={styles.hotImage} />
            <View style={styles.hotBody}>
              <Text style={[styles.sectionLink, { color: colors.accent }]}>热门美甲</Text>
              <Text style={[styles.hotTitle, { color: colors.text }]} numberOfLines={2}>
                {hotStyle.title}
              </Text>
              <Text style={[styles.hotMeta, { color: colors.subtext }]}>
                {hotStyle.like_count} 赞 · {hotStyle.comment_count} 评论
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.quickGrid}>
          <Pressable style={[styles.quickCard, { backgroundColor: colors.surface }]} onPress={() => navigation.navigate("Publish")}>
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
            <Text style={[styles.quickTitle, { color: colors.text }]}>发布新美甲</Text>
          </Pressable>
          <Pressable style={[styles.quickCard, { backgroundColor: colors.surface }]} onPress={() => navigation.navigate("MerchantShop")}>
            <Ionicons name="business-outline" size={22} color={colors.accent} />
            <Text style={[styles.quickTitle, { color: colors.text }]}>店铺资料</Text>
          </Pressable>
          <Pressable style={[styles.quickCard, { backgroundColor: colors.surface }]} onPress={() => navigation.navigate("MerchantOrders")}>
            <Ionicons name="receipt-outline" size={22} color={colors.accent} />
            <Text style={[styles.quickTitle, { color: colors.text }]}>订单管理</Text>
          </Pressable>
          <Pressable style={[styles.quickCard, { backgroundColor: colors.surface }]} onPress={() => navigation.navigate("MerchantMarketData")}>
            <Ionicons name="bar-chart-outline" size={22} color={colors.accent} />
            <Text style={[styles.quickTitle, { color: colors.text }]}>市场数据</Text>
          </Pressable>
        </View>
      </ScrollView>
      <WeeklyHotNailsModal
        enabled={Boolean(token && user?.role === "merchant")}
        merchantUid={user?.uid}
        auto={false}
        visible={weeklyHotVisible}
        onClose={() => setWeeklyHotVisible(false)}
        onStylePress={(styleId) => navigation.navigate("StylePreview", { styleId })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: { fontSize: 13, fontWeight: "900" },
  title: { fontSize: 28, fontWeight: "900", marginTop: 2 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  trendButton: { height: 42, borderRadius: 21, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 5 },
  trendButtonText: { fontSize: 12, fontWeight: "900" },
  shopCard: { borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  shopIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  shopBody: { flex: 1, gap: 5 },
  shopName: { fontSize: 18, fontWeight: "900" },
  shopMeta: { fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48.5%", borderRadius: 22, padding: 15, gap: 8 },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 12, fontWeight: "700" },
  sectionCard: { borderRadius: 24, padding: 16, gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "900" },
  sectionLink: { fontSize: 13, fontWeight: "900" },
  bookingRow: { minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 },
  bookingBody: { flex: 1, gap: 4 },
  bookingTitle: { fontSize: 15, fontWeight: "900" },
  bookingMeta: { fontSize: 12 },
  bookingStatus: { fontSize: 12, fontWeight: "900" },
  emptyText: { fontSize: 13, lineHeight: 18 },
  hotCard: { borderRadius: 24, padding: 12, flexDirection: "row", gap: 12 },
  hotImage: { width: 108, height: 108, borderRadius: 18 },
  hotBody: { flex: 1, justifyContent: "center", gap: 7 },
  hotTitle: { fontSize: 17, lineHeight: 22, fontWeight: "900" },
  hotMeta: { fontSize: 12 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: { width: "48.5%", borderRadius: 20, padding: 16, gap: 10 },
  quickTitle: { fontSize: 14, fontWeight: "900" },
});
