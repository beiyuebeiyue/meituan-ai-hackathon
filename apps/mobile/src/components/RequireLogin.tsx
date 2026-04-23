import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "./PrimaryButton";
import { palette } from "../utils/theme";

type RequireLoginProps = {
  onLogin: () => void;
  message?: string;
};

export function RequireLogin({ onLogin, message = "登录后可继续操作" }: RequireLoginProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>需要登录</Text>
      <Text style={styles.message}>{message}</Text>
      <PrimaryButton label="去登录" onPress={onLogin} style={{ width: 160 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.text,
  },
  message: {
    color: palette.subtext,
    marginBottom: 12,
  },
});
