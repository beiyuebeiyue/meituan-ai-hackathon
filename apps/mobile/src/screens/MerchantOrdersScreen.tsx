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

const statusTone: Record<Booking["status"], "accent" | "muted"> = {
  pending: "accent",
  accepted: "accent",
  completed: "accent",
  rejected: "muted",
  cancelled: "muted",
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

export function MerchantOrdersScreen({ navigation }: any) {
  const colors = useThemeColors();
  const { token, user } = useAuthStore();
  const query = useQuery({
    queryKey: ["merchant-bookings"],
    queryFn: api.getMerchantBookings,
    enabled: Boolean(token && user?.role === "merchant"),
  });

  if (!token || user?.role !== "merchant") {
    return <RequireLogin onLogin={() => navigation.navigate("Login")} message="商家账号登录后查看订单" />;
  }

  const items = [...(query.data?.items ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <OverlayContent.Scroll>
      <Text style={[styles.subtitle, { color: colors.subtext }]}>当前订单为预约意向单记录，后续可扩展支付、核销和退款状态。</Text>

      {items.length ? (
        items.map((item) => {
          const tone = statusTone[item.status];
          return (
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
                  <View style={[styles.statusPill, { backgroundColor: tone === "accent" ? colors.accentSoft : colors.surfaceAlt }]}>
                    <Text style={[styles.statusText, { color: tone === "accent" ? colors.accent : colors.subtext }]}>
                      {statusLabel[item.status]}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
                  客户：{item.user_name} · {item.contact_phone}
                </Text>
                <Text style={[styles.meta, { color: colors.subtext }]}>预约：{item.appointment_time}</Text>
                <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
                  门店：{item.shop_name}
                </Text>
                <Text style={[styles.createdAt, { color: colors.subtext }]}>创建于 {formatCreatedAt(item.created_at)}</Text>
              </View>
            </Pressable>
          );
        })
      ) : (
        <OverlayContent.Empty icon="receipt-outline" title="还没有订单" description="用户预约美甲后，会在这里形成订单记录。" />
      )}
    </OverlayContent.Scroll>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 22,
    padding: 12,
    flexDirection: "row",
    gap: 12,
  },
  image: {
    width: 94,
    height: 94,
    borderRadius: 16,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
  },
  createdAt: {
    fontSize: 11,
    marginTop: 2,
  },
});
