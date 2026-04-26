import { useQuery } from "@tanstack/react-query";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
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

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((todayStart - dateStart) / 86400000);
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (diffDays <= 0) return `今天 ${time}`;
  if (diffDays === 1) return `昨天 ${time}`;
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${time}`;
}

export function ConsumerOrdersScreen({ navigation }: any) {
  const colors = useThemeColors();
  const token = useAuthStore((state) => state.token);
  const query = useQuery({
    queryKey: ["my-bookings"],
    queryFn: api.getMyBookings,
    enabled: Boolean(token),
  });

  if (!token) {
    return <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后查看你的订单" />;
  }

  return (
    <OverlayContent.Scroll>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>当前订单为预约意向单，后续可扩展支付和核销信息。</Text>

      {query.data?.items.length ? (
        query.data.items.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate("StylePreview", { styleId: item.style_id })}
          >
            <Image source={{ uri: resolveAssetUrl(item.style_image_url) }} style={[styles.image, { backgroundColor: colors.surfaceAlt }]} />
            <View style={styles.body}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.style_title}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.statusText, { color: colors.accent }]}>{statusLabel[item.status]}</Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
                门店：{item.shop_name} · {item.shop_city}
              </Text>
              <Text style={[styles.meta, { color: colors.subtext }]}>预约：{item.appointment_time}</Text>
              <Text style={[styles.meta, { color: colors.subtext }]}>电话：{item.contact_phone}</Text>
              <Text style={[styles.createdAt, { color: colors.subtext }]}>下单于 {formatCreatedAt(item.created_at)}</Text>
            </View>
          </Pressable>
        ))
      ) : (
        <OverlayContent.Empty icon="receipt-outline" title="还没有订单" description="看到喜欢的美甲后，可以在详情页预约下单。" />
      )}
    </OverlayContent.Scroll>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 22, padding: 12, flexDirection: "row", gap: 12 },
  image: { width: 94, height: 94, borderRadius: 16 },
  body: { flex: 1, gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "900" },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "900" },
  meta: { fontSize: 12, lineHeight: 17 },
  createdAt: { fontSize: 11, marginTop: 2 },
});
