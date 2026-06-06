import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { TrendNailStyle } from "../types/api";
import { useThemeColors } from "../utils/theme";

type ClaimPayload = {
  styleId: string;
  campaignId?: string | null;
  claimed: boolean;
};

export function MerchantTrendNotificationsScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["merchant-trend-notifications"],
    queryFn: api.getMerchantTrendNotifications,
  });

  const claimMutation = useMutation({
    mutationFn: ({ styleId, campaignId, claimed }: ClaimPayload) =>
      claimed
        ? api.deleteMerchantTrendClaim(styleId)
        : api.claimMerchantTrend(styleId, campaignId).then(() => undefined),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["merchant-trend-notifications"],
        }),
        queryClient.invalidateQueries({ queryKey: ["market-shops"] }),
      ]);
    },
    onError: (error: Error) => {
      let detail = error.message;
      try {
        const parsed = JSON.parse(error.message) as { detail?: string };
        detail = parsed.detail ?? detail;
      } catch {
        // keep original text
      }
      Alert.alert("操作失败", detail);
    },
  });

  const renderStyle = (item: TrendNailStyle, campaignId?: string | null) => {
    const busy = claimMutation.isPending;
    return (
      <View
        key={item.id}
        style={[
          styles.styleCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Image
          source={{ uri: resolveAssetUrl(item.image_url) }}
          style={[styles.styleImage, { backgroundColor: colors.surfaceAlt }]}
        />
        <View style={styles.styleBody}>
          <Text
            style={[styles.styleTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text
            style={[styles.styleMeta, { color: colors.subtext }]}
            numberOfLines={1}
          >
            {item.tags.slice(0, 3).join(" · ") || "手工甲"} · {item.like_count}{" "}
            赞 · {item.claim_count} 家已登记
          </Text>
          <Pressable
            disabled={busy}
            style={[
              styles.claimButton,
              {
                backgroundColor: item.can_do_style
                  ? colors.surfaceAlt
                  : colors.text,
                opacity: busy ? 0.55 : 1,
              },
            ]}
            onPress={() =>
              claimMutation.mutate({
                styleId: item.id,
                campaignId,
                claimed: item.can_do_style,
              })
            }
          >
            <Ionicons
              name={item.can_do_style ? "checkmark-circle" : "hammer-outline"}
              size={16}
              color={item.can_do_style ? colors.accent : colors.background}
            />
            <Text
              style={[
                styles.claimButtonText,
                {
                  color: item.can_do_style ? colors.accent : colors.background,
                },
              ]}
            >
              {item.can_do_style ? "已登记可做" : "我也能做"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const items = query.data?.items ?? [];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>运营推送</Text>
          <Text style={[styles.subtitle, { color: colors.subtext }]}>
            选择你也能做的手工甲。用户焕甲后选店时，已登记门店会优先展示。
          </Text>
        </View>
        {query.isLoading ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            正在加载推送...
          </Text>
        ) : null}
        {!query.isLoading && items.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            暂无运营推送。
          </Text>
        ) : null}
        {items.map((notification) => (
          <View key={notification.id} style={styles.notificationBlock}>
            <View style={styles.notificationTitleRow}>
              <View
                style={[
                  styles.noticeIcon,
                  { backgroundColor: colors.accentSoft },
                ]}
              >
                <Ionicons
                  name="flame-outline"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <View style={styles.noticeTextBlock}>
                <Text style={[styles.noticeTitle, { color: colors.text }]}>
                  {notification.title}
                </Text>
                {notification.body ? (
                  <Text
                    style={[styles.noticeBody, { color: colors.subtext }]}
                    numberOfLines={2}
                  >
                    {notification.body}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.styleList}>
              {notification.styles.map((style) =>
                renderStyle(style, notification.campaign_id),
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 18,
  },
  headerCopy: {
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  emptyText: {
    paddingTop: 36,
    textAlign: "center",
    fontSize: 14,
  },
  notificationBlock: {
    gap: 12,
  },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noticeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeTextBlock: {
    flex: 1,
    gap: 3,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  styleList: {
    gap: 10,
  },
  styleCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    flexDirection: "row",
    gap: 12,
  },
  styleImage: {
    width: 86,
    height: 104,
    borderRadius: 14,
  },
  styleBody: {
    flex: 1,
    paddingVertical: 2,
    gap: 8,
  },
  styleTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  styleMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  claimButton: {
    marginTop: "auto",
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  claimButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
});
