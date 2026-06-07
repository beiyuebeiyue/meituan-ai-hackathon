import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { RequireLogin } from "../components/RequireLogin";
import { Booking } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import {
  bookingStatusLabel,
  getBookingStatusTextColor,
} from "../utils/bookingStatus";
import { useThemeColors } from "../utils/theme";

export function MerchantBookingsScreen({ navigation }: any) {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { token, user } = useAuthStore();
  const query = useQuery({
    queryKey: ["merchant-bookings"],
    queryFn: api.getMerchantBookings,
    enabled: Boolean(token && user?.role === "merchant"),
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking["status"] }) =>
      api.updateMerchantBookingStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["merchant-bookings"] });
      const previous = queryClient.getQueryData<{ items: Booking[] }>([
        "merchant-bookings",
      ]);
      queryClient.setQueryData<{ items: Booking[] }>(
        ["merchant-bookings"],
        (current) =>
          current
            ? {
                items: current.items.map((item) =>
                  item.id === id ? { ...item, status } : item
                ),
              }
            : current
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["merchant-bookings"], context.previous);
      }
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ["merchant-bookings"] }),
  });

  if (!token || user?.role !== "merchant") {
    return (
      <RequireLogin
        onLogin={() => navigation.navigate("Login")}
        message="商家账号登录后查看预约"
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>预约</Text>
        {query.data?.items.length ? (
          query.data.items.map((item) => (
            <View
              key={item.id}
              style={[styles.card, { backgroundColor: colors.surface }]}
            >
              {item.style_image_url ? (
                <Image
                  source={{ uri: resolveAssetUrl(item.style_image_url) }}
                  style={[styles.image, { backgroundColor: colors.surfaceAlt }]}
                />
              ) : (
                <View
                  style={[
                    styles.image,
                    styles.placeholderImage,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Ionicons
                    name="storefront-outline"
                    size={26}
                    color={colors.subtext}
                  />
                </View>
              )}
              <View style={styles.body}>
                <View style={styles.rowBetween}>
                  <Text
                    style={[styles.cardTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.style_title}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      { color: getBookingStatusTextColor(item.status, colors) },
                    ]}
                  >
                    {bookingStatusLabel[item.status]}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: colors.subtext }]}>
                  用户：{item.user_name} · {item.contact_phone}
                </Text>
                <Text style={[styles.meta, { color: colors.subtext }]}>
                  时间：{item.appointment_time}
                </Text>
                <Text style={[styles.meta, { color: colors.subtext }]}>
                  门店：{item.shop_name}
                </Text>
                {item.status === "pending" ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={mutation.isPending}
                      style={[
                        styles.actionButton,
                        { backgroundColor: colors.accentSoft },
                        mutation.isPending && styles.disabledButton,
                      ]}
                      onPress={() =>
                        mutation.mutate({ id: item.id, status: "accepted" })
                      }
                    >
                      <Text
                        style={[styles.actionText, { color: colors.accent }]}
                      >
                        接受
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={mutation.isPending}
                      style={[
                        styles.actionButton,
                        { backgroundColor: colors.surfaceAlt },
                        mutation.isPending && styles.disabledButton,
                      ]}
                      onPress={() =>
                        mutation.mutate({ id: item.id, status: "rejected" })
                      }
                    >
                      <Text
                        style={[styles.actionText, { color: colors.subtext }]}
                      >
                        拒绝
                      </Text>
                    </Pressable>
                  </View>
                ) : item.status === "accepted" ? (
                  <Pressable
                    disabled={mutation.isPending}
                    style={[
                      styles.completeButton,
                      { backgroundColor: colors.accent },
                      mutation.isPending && styles.disabledButton,
                    ]}
                    onPress={() =>
                      mutation.mutate({ id: item.id, status: "completed" })
                    }
                  >
                    <Text style={styles.completeText}>标记完成</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.surface }]}>
            <Ionicons
              name="calendar-outline"
              size={30}
              color={colors.subtext}
            />
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              暂时还没有预约意向单
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  title: { fontSize: 28, fontWeight: "900" },
  card: { borderRadius: 20, padding: 12, flexDirection: "row", gap: 12 },
  image: { width: 86, height: 86, borderRadius: 14 },
  placeholderImage: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 6 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "800" },
  status: { fontSize: 12, fontWeight: "800" },
  meta: { fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  actionText: { fontWeight: "800" },
  disabledButton: { opacity: 0.55 },
  completeButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  completeText: { color: "#fff", fontWeight: "800" },
  empty: { borderRadius: 22, padding: 28, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14 },
});
