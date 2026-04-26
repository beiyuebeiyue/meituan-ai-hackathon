import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { Alert, Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthorProfileScreen } from "./AuthorProfileScreen";
import { api, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { Booking } from "../types/api";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");

const sloganHighlights = [
  { icon: "color-palette-outline", text: "千款美甲，随心挑选" },
  { icon: "sparkles-outline", text: "AI焕甲，随意试戴" },
  { icon: "share-social-outline", text: "心仪美甲，随手分享" },
] as const;

const bookingStatusLabel: Record<Booking["status"], string> = {
  pending: "待处理",
  accepted: "已接受",
  rejected: "已拒绝",
  completed: "已完成",
  cancelled: "已取消",
};

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { token, user } = useAuthStore();
  const setUser = useAuthStore((state) => state.setUser);
  const colors = useThemeColors();

  const meQuery = useQuery({
    queryKey: ["me", token],
    queryFn: api.getMe,
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  const displayUser = meQuery.data ?? user;

  if (token && displayUser?.id) {
    if (displayUser.role !== "merchant") {
      return <ConsumerProfileScreen />;
    }
    return <AuthorProfileScreen authorId={displayUser.id} asProfileTab />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <ScrollView contentContainerStyle={styles.loggedOutContent} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.loggedOutHero} onPress={() => navigation.navigate("Login")}>
          <View style={styles.loggedOutHeroLeft}>
            <Image source={defaultAvatar} style={[styles.loggedOutAvatar, { backgroundColor: colors.surface }]} />
            <View style={styles.loggedOutHeroText}>
              <Text style={[styles.loggedOutTitle, { color: colors.text }]}>点击登录</Text>
            </View>
          </View>
          <View style={styles.loggedOutHeroRight}>
            <View style={styles.loggedOutActions}>
              <Pressable
                style={styles.loggedOutAction}
                onPress={() => Alert.alert("帮助与客服", "在线客服功能演示中，后续会接入真实客服。")}
              >
                <View style={[styles.loggedOutActionIcon, { backgroundColor: colors.surface }]}>
                  <Ionicons name="headset-outline" size={18} color={colors.subtext} />
                </View>
                <Text style={[styles.loggedOutActionText, { color: colors.subtext }]}>客服</Text>
              </Pressable>
              <Pressable style={styles.loggedOutAction} onPress={() => navigation.navigate("ProfileSettings")}>
                <View style={[styles.loggedOutActionIcon, { backgroundColor: colors.surface }]}>
                  <Ionicons name="settings-outline" size={18} color={colors.subtext} />
                </View>
                <Text style={[styles.loggedOutActionText, { color: colors.subtext }]}>设置</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>

        <View style={[styles.sloganCard, { backgroundColor: colors.surface }]}>
          <Text
            style={[styles.sloganText, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            AI焕甲，即刻上手
          </Text>
          <View style={styles.sloganList}>
            {sloganHighlights.map((item) => (
              <View key={item.text} style={styles.sloganItem}>
                <View style={[styles.sloganIconWrap, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name={item.icon} size={18} color={colors.accent} />
                </View>
                <Text style={[styles.sloganItemText, { color: colors.subtext }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConsumerProfileScreen() {
  const navigation = useNavigation<any>();
  const colors = useThemeColors();
  const user = useAuthStore((state) => state.user);
  const bookingsQuery = useQuery({
    queryKey: ["my-bookings"],
    queryFn: api.getMyBookings,
  });

  const menuItems = [
    { key: "bookings", icon: "receipt-outline", title: "我的订单", subtitle: "查看预约与历史订单" },
    { key: "browse-history", icon: "time-outline", title: "浏览记录", subtitle: "最近看过的美甲" },
    { key: "likes", icon: "heart-outline", title: "喜爱", subtitle: "查看赞过的美甲" },
    { key: "tryon", icon: "sparkles-outline", title: "AI 焕甲记录", subtitle: "查看试戴结果" },
    { key: "hands", icon: "hand-left-outline", title: "手图管理", subtitle: "管理已上传手图" },
  ] as const;

  const openItem = (key: (typeof menuItems)[number]["key"]) => {
    if (key === "bookings") navigation.navigate("ConsumerOrders");
    if (key === "browse-history") navigation.navigate("BrowseHistory");
    if (key === "likes") navigation.navigate("ConsumerLikes");
    if (key === "tryon") navigation.navigate("TryOnHistory");
    if (key === "hands") navigation.navigate("HandPhotoManagement");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.consumerContent}>
        <View style={[styles.consumerHero, { backgroundColor: colors.surface }]}>
          <Image source={user?.avatar_url ? { uri: resolveAssetUrl(user.avatar_url) } : defaultAvatar} style={[styles.consumerAvatar, { backgroundColor: colors.surfaceAlt }]} />
          <View style={styles.consumerHeroText}>
            <Text style={[styles.consumerName, { color: colors.text }]}>{user?.username ?? "焕甲用户"}</Text>
            <Text style={[styles.consumerMeta, { color: colors.subtext }]}>焕甲号：{user?.uid ?? "--"}</Text>
            <Text style={[styles.consumerMeta, { color: colors.subtext }]}>用户端 · 浏览、试戴、预约门店</Text>
          </View>
          <Pressable
            style={[styles.consumerSettingsButton, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => navigation.navigate("ProfileSettings")}
          >
            <Ionicons name="settings-outline" size={20} color={colors.accent} />
          </Pressable>
        </View>

        <View style={[styles.consumerCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.consumerSectionTitle, { color: colors.text }]}>预约订单</Text>
          {bookingsQuery.data?.items.slice(0, 3).map((item) => (
            <Pressable key={item.id} style={[styles.bookingRow, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate("StylePreview", { styleId: item.style_id })}>
              <View style={styles.bookingText}>
                <Text style={[styles.bookingTitle, { color: colors.text }]} numberOfLines={1}>{item.style_title}</Text>
                <Text style={[styles.bookingMeta, { color: colors.subtext }]}>{item.shop_name} · {item.appointment_time}</Text>
              </View>
              <Text style={[styles.bookingStatus, { color: colors.accent }]}>{bookingStatusLabel[item.status]}</Text>
            </Pressable>
          ))}
          {!bookingsQuery.data?.items.length ? <Text style={[styles.emptyBooking, { color: colors.subtext }]}>还没有预约，看到喜欢的美甲可以直接下单预约。</Text> : null}
        </View>

        <View style={styles.consumerGrid}>
          {menuItems.map((item) => (
            <Pressable key={item.key} style={[styles.consumerMenuCard, { backgroundColor: colors.surface }]} onPress={() => openItem(item.key)}>
              <Ionicons name={item.icon} size={22} color={colors.accent} />
              <Text style={[styles.consumerMenuTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.consumerMenuSubtitle, { color: colors.subtext }]} numberOfLines={1}>{item.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loggedOutContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 120, gap: 14 },
  loggedOutHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  loggedOutHeroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    flex: 1,
  },
  loggedOutAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  loggedOutHeroText: {
    flex: 1,
    gap: 6,
  },
  loggedOutTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  loggedOutHeroRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 48,
  },
  loggedOutActions: {
    flexDirection: "row",
    gap: 12,
  },
  loggedOutAction: {
    alignItems: "center",
    gap: 8,
  },
  loggedOutActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loggedOutActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sloganCard: {
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 18,
    minHeight: 220,
    justifyContent: "center",
  },
  sloganText: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Songti SC",
      android: "serif",
      default: undefined,
    }),
    letterSpacing: 0.8,
  },
  sloganList: {
    flexDirection: "row",
    gap: 10,
  },
  sloganItem: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  sloganIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  sloganItemText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  consumerContent: { padding: 16, paddingBottom: 120, gap: 14 },
  consumerHero: { borderRadius: 24, padding: 18, flexDirection: "row", gap: 14, alignItems: "center" },
  consumerAvatar: { width: 72, height: 72, borderRadius: 36 },
  consumerHeroText: { flex: 1, gap: 5 },
  consumerSettingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  consumerName: { fontSize: 24, fontWeight: "900" },
  consumerMeta: { fontSize: 13, lineHeight: 18 },
  consumerCard: { borderRadius: 22, padding: 16, gap: 10 },
  consumerSectionTitle: { fontSize: 18, fontWeight: "900" },
  bookingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  bookingText: { flex: 1, gap: 4 },
  bookingTitle: { fontSize: 15, fontWeight: "800" },
  bookingMeta: { fontSize: 12 },
  bookingStatus: { fontSize: 12, fontWeight: "800" },
  emptyBooking: { fontSize: 13, lineHeight: 20 },
  consumerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  consumerMenuCard: { width: "48%", borderRadius: 20, padding: 16, gap: 8 },
  consumerMenuTitle: { fontSize: 16, fontWeight: "800" },
  consumerMenuSubtitle: { fontSize: 12 },
});
