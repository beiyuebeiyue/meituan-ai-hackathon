import { useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { useAppearanceStore } from "../store/useAppearanceStore";
import { useAuthStore } from "../store/useAuthStore";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const helpItems = [
  { key: "feedback", title: "意见反馈", subtitle: "功能演示中，后续接入真实反馈" },
] as const;

const accountItems = [{ key: "privacy", title: "隐私设置", subtitle: "管理关注、粉丝、评论、点赞与黑名单可见性" }] as const;

const logoutItem = { key: "logout", title: "退出登录", subtitle: "退出当前账号并清空本地登录态" } as const;

export function ProfileSettingsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setMode = useAppearanceStore((state) => state.setMode);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();

  const handlePress = (key: (typeof helpItems)[number]["key"] | (typeof accountItems)[number]["key"] | typeof logoutItem.key) => {
    if (key === "feedback") {
      Alert.alert("意见反馈", "意见反馈功能演示中，后续会接入真实提交入口。");
      return;
    }
    if (key === "privacy") {
      navigation.navigate("PrivacySettings");
      return;
    }
    Alert.alert("退出登录", "确认退出当前账号吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出",
        style: "destructive",
        onPress: async () => {
          try {
            await api.logout();
          } catch {
            // ignore network logout failures and clear local session anyway
          }
          await clearSession();
          queryClient.clear();
          navigation.reset({
            index: 0,
            routes: [{ name: "MainTabs" }],
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>通用设置</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>深色模式</Text>
            <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>开启后界面会切换为墨黑色基调</Text>
          </View>
          <Pressable
            style={[
              styles.toggleTrack,
              {
                backgroundColor: isDark ? colors.accent : colors.border,
                justifyContent: isDark ? "flex-end" : "flex-start",
              },
            ]}
            onPress={() => {
              void setMode(isDark ? "light" : "dark");
            }}
          >
            <View style={styles.toggleThumb} />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.subtext }]}>帮助与反馈</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {helpItems.map((item, index) => (
          <Pressable
            key={item.key}
            style={[styles.row, index < helpItems.length - 1 && styles.rowBorder, { borderBottomColor: colors.border }]}
            onPress={() => handlePress(item.key)}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>{item.subtitle}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.badge, { backgroundColor: colors.accentSoft, color: colors.accent }]}>演示</Text>
              <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {token ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.subtext }]}>账号设置</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {accountItems.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.row, styles.rowBorder, { borderBottomColor: colors.border }]}
                onPress={() => handlePress(item.key)}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>{item.subtitle}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
                </View>
              </Pressable>
            ))}
            <Pressable style={styles.row} onPress={() => handlePress(logoutItem.key)}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: "#c44d39" }]}>{logoutItem.title}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.subtext }]}>{logoutItem.subtitle}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
              </View>
            </Pressable>
          </View>
        </>
      ) : null}
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
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 22,
    overflow: "hidden",
  },
  row: {
    minHeight: 82,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3ece7",
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  rowSubtitle: {
    lineHeight: 18,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleTrack: {
    width: 58,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 3,
    alignItems: "center",
    flexDirection: "row",
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontWeight: "700",
    overflow: "hidden",
  },
  chevron: {
    fontSize: 28,
    lineHeight: 28,
  },
});
