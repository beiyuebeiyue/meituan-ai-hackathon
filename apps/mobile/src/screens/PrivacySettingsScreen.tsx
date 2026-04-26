import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { UserPrivacy } from "../types/api";
import { useThemeColors } from "../utils/theme";

const privacyItems: Array<{ key: keyof UserPrivacy; title: string; subtitle: string }> = [
  { key: "show_following_public", title: "我的关注", subtitle: "允许他人查看我关注了谁" },
  { key: "show_followers_public", title: "我的粉丝", subtitle: "允许他人查看谁关注了我" },
  { key: "show_comments_public", title: "我的评论", subtitle: "允许他人查看我的公开评论" },
  { key: "show_likes_public", title: "我的点赞", subtitle: "允许他人查看我赞过的作品" },
];

export function PrivacySettingsScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery({
    queryKey: ["my-privacy"],
    queryFn: api.getMyPrivacy,
  });

  const mutation = useMutation({
    mutationFn: (payload: Partial<UserPrivacy>) => api.updateMyPrivacy(payload),
    onSuccess: (privacy) => {
      if (currentUser) {
        setUser({ ...currentUser, ...privacy });
      }
      void queryClient.invalidateQueries({ queryKey: ["my-privacy"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["author-profile"] });
    },
  });

  const privacy = query.data;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>公开范围</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {privacyItems.map((item, index) => {
          const enabled = privacy?.[item.key] ?? true;
          return (
            <View key={item.key} style={[styles.row, index < privacyItems.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>{item.subtitle}</Text>
              </View>
              <Pressable
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: enabled ? colors.accent : colors.border,
                    justifyContent: enabled ? "flex-end" : "flex-start",
                  },
                ]}
                disabled={!privacy || mutation.isPending}
                onPress={() => mutation.mutate({ [item.key]: !enabled })}
              >
                <View style={styles.toggleThumb} />
              </Pressable>
              <Text style={[styles.statusText, { color: enabled ? colors.accent : colors.subtext }]}>
                {enabled ? "公开" : "不公开"}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>关系管理</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Pressable style={styles.blockRow} onPress={() => navigation.navigate("BlockedUsers")}>
          <View style={styles.blockLeft}>
            <View style={[styles.blockIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="ban-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>查看黑名单用户</Text>
              <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>管理你已拉黑的用户</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 22,
    overflow: "hidden",
  },
  row: {
    minHeight: 86,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  rowSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  toggleTrack: {
    width: 54,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    flexDirection: "row",
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ffffff",
  },
  statusText: {
    width: 44,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  blockRow: {
    minHeight: 78,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  blockLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  blockIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
