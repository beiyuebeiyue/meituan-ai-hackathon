import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useThemeColors } from "../utils/theme";

type ScreenRoute = RouteProp<RootStackParamList, "WearableOrder">;

const STORE_NAME = "焕甲生活超市";
const PRODUCT_PRICE = "¥39.9";

export function WearableOrderScreen() {
  const colors = useThemeColors();
  const route = useRoute<ScreenRoute>();
  const styleId = route.params.styleId;
  const query = useQuery({
    queryKey: ["style", styleId, "wearable-order"],
    queryFn: () => api.getStyle(styleId),
  });

  const submitDemoOrder = () => {
    Alert.alert(
      "下单成功（演示）",
      "这是一笔用于产品展示的穿戴甲演示订单，不会写入真实订单。",
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.addressCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.addressIcon, { backgroundColor: colors.accentSoft }]}
          >
            <Ionicons name="location-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.addressCopy}>
            <Text style={[styles.addressTitle, { color: colors.text }]}>
              收货信息
            </Text>
            <Text style={[styles.addressText, { color: colors.subtext }]}>
              演示地址 · 下单时由用户填写
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.orderCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.storeRow}>
            <Ionicons
              name="storefront-outline"
              size={18}
              color={colors.accent}
            />
            <Text style={[styles.storeName, { color: colors.text }]}>
              {STORE_NAME}
            </Text>
          </View>

          {query.isLoading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.subtext }]}>
                正在加载商品...
              </Text>
            </View>
          ) : query.data ? (
            <View style={styles.productRow}>
              <Image
                source={{ uri: resolveAssetUrl(query.data.image_url) }}
                style={[
                  styles.productImage,
                  { backgroundColor: colors.accentSoft },
                ]}
              />
              <View style={styles.productCopy}>
                <View
                  style={[
                    styles.typePill,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Text style={[styles.typeText, { color: colors.accent }]}>
                    穿戴甲
                  </Text>
                </View>
                <Text
                  style={[styles.productTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {query.data.title}
                </Text>
                <Text style={[styles.productMeta, { color: colors.subtext }]}>
                  24片装 · 赠果冻胶 · x1
                </Text>
              </View>
              <Text style={[styles.productPrice, { color: colors.text }]}>
                {PRODUCT_PRICE}
              </Text>
            </View>
          ) : (
            <Text style={[styles.loadingText, { color: colors.subtext }]}>
              商品暂不可用。
            </Text>
          )}
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
          {[
            ["商品金额", PRODUCT_PRICE],
            ["配送", "同城次日达 · 演示"],
            ["优惠", "Demo 不计入真实收入"],
          ].map(([label, value]) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.subtext }]}>
                {label}
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.bottomLabel, { color: colors.subtext }]}>
            合计
          </Text>
          <Text style={[styles.bottomPrice, { color: colors.text }]}>
            {PRODUCT_PRICE}
          </Text>
        </View>
        <PrimaryButton
          label="提交演示订单"
          onPress={submitDemoOrder}
          disabled={!query.data}
          style={styles.submitButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 128, gap: 14 },
  addressCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addressCopy: { flex: 1, gap: 4 },
  addressTitle: { fontSize: 16, fontWeight: "900" },
  addressText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  orderCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 15,
    gap: 14,
  },
  storeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  storeName: { fontSize: 16, fontWeight: "900" },
  loadingBlock: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { textAlign: "center", fontWeight: "700" },
  productRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  productImage: { width: 86, height: 86, borderRadius: 18 },
  productCopy: { flex: 1, gap: 7 },
  typePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  typeText: { fontSize: 11, fontWeight: "900" },
  productTitle: { fontSize: 16, lineHeight: 21, fontWeight: "900" },
  productMeta: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  productPrice: { fontSize: 16, fontWeight: "900" },
  summaryCard: { borderRadius: 22, padding: 16, gap: 12 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: { fontSize: 14, fontWeight: "700" },
  summaryValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "800",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  bottomLabel: { fontSize: 12, fontWeight: "700" },
  bottomPrice: { fontSize: 24, fontWeight: "900" },
  submitButton: { flex: 1 },
});
