import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuthStore } from "../store/useAuthStore";
import { palette } from "../utils/theme";

const DEMO_PHONE = "13886722666";
const DEMO_PASSWORD = "admin@123456";

export function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState(DEMO_PHONE);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [username, setUsername] = useState("");
  const setSession = useAuthStore((state) => state.setSession);

  const mutation = useMutation({
    mutationFn: async (payload: { mode: "login" | "register"; phone: string; password: string; username?: string }) =>
      payload.mode === "login"
        ? api.login({ phone: payload.phone, password: payload.password })
        : api.register({ phone: payload.phone, password: payload.password, username: payload.username ?? "" }),
    onSuccess: async (response) => {
      await setSession(response.access_token, response.user);
    },
  });

  const handleQuickLogin = (provider: "meituan" | "wechat" | "alipay") => {
    setMode("login");
    setPhone(DEMO_PHONE);
    setPassword(DEMO_PASSWORD);
    mutation.mutate({ mode: "login", phone: DEMO_PHONE, password: DEMO_PASSWORD, username });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>进入 NailTry AI</Text>
        <View style={styles.modeRow}>
          <Text style={[styles.mode, mode === "login" && styles.modeActive]} onPress={() => setMode("login")}>
            登录
          </Text>
          <Text style={[styles.mode, mode === "register" && styles.modeActive]} onPress={() => setMode("register")}>
            注册
          </Text>
        </View>
        {mode === "login" ? (
          <>
            <Text style={styles.demoHint}>演示账号默认填充：13886722666 / admin@123456</Text>
            <View style={styles.quickLoginSection}>
              <Text style={styles.quickLoginTitle}>快捷登录</Text>
              <View style={styles.quickLoginRow}>
                <Pressable style={[styles.quickLoginButton, styles.meituanButton]} onPress={() => handleQuickLogin("meituan")}>
                  <View style={styles.quickIconCircle}>
                    <Text style={styles.quickIconText}>团</Text>
                  </View>
                  <Text style={styles.quickLabel}>美团</Text>
                </Pressable>
                <Pressable style={[styles.quickLoginButton, styles.wechatButton]} onPress={() => handleQuickLogin("wechat")}>
                  <View style={styles.quickIconCircle}>
                    <Ionicons name="chatbubbles" size={18} color="white" />
                  </View>
                  <Text style={styles.quickLabel}>微信</Text>
                </Pressable>
                <Pressable style={[styles.quickLoginButton, styles.alipayButton]} onPress={() => handleQuickLogin("alipay")}>
                  <View style={styles.quickIconCircle}>
                    <Text style={styles.quickIconText}>支</Text>
                  </View>
                  <Text style={styles.quickLabel}>支付宝</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}
        {mode === "register" ? <TextInput style={styles.input} placeholder="用户名" value={username} onChangeText={setUsername} /> : null}
        <TextInput
          style={styles.input}
          placeholder="手机号"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
        />
        <TextInput style={styles.input} placeholder="密码" value={password} onChangeText={setPassword} secureTextEntry />
        <PrimaryButton
          label={mode === "login" ? "登录" : "注册"}
          onPress={() => mutation.mutate({ mode, phone, password, username })}
          loading={mutation.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 18, gap: 14 },
  title: { fontSize: 28, fontWeight: "800", color: palette.text },
  modeRow: { flexDirection: "row", gap: 10 },
  mode: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#ffe9dd",
    color: palette.accent,
    fontWeight: "700",
  },
  modeActive: { backgroundColor: palette.accent, color: "white" },
  demoHint: { color: palette.subtext, lineHeight: 18 },
  quickLoginSection: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: palette.surface,
  },
  quickLoginTitle: { fontSize: 14, fontWeight: "700", color: palette.text },
  quickLoginRow: { flexDirection: "row", gap: 12 },
  quickLoginButton: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 18,
  },
  meituanButton: { backgroundColor: "#fff4c1" },
  wechatButton: { backgroundColor: "#e9f9ea" },
  alipayButton: { backgroundColor: "#e9f3ff" },
  quickIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickIconText: { fontSize: 18, fontWeight: "800", color: "white" },
  quickLabel: { fontSize: 13, fontWeight: "700", color: palette.text },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
});
