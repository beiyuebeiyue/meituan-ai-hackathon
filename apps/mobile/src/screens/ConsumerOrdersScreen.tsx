import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { DrawerModuleCard, DrawerModuleInfoBanner, DrawerModulePill, DrawerModuleThumbnail } from "../components/DrawerModuleLayout";
import { OverlayContent } from "../components/OverlayContent";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { bookingStatusLabel } from "../utils/bookingStatus";
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

function getBookingPillTone(status: string) {
  if (status === "completed" || status === "accepted") return "success";
  if (status === "rejected" || status === "cancelled") return "danger";
  if (status === "pending") return "accent";
  return "muted";
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
      <DrawerModuleInfoBanner icon="receipt-outline" title="预约订单" description="当前订单为预约意向单，后续可扩展支付和核销信息。" />

      {query.data?.items.length ? (
        query.data.items.map((item) => {
          return (
            <DrawerModuleCard
              key={item.id}
              onPress={item.style_id ? () => navigation.navigate("StylePreview", { styleId: item.style_id }) : undefined}
            >
              <DrawerModuleThumbnail uri={item.style_image_url ? resolveAssetUrl(item.style_image_url) : null} icon="storefront-outline" size="medium" />
              <View style={styles.body}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.style_title}
                  </Text>
                  <DrawerModulePill label={bookingStatusLabel[item.status]} tone={getBookingPillTone(item.status)} />
                </View>
                <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
                  门店：{item.shop_name} · {item.shop_city}
                </Text>
                <Text style={[styles.meta, { color: colors.subtext }]}>预约：{item.appointment_time}</Text>
                <Text style={[styles.meta, { color: colors.subtext }]}>电话：{item.contact_phone}</Text>
                <Text style={[styles.createdAt, { color: colors.subtext }]}>下单于 {formatCreatedAt(item.created_at)}</Text>
              </View>
            </DrawerModuleCard>
          );
        })
      ) : (
        <OverlayContent.Empty icon="receipt-outline" title="还没有订单" description="焕甲成功后，可以继续预约门店。" />
      )}
    </OverlayContent.Scroll>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "900" },
  meta: { fontSize: 12, lineHeight: 17 },
  createdAt: { fontSize: 11, marginTop: 2 },
});
