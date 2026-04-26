import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

export function MerchantShopScreen({ navigation }: any) {
  const colors = useThemeColors();
  const { token, user } = useAuthStore();
  const shopsQuery = useQuery({
    queryKey: ["merchant-shops"],
    queryFn: api.getMyMerchantShops,
    enabled: Boolean(token && user?.role === "merchant"),
  });

  if (!token || user?.role !== "merchant") {
    return <RequireLogin onLogin={() => navigation.navigate("Login")} message="商家账号登录后查看店铺" />;
  }

  const shop = shopsQuery.data?.items[0] ?? null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>店铺</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="storefront-outline" size={30} color={colors.accent} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.shopName, { color: colors.text }]}>{shop?.name ?? "默认焕甲店"}</Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>{shop?.city ?? "深圳"} · {shop?.address || "地址待完善"}</Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>联系电话：{shop?.contact_phone || user?.phone || "待填写"}</Text>
          </View>
        </View>
        <View style={[styles.tipCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.tipTitle, { color: colors.text }]}>商家工作台</Text>
          <Text style={[styles.tipText, { color: colors.subtext }]}>发布的美甲会自动绑定到你的默认门店，并出现在用户端同城 feed 和预约入口里。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 120, gap: 14 },
  title: { fontSize: 28, fontWeight: "900" },
  card: { borderRadius: 24, padding: 18, flexDirection: "row", gap: 14, alignItems: "center" },
  iconWrap: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1, gap: 6 },
  shopName: { fontSize: 21, fontWeight: "900" },
  meta: { fontSize: 14, lineHeight: 20 },
  tipCard: { borderRadius: 22, padding: 18, gap: 8 },
  tipTitle: { fontSize: 18, fontWeight: "800" },
  tipText: { lineHeight: 21 },
});
