import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { OverlayContent } from "../components/OverlayContent";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { bookingStatusLabel, getBookingStatusTone } from "../utils/bookingStatus";
import { useThemeColors } from "../utils/theme";

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
          const statusTone = getBookingStatusTone(item.status, colors);
          return (
            <Pressable
              key={item.id}
              style={[styles.card, { backgroundColor: colors.surface }]}
              onPress={() => {
                if (item.style_id) navigation.navigate("StylePreview", { styleId: item.style_id });
              }}
            >
              {item.style_image_url ? (
                <Image source={{ uri: resolveAssetUrl(item.style_image_url) }} style={[styles.image, { backgroundColor: colors.surfaceAlt }]} />
              ) : (
                <View style={[styles.image, styles.placeholderImage, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="storefront-outline" size={28} color={colors.subtext} />
                </View>
              )}
              <View style={styles.body}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.style_title}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: statusTone.backgroundColor }]}>
                    <Text style={[styles.statusText, { color: statusTone.textColor }]}>{bookingStatusLabel[item.status]}</Text>
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
  placeholderImage: {
    alignItems: "center",
    justifyContent: "center",
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
