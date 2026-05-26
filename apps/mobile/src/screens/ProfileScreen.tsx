import { Ionicons } from "@expo/vector-icons";
import { useIsFetching, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Alert, Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthorProfileScreen } from "./AuthorProfileScreen";
import { api, resolveAssetUrl } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { bookingStatusLabel, getBookingStatusTextColor } from "../utils/bookingStatus";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");
const loginLogo = require("../../assets/login/logo.png");
const DEMO_CONSUMER_PHONE = "13886722665";
const DEMO_PASSWORD = "admin@123456";

const sloganHighlights = [
  { icon: "color-palette-outline", text: "千款美甲，随心挑选" },
  { icon: "sparkles-outline", text: "AI焕甲，随意试戴" },
  { icon: "share-social-outline", text: "心仪美甲，随手分享" },
] as const;

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { token, user, hydrated } = useAuthStore();
  const setSession = useAuthStore((state) => state.setSession);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const [agreed, setAgreed] = useState(true);
  const isMeValidating = useIsFetching({ queryKey: ["me", token] }) > 0;
  const quickLoginMutation = useMutation({
    mutationFn: () => {
      if (!agreed) {
        throw new Error("请先阅读并同意用户协议与隐私政策");
      }
      return api.login({ phone: DEMO_CONSUMER_PHONE, password: DEMO_PASSWORD, requested_role: "consumer" });
    },
    onSuccess: async (response) => {
      await setSession(response.access_token, response.user);
      queryClient.setQueryData(["me", response.access_token], response.user);
    },
    onError: (error) => {
      Alert.alert("登录失败", error instanceof Error ? error.message : "请稍后重试");
    },
  });

  if (!hydrated || (token && isMeValidating)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.emptyBooking, { color: colors.subtext }]}>正在校验登录状态...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (token && user?.id) {
    return <AuthorProfileScreen authorId={user.id} asProfileTab />;
  }

  if (token) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.emptyBooking, { color: colors.subtext }]}>正在加载我的主页...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const loggedOutBackground = isDark ? colors.background : "#ffffff";
  const primaryRed = isDark ? colors.accent : "#ef3d4f";
  const mutedButton = isDark ? colors.input : "#f5f5f5";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: loggedOutBackground }]}>
      <View style={styles.quickLoginContent}>
        <View style={styles.quickLoginTopBar}>
          <View />
          <Pressable onPress={() => Alert.alert("帮助与客服", "在线客服功能演示中，后续会接入真实客服。")} hitSlop={10}>
            <Text style={[styles.quickHelpText, { color: isDark ? colors.subtext : "#8f8f8f" }]}>帮助</Text>
          </Pressable>
        </View>

        <View style={styles.quickLoginBrand}>
          <Image source={loginLogo} style={styles.quickBrandLogo} resizeMode="contain" />
          <Text style={[styles.quickBrandSubtitle, { color: colors.text }]}>登录后展示自己</Text>
        </View>

        <View style={styles.quickLoginBottom}>
          <Text style={[styles.maskedPhone, { color: colors.text }]}>+86 138 **** 2665</Text>
          <Pressable
            style={[styles.quickPrimaryButton, { backgroundColor: primaryRed, opacity: quickLoginMutation.isPending ? 0.72 : 1 }]}
            disabled={quickLoginMutation.isPending}
            onPress={() => quickLoginMutation.mutate()}
          >
            <Text style={styles.quickPrimaryLabel}>{quickLoginMutation.isPending ? "登录中..." : "一键登录"}</Text>
          </Pressable>

          <Pressable
            style={[styles.otherLoginButton, { backgroundColor: mutedButton }]}
            onPress={() => navigation.navigate("Login", { entryEdge: "right" })}
          >
            <Text style={[styles.otherLoginText, { color: isDark ? colors.text : "#3b6f9f" }]}>其他登录方式</Text>
            <Ionicons name="chevron-forward" size={16} color={isDark ? colors.subtext : "#b7c2cc"} />
          </Pressable>

          <Pressable style={styles.quickAgreementRow} onPress={() => setAgreed((value) => !value)}>
            <Ionicons
              name={agreed ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={agreed ? primaryRed : isDark ? colors.subtext : "#9a9a9a"}
            />
            <Text style={[styles.quickAgreementText, { color: isDark ? colors.subtext : "#a4a4a4" }]}>
              我已阅读并同意 <Text style={[styles.quickAgreementLink, { color: isDark ? "#7ab5ff" : "#9eb2c0" }]}>《用户协议》</Text>{" "}
              <Text style={[styles.quickAgreementLink, { color: isDark ? "#7ab5ff" : "#9eb2c0" }]}>《隐私政策》</Text>{" "}
              <Text style={[styles.quickAgreementLink, { color: isDark ? "#7ab5ff" : "#9eb2c0" }]}>《未成年人个人信息保护规则》</Text>
            </Text>
          </Pressable>
        </View>
      </View>
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
    { key: "following", icon: "storefront-outline", title: "我的关注", subtitle: "管理关注的商家" },
    { key: "likes", icon: "heart-outline", title: "喜爱", subtitle: "查看赞过的美甲" },
    { key: "tryon", icon: "sparkles-outline", title: "AI 焕甲记录", subtitle: "查看试戴结果" },
    { key: "hands", icon: "hand-left-outline", title: "手图管理", subtitle: "管理本地手图" },
  ] as const;

  const openItem = (key: (typeof menuItems)[number]["key"]) => {
    if (key === "bookings") navigation.navigate("ConsumerOrders");
    if (key === "browse-history") navigation.navigate("BrowseHistory");
    if (key === "following" && user?.id) navigation.navigate("FollowList", { authorId: user.id, kind: "following", title: "我的关注" });
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
            <Pressable
              key={item.id}
              style={[styles.bookingRow, { borderBottomColor: colors.border }]}
              onPress={() => {
                if (item.style_id) navigation.navigate("StylePreview", { styleId: item.style_id });
              }}
            >
              <View style={styles.bookingText}>
                <Text style={[styles.bookingTitle, { color: colors.text }]} numberOfLines={1}>{item.style_title}</Text>
                <Text style={[styles.bookingMeta, { color: colors.subtext }]}>{item.shop_name} · {item.appointment_time}</Text>
              </View>
              <Text style={[styles.bookingStatus, { color: getBookingStatusTextColor(item.status, colors) }]}>
                {bookingStatusLabel[item.status]}
              </Text>
            </Pressable>
          ))}
          {!bookingsQuery.data?.items.length ? <Text style={[styles.emptyBooking, { color: colors.subtext }]}>还没有预约，焕甲成功后可以继续预约门店。</Text> : null}
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
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  profileErrorActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  profileErrorButton: {
    borderRadius: 999,
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: "center",
  },
  profileErrorButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  profileErrorPrimaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  quickLoginContent: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 18,
    paddingBottom: 24,
  },
  quickLoginTopBar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickHelpText: {
    fontSize: 18,
    fontWeight: "500",
  },
  quickLoginBrand: {
    alignItems: "center",
    marginTop: 104,
  },
  quickBrandLogo: {
    width: 210,
    height: 94,
  },
  quickBrandSubtitle: {
    marginTop: 12,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "500",
  },
  quickLoginBottom: {
    marginTop: "auto",
    paddingBottom: 18,
    alignItems: "center",
  },
  maskedPhone: {
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "400",
    textAlign: "center",
  },
  quickPrimaryButton: {
    marginTop: 34,
    width: "100%",
    minHeight: 66,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  quickPrimaryLabel: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "700",
  },
  otherLoginButton: {
    marginTop: 20,
    minHeight: 58,
    minWidth: 186,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  otherLoginText: {
    fontSize: 16,
    fontWeight: "700",
  },
  quickAgreementRow: {
    marginTop: 26,
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  quickAgreementText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  quickAgreementLink: {},
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
