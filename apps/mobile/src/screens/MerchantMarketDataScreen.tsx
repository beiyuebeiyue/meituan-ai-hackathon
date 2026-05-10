import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { OverlayContent } from "../components/OverlayContent";
import { RequireLogin } from "../components/RequireLogin";
import { Booking } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

const statusLabel: Record<Booking["status"], string> = {
  pending: "待处理",
  accepted: "已接受",
  rejected: "已拒绝",
  completed: "已完成",
  cancelled: "已取消",
};

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export function MerchantMarketDataScreen({ navigation }: any) {
  const colors = useThemeColors();
  const { token, user } = useAuthStore();
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

  if (!token || user?.role !== "merchant") {
    return <RequireLogin onLogin={() => navigation.navigate("Login")} message="商家账号登录后查看市场数据" />;
  }

  const bookings = bookingsQuery.data?.items ?? [];
  const shop = shopsQuery.data?.items[0] ?? null;
  const pendingCount = bookings.filter((item) => item.status === "pending").length;
  const acceptedCount = bookings.filter((item) => item.status === "accepted").length;
  const completedCount = bookings.filter((item) => item.status === "completed").length;
  const closedCount = bookings.filter((item) => item.status === "rejected" || item.status === "cancelled").length;
  const conversionRate = bookings.length ? completedCount / bookings.length : 0;

  const statCards = [
    { label: "预约总数", value: String(bookings.length), icon: "calendar-outline" },
    { label: "待处理", value: String(pendingCount), icon: "time-outline" },
    { label: "已接受", value: String(acceptedCount), icon: "checkmark-circle-outline" },
    { label: "完成率", value: formatRate(conversionRate), icon: "trending-up-outline" },
  ] as const;

  const statusRows = (Object.keys(statusLabel) as Booking["status"][]).map((status) => ({
    status,
    label: statusLabel[status],
    count: bookings.filter((item) => item.status === status).length,
  }));

  return (
    <OverlayContent.Scroll>
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
        {statCards.map((item) => (
          <View key={item.label} style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Ionicons name={item.icon} size={20} color={colors.accent} />
            <Text style={[styles.statValue, { color: colors.text }]}>{item.value}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>预约状态分布</Text>
        {statusRows.map((item) => (
          <View key={item.status} style={[styles.statusRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.statusLabel, { color: colors.text }]}>{item.label}</Text>
            <Text style={[styles.statusCount, { color: colors.subtext }]}>{item.count}</Text>
          </View>
        ))}
      </View>

      <Pressable style={[styles.linkCard, { backgroundColor: colors.surface }]} onPress={() => navigation.navigate("MerchantOrders")}>
        <View>
          <Text style={[styles.linkTitle, { color: colors.text }]}>查看订单明细</Text>
          <Text style={[styles.linkSubtitle, { color: colors.subtext }]}>
            {pendingCount ? `${pendingCount} 个预约等待处理` : closedCount ? "查看历史预约状态" : "暂无待处理预约"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
      </Pressable>
    </OverlayContent.Scroll>
  );
}

const styles = StyleSheet.create({
  shopCard: {
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shopIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  shopBody: {
    flex: 1,
    gap: 5,
  },
  shopName: {
    fontSize: 18,
    fontWeight: "900",
  },
  shopMeta: {
    fontSize: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48.5%",
    borderRadius: 22,
    padding: 15,
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: 24,
    padding: 16,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },
  statusRow: {
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  statusCount: {
    fontSize: 14,
    fontWeight: "800",
  },
  linkCard: {
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  linkSubtitle: {
    marginTop: 5,
    fontSize: 12,
  },
});
