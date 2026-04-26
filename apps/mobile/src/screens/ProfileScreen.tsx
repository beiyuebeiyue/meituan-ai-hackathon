import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { Alert, Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthorProfileScreen } from "./AuthorProfileScreen";
import { api } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");

const sloganHighlights = [
  { icon: "color-palette-outline", text: "千款美甲，随心挑选" },
  { icon: "sparkles-outline", text: "AI焕甲，随意试戴" },
  { icon: "share-social-outline", text: "心仪美甲，随手分享" },
] as const;

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { token, user } = useAuthStore();
  const setUser = useAuthStore((state) => state.setUser);
  const colors = useThemeColors();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
    }
  }, [meQuery.data, setUser]);

  const displayUser = meQuery.data ?? user;

  if (token && displayUser?.id) {
    return <AuthorProfileScreen authorId={displayUser.id} asProfileTab />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <ScrollView contentContainerStyle={styles.loggedOutContent} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.loggedOutHero} onPress={() => navigation.navigate("Login")}>
          <View style={styles.loggedOutHeroLeft}>
            <Image source={defaultAvatar} style={[styles.loggedOutAvatar, { backgroundColor: colors.surface }]} />
            <View style={styles.loggedOutHeroText}>
              <Text style={[styles.loggedOutTitle, { color: colors.text }]}>点击登录</Text>
            </View>
          </View>
          <View style={styles.loggedOutHeroRight}>
            <View style={styles.loggedOutActions}>
              <Pressable
                style={styles.loggedOutAction}
                onPress={() => Alert.alert("帮助与客服", "在线客服功能演示中，后续会接入真实客服。")}
              >
                <View style={[styles.loggedOutActionIcon, { backgroundColor: colors.surface }]}>
                  <Ionicons name="headset-outline" size={18} color={colors.subtext} />
                </View>
                <Text style={[styles.loggedOutActionText, { color: colors.subtext }]}>客服</Text>
              </Pressable>
              <Pressable style={styles.loggedOutAction} onPress={() => navigation.navigate("ProfileSettings")}>
                <View style={[styles.loggedOutActionIcon, { backgroundColor: colors.surface }]}>
                  <Ionicons name="settings-outline" size={18} color={colors.subtext} />
                </View>
                <Text style={[styles.loggedOutActionText, { color: colors.subtext }]}>设置</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>

        <View style={[styles.sloganCard, { backgroundColor: colors.surface }]}>
          <Text
            style={[styles.sloganText, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            AI焕甲，即刻上手
          </Text>
          <View style={styles.sloganList}>
            {sloganHighlights.map((item) => (
              <View key={item.text} style={styles.sloganItem}>
                <View style={[styles.sloganIconWrap, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name={item.icon} size={18} color={colors.accent} />
                </View>
                <Text style={[styles.sloganItemText, { color: colors.subtext }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
});
