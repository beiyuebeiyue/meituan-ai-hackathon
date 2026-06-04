import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Image,
  Pressable,
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

type ScreenRoute = RouteProp<RootStackParamList, "WearableStore">;

const STORE_NAME = "焕甲生活超市";

export function WearableStoreScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const route = useRoute<ScreenRoute>();
  const styleId = route.params.styleId;
  const query = useQuery({
    queryKey: ["style", styleId, "wearable-store"],
    queryFn: () => api.getStyle(styleId),
  });

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
            styles.storeHero,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.storeIcon, { backgroundColor: colors.accentSoft }]}
          >
            <Ionicons
              name="storefront-outline"
              size={30}
              color={colors.accent}
            />
          </View>
          <View style={styles.storeCopy}>
            <Text style={[styles.storeName, { color: colors.text }]}>
              {STORE_NAME}
            </Text>
            <Text style={[styles.storeMeta, { color: colors.subtext }]}>
              穿戴甲专柜 · 同城次日达 · 演示订单
            </Text>
          </View>
        </View>

        {query.isLoading ? (
          <View
            style={[styles.loadingCard, { backgroundColor: colors.surface }]}
          >
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.subtext }]}>
              正在加载商品...
            </Text>
          </View>
        ) : query.data ? (
          <>
            <View
              style={[
                styles.productCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Image
                source={{ uri: resolveAssetUrl(query.data.image_url) }}
                style={[
                  styles.productImage,
                  { backgroundColor: colors.accentSoft },
                ]}
              />
              <View style={styles.productBody}>
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
                <Text style={[styles.productTitle, { color: colors.text }]}>
                  {query.data.title}
                </Text>
                <Text
                  style={[styles.productDesc, { color: colors.subtext }]}
                  numberOfLines={3}
                >
                  {query.data.description ||
                    "适合日常快速换甲，搭配随附果冻胶，展示用演示商品。"}
                </Text>
                <Text style={[styles.price, { color: colors.text }]}>
                  ¥39.9
                </Text>
              </View>
            </View>

            <View
              style={[styles.promiseCard, { backgroundColor: colors.surface }]}
            >
              {["现货演示", "24片装", "赠果冻胶", "同城次日达"].map((item) => (
                <View key={item} style={styles.promiseItem}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={colors.accent}
                  />
                  <Text style={[styles.promiseText, { color: colors.text }]}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            商品暂不可用。
          </Text>
        )}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.bottomLabel, { color: colors.subtext }]}>
            演示价
          </Text>
          <Text style={[styles.bottomPrice, { color: colors.text }]}>
            ¥39.9
          </Text>
        </View>
        <PrimaryButton
          label="立即下单"
          onPress={() =>
            navigation.navigate("WearableOrder", {
              styleId,
              entryEdge: "right",
            })
          }
          disabled={!query.data}
          style={styles.orderButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 128, gap: 14 },
  storeHero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storeIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  storeCopy: { flex: 1, gap: 6 },
  storeName: { fontSize: 22, fontWeight: "900" },
  storeMeta: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  loadingCard: {
    minHeight: 180,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { textAlign: "center", fontWeight: "700" },
  productCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26,
    overflow: "hidden",
  },
  productImage: { width: "100%", aspectRatio: 1 },
  productBody: { padding: 16, gap: 10 },
  typePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeText: { fontSize: 12, fontWeight: "900" },
  productTitle: { fontSize: 22, lineHeight: 28, fontWeight: "900" },
  productDesc: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  price: { fontSize: 28, fontWeight: "900" },
  promiseCard: { borderRadius: 22, padding: 16, gap: 12 },
  promiseItem: { flexDirection: "row", alignItems: "center", gap: 9 },
  promiseText: { fontSize: 15, fontWeight: "800" },
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
  orderButton: { flex: 1 },
});
