import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const primaryIssues = [
  {
    title: "手机号收不到验证码，无法登录",
    subtitle: "若已实名认证，可通过身份验证后登录账号",
    badge: "New",
  },
  {
    title: "更换手机号",
    subtitle: "更换账号绑定的手机号",
    badge: undefined,
  },
  {
    title: "找回原账号",
    subtitle: "忘记或无法登录上原账号，输入手机号进行找回",
    badge: undefined,
  },
  {
    title: "找回密码",
    subtitle: "忘记原账号密码，通过身份验证后重新设置密码",
    badge: undefined,
  },
] as const;

const faqIssues = [
  "登录时提示「已被限制登录或注册」",
  "登录时提示选择「是我的账号」和「不是我的账号」",
  "账号被冻结/锁定后怎么办",
  "更换账号绑定的手机号时提示「手机号已经绑定其他账号，且有相应资产未清除完毕」",
] as const;

export function LoginHelpScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();

  const openPlaceholder = (title: string) => {
    Alert.alert(title, "该帮助详情页后续补充，这里先保留真实帮助入口样式。");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>遇到问题</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {primaryIssues.map((item, index) => (
            <Pressable
              key={item.title}
              style={[styles.issueRow, index < primaryIssues.length - 1 && styles.issueRowBorder, { borderBottomColor: colors.border }]}
              onPress={() => openPlaceholder(item.title)}
            >
              <View style={styles.issueText}>
                <View style={styles.issueTitleRow}>
                  <Text style={[styles.issueTitle, { color: colors.text }]}>{item.title}</Text>
                  {item.badge ? <Text style={styles.issueBadge}>{item.badge}</Text> : null}
                </View>
                <Text style={[styles.issueSubtitle, { color: colors.subtext }]}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.subtext }]}>常见问题</Text>
          <Pressable onPress={() => openPlaceholder("查看更多常见问题")}>
            <Text style={[styles.sectionAction, { color: colors.subtext }]}>
              查看更多 <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {faqIssues.map((title, index) => (
            <Pressable
              key={title}
              style={[styles.issueRow, index < faqIssues.length - 1 && styles.issueRowBorder, { borderBottomColor: colors.border }]}
              onPress={() => openPlaceholder(title)}
            >
              <View style={styles.issueText}>
                <Text style={[styles.faqTitle, { color: colors.text }]}>{title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.footerText, { color: colors.subtext }]}>
          问题还没有解决？点击 <Text style={[styles.footerLink, { color: isDark ? "#7ab5ff" : "#4a93df" }]}>联系在线客服小美</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 68,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  content: {
    padding: 16,
    paddingBottom: 42,
    gap: 18,
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  issueRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f1",
  },
  issueText: {
    flex: 1,
    gap: 8,
  },
  issueTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  issueTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  issueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ff4d37",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  issueSubtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionAction: {
    fontSize: 16,
  },
  faqTitle: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "500",
  },
  footerText: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
  },
  footerLink: {
    fontWeight: "600",
  },
});
