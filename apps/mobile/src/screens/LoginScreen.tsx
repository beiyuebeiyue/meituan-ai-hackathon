import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const DEMO_PHONE = "13886722666";
const DEMO_PASSWORD = "admin@123456";
const DEMO_SMS_CODE = "666666";
const partnerLogins = [
  { key: "meituan", image: require("../../assets/login/meituan.png"), label: "美团" },
  { key: "wechat", image: require("../../assets/login/wechat.png"), label: "微信" },
  { key: "alipay", image: require("../../assets/login/alipay.png"), label: "支付宝" },
] as const;

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { detail?: string };
      if (parsed.detail) return parsed.detail;
    } catch {
      return error.message;
    }
    return error.message;
  }
  return "操作失败，请稍后重试";
}

export function LoginScreen() {
  const navigation = useNavigation();
  const setSession = useAuthStore((state) => state.setSession);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const [loginMethod, setLoginMethod] = useState<"sms" | "password">("sms");
  const [phone, setPhone] = useState(DEMO_PHONE);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [smsCode, setSmsCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [smsRequested, setSmsRequested] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: { loginMethod: "sms" | "password"; phone: string; password: string; smsCode: string }) => {
      const normalizedPhone = payload.phone.replace(/\D/g, "").slice(0, 11);
      if (normalizedPhone.length !== 11) {
        throw new Error("请输入正确的 11 位手机号");
      }
      if (!agreed) {
        throw new Error("请先阅读并同意用户协议与隐私政策");
      }

      if (payload.loginMethod === "password") {
        return api.login({ phone: normalizedPhone, password: payload.password });
      }

      if (!smsRequested) {
        throw new Error("请先获取短信验证码");
      }
      if (payload.smsCode !== DEMO_SMS_CODE) {
        throw new Error(`验证码错误，请输入演示验证码 ${DEMO_SMS_CODE}`);
      }

      if (normalizedPhone === DEMO_PHONE) {
        return api.login({ phone: normalizedPhone, password: DEMO_PASSWORD });
      }

      try {
        return await api.register({
          phone: normalizedPhone,
          password: DEMO_PASSWORD,
          username: `用户${normalizedPhone.slice(-4)}`,
        });
      } catch (error) {
        const message = extractErrorMessage(error);
        if (message.includes("手机号已注册")) {
          throw new Error("该手机号已存在，请切换为密码登录");
        }
        throw error;
      }
    },
    onSuccess: async (response) => {
      setFeedback(null);
      await setSession(response.access_token, response.user);
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
    onError: (error) => {
      setFeedback(extractErrorMessage(error));
    },
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const requestCode = () => {
    const normalizedPhone = phone.replace(/\D/g, "").slice(0, 11);
    setPhone(normalizedPhone);
    if (normalizedPhone.length !== 11) {
      setFeedback("请输入正确的 11 位手机号");
      return;
    }
    if (!agreed) {
      setFeedback("请先阅读并同意用户协议与隐私政策");
      return;
    }
    setSmsRequested(true);
    setCountdown(60);
    setFeedback(`演示验证码已发送，固定验证码为 ${DEMO_SMS_CODE}`);
  };

  const handleQuickLogin = (provider: (typeof partnerLogins)[number]["key"]) => {
    const providerLabel = { meituan: "美团", wechat: "微信", alipay: "支付宝" }[provider];
    setAgreed(true);
    setLoginMethod("password");
    setPhone(DEMO_PHONE);
    setPassword(DEMO_PASSWORD);
    setFeedback(`已模拟 ${providerLabel} 授权登录`);
    mutation.mutate({
      loginMethod: "password",
      phone: DEMO_PHONE,
      password: DEMO_PASSWORD,
      smsCode,
    });
  };

  const actionLabel =
    loginMethod === "sms" ? (smsRequested ? "验证码登录" : "获取短信验证码") : "登录";
  const actionDisabled =
    mutation.isPending ||
    phone.replace(/\D/g, "").length !== 11 ||
    !agreed ||
    (loginMethod === "password" && password.length < 6) ||
    (loginMethod === "sms" && smsRequested && smsCode.length !== 6);

  const helperText =
    feedback ??
    (loginMethod === "sms"
      ? "演示环境下，默认手机号可直接获取验证码登录"
      : "请输入手机号和密码登录");
  const primaryBackground = actionDisabled ? (isDark ? colors.border : "#fff2a9") : isDark ? colors.accent : "#ffec88";
  const primaryLabelColor = actionDisabled ? (isDark ? "#8f8983" : "#c8bb78") : isDark ? "#ffffff" : "#6b5f2c";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.topBar}>
          <Pressable
            style={[styles.closeButton, { backgroundColor: colors.input }]}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }}
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("LoginHelp" as never)} hitSlop={8}>
            <Text style={[styles.helpText, { color: colors.text }]}>帮助</Text>
          </Pressable>
        </View>

        <View style={styles.heroBlock}>
          <Text style={[styles.title, { color: colors.text }]}>欢迎登录</Text>
        </View>

        <View style={styles.formBlock}>
          <View style={[styles.inputShell, { backgroundColor: colors.input }]}>
            <View style={[styles.prefixBlock, { borderRightColor: colors.border }]}>
              <Text style={[styles.prefixText, { color: colors.text }]}>+86</Text>
              <Ionicons name="chevron-down" size={18} color={colors.text} />
            </View>
            <TextInput
              style={[styles.phoneInput, { color: colors.text }]}
              placeholder="请输入手机号"
              placeholderTextColor={colors.subtext}
              value={phone}
              onChangeText={(value) => setPhone(value.replace(/\D/g, "").slice(0, 11))}
              keyboardType="phone-pad"
            />
          </View>

          {loginMethod === "sms" && smsRequested ? (
            <View style={[styles.inputShell, { backgroundColor: colors.input }]}>
              <TextInput
                style={[styles.codeInput, { color: colors.text }]}
                placeholder="请输入短信验证码"
                placeholderTextColor={colors.subtext}
                value={smsCode}
                onChangeText={(value) => setSmsCode(value.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
              />
              <Pressable style={styles.resendButton} onPress={requestCode} disabled={countdown > 0}>
                <Text
                  style={[
                    styles.resendText,
                    { color: countdown > 0 ? colors.subtext : colors.accent },
                  ]}
                >
                  {countdown > 0 ? `${countdown}s` : "重新获取"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {loginMethod === "password" ? (
            <View style={[styles.inputShell, { backgroundColor: colors.input }]}>
              <TextInput
                style={[styles.codeInput, { color: colors.text }]}
                placeholder="请输入密码"
                placeholderTextColor={colors.subtext}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          ) : null}

          <Text style={[styles.helperText, { color: feedback ? colors.accent : colors.subtext }]}>{helperText}</Text>

          <Pressable style={styles.agreementRow} onPress={() => setAgreed((value) => !value)}>
            <Ionicons
              name={agreed ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={agreed ? colors.accent : colors.subtext}
            />
            <Text style={[styles.agreementText, { color: colors.subtext }]}>
              我已阅读并同意 <Text style={[styles.agreementLink, { color: isDark ? "#7ab5ff" : "#4d93de" }]}>《用户协议》</Text> 和{" "}
              <Text style={[styles.agreementLink, { color: isDark ? "#7ab5ff" : "#4d93de" }]}>《隐私政策》</Text>
            </Text>
          </Pressable>

          <Pressable
            style={[styles.primaryButton, { backgroundColor: primaryBackground }]}
            disabled={actionDisabled}
            onPress={() => {
              if (loginMethod === "sms" && !smsRequested) {
                requestCode();
                return;
              }
              mutation.mutate({ loginMethod, phone, password, smsCode });
            }}
          >
            <Text style={[styles.primaryButtonLabel, { color: primaryLabelColor }]}>{actionLabel}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setFeedback(null);
              setLoginMethod((current) => (current === "sms" ? "password" : "sms"));
              setSmsRequested(false);
              setSmsCode("");
            }}
          >
            <Text style={[styles.switchText, { color: colors.text }]}>{loginMethod === "sms" ? "密码登录" : "短信验证码登录"}</Text>
          </Pressable>
        </View>

        <View style={styles.partnerRow}>
          {partnerLogins.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.partnerButton, { backgroundColor: isDark ? colors.surface : "transparent" }]}
              onPress={() => handleQuickLogin(item.key)}
            >
              <Image source={item.image} style={styles.partnerIcon} resizeMode="contain" />
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 46,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  helpText: {
    fontSize: 17,
    fontWeight: "600",
  },
  heroBlock: {
    marginTop: 84,
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "800",
  },
  formBlock: {
    marginTop: 92,
    gap: 18,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    minHeight: 74,
    paddingHorizontal: 22,
  },
  prefixBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 16,
    marginRight: 16,
    borderRightWidth: 1,
  },
  prefixText: {
    fontSize: 18,
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
  },
  codeInput: {
    flex: 1,
    fontSize: 18,
  },
  resendButton: {
    paddingLeft: 14,
  },
  resendText: { fontWeight: "700" },
  helperText: {
    paddingHorizontal: 12,
    lineHeight: 22,
    fontSize: 14,
  },
  agreementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
  },
  agreementText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
  },
  agreementLink: {},
  primaryButton: {
    marginTop: 6,
    minHeight: 74,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  switchText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 16,
  },
  partnerRow: {
    marginTop: "auto",
    flexDirection: "row",
    justifyContent: "center",
    gap: 34,
    paddingBottom: 20,
  },
  partnerButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerIcon: {
    width: 58,
    height: 58,
  },
});
