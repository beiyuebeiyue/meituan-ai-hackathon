import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { NearbyShop } from "../types/api";

type CoordinateShop = NearbyShop & { latitude: number; longitude: number };

type MarketMapViewProps = {
  shops: CoordinateShop[];
  selectedShopId: string | null;
  fallbackCoords: { lat: number; lng: number };
  colors: {
    accent: string;
    accentSoft: string;
    background: string;
    border: string;
    input: string;
    overlay: string;
    surface: string;
    surfaceAlt: string;
    subtext: string;
    text: string;
  };
  formatDistance: (distanceMeters?: number | null) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  locationLabel: string;
  searchValue: string;
  sort: "default" | "distance";
  onChangeSearch: (text: string) => void;
  onSubmitSearch: () => void;
  onClearSearch: () => void;
  onExitMap: () => void;
  onChangeSort: (sort: "default" | "distance") => void;
  onSelectShop: (shopId: string) => void;
  onOpenShop: (shop: CoordinateShop) => void;
};

export function MarketMapView({ colors }: MarketMapViewProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="map-outline" size={36} color={colors.subtext} />
      <Text style={[styles.title, { color: colors.text }]}>当前平台暂不支持动态地图</Text>
      <Text style={[styles.copy, { color: colors.subtext }]}>请使用列表查看门店，或在 iOS / Android 上打开地图视图。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  title: { fontSize: 16, fontWeight: "800" },
  copy: { fontSize: 13, lineHeight: 20, textAlign: "center" },
});
