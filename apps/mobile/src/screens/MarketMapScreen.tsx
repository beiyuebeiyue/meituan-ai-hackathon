import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MarketMapView } from "../components/MarketMapView";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { formatMarketDistance, useMarketShops } from "../hooks/useMarketShops";
import { NearbyShop } from "../types/api";
import { useThemeColors } from "../utils/theme";

export function MarketMapScreen() {
  const navigation = useNavigation<any>();
  const colors = useThemeColors();
  const dismissOverlay = useSlideOverlayDismiss();
  const {
    sort,
    setSort,
    searchDraft,
    setSearchDraft,
    selectedShopId,
    setSelectedShopId,
    locationBootstrapped,
    query,
    coordinateShops,
    queryFallbackCoords,
    locationCopy,
    unavailableMessage,
    submitSearch,
    clearSearch,
  } = useMarketShops("map");

  const dismiss = dismissOverlay ?? (() => navigation.goBack());
  const openShopDetail = (shop: NearbyShop) => {
    navigation.navigate("MarketShopDetail", { shop, entryEdge: "right" });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {!locationBootstrapped ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            正在定位并加载地图...
          </Text>
        </View>
      ) : (
        <MarketMapView
          shops={coordinateShops}
          selectedShopId={selectedShopId}
          fallbackCoords={queryFallbackCoords}
          colors={colors}
          formatDistance={formatMarketDistance}
          isLoading={query.isLoading || query.isFetching}
          emptyMessage={unavailableMessage || "当前区域暂无可定位的美甲店。"}
          locationLabel={locationCopy}
          searchValue={searchDraft}
          sort={sort}
          onChangeSearch={setSearchDraft}
          onSubmitSearch={submitSearch}
          onClearSearch={clearSearch}
          onExitMap={dismiss}
          onChangeSort={setSort}
          onSelectShop={setSelectedShopId}
          onOpenShop={openShopDetail}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 13 },
});
