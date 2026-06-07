import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { resolveAssetUrl } from "../api/client";
import { DEFAULT_SHOP_COVER_SOURCE } from "../constants/imageSources";
import { NearbyShop } from "../types/api";

type CoordinateShop = NearbyShop & { latitude: number; longitude: number };
type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const MARKER_OVERLAP_DISTANCE = 54;
const MARKER_PINK = "#111111";
const MARKER_PINK_ACTIVE = "#111111";
const MARKER_PINK_SOFT = "#666666";
const COLLAPSED_SHEET_HEIGHT = 270;
const EXPANDED_SHEET_TOP_OFFSET = 148;

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

function shopRegionForItems(items: CoordinateShop[], fallback: { lat: number; lng: number }): Region {
  const base = items[0];
  return {
    latitude: base?.latitude ?? fallback.lat,
    longitude: base?.longitude ?? fallback.lng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
}

function formatMarkerLabel(shop: CoordinateShop) {
  if (typeof shop.rating === "number" && shop.rating > 0) return `${shop.rating.toFixed(1)}分`;
  const price = shop.average_price_text?.replace("人均", "").replace("价格到店咨询", "").trim();
  return price || "美甲";
}

function formatShopScore(shop: CoordinateShop) {
  return typeof shop.rating === "number" && shop.rating > 0 ? `${shop.rating.toFixed(1)}分` : null;
}

function ratingValue(shop: CoordinateShop) {
  return typeof shop.rating === "number" && shop.rating > 0 ? shop.rating : 0;
}

function projectShopToScreen(shop: CoordinateShop, region: Region, mapSize: { width: number; height: number }) {
  if (mapSize.width <= 0 || mapSize.height <= 0 || region.latitudeDelta <= 0 || region.longitudeDelta <= 0) {
    return null;
  }
  const minLng = region.longitude - region.longitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  return {
    x: ((shop.longitude - minLng) / region.longitudeDelta) * mapSize.width,
    y: ((maxLat - shop.latitude) / region.latitudeDelta) * mapSize.height,
  };
}

function isOverlapping(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy) < MARKER_OVERLAP_DISTANCE;
}

function buildVisibleMarkers(
  shops: CoordinateShop[],
  selectedShopId: string | null,
  region: Region,
  mapSize: { width: number; height: number }
) {
  const projected = shops
    .map((shop) => {
      const point = projectShopToScreen(shop, region, mapSize);
      return point ? { shop, point } : null;
    })
    .filter((item): item is { shop: CoordinateShop; point: { x: number; y: number } } => Boolean(item));

  const groups: Array<Array<{ shop: CoordinateShop; point: { x: number; y: number } }>> = [];
  for (const item of projected) {
    const targetGroup = groups.find((group) => group.some((existing) => isOverlapping(existing.point, item.point)));
    if (targetGroup) {
      targetGroup.push(item);
    } else {
      groups.push([item]);
    }
  }

  return groups.flatMap((group) => {
    const selected = selectedShopId ? group.find((item) => item.shop.id === selectedShopId) : null;
    const primary =
      selected ??
      [...group].sort((a, b) => {
        const ratingDelta = ratingValue(b.shop) - ratingValue(a.shop);
        if (ratingDelta !== 0) return ratingDelta;
        return String(a.shop.name).localeCompare(String(b.shop.name), "zh-Hans-CN");
      })[0];
    return group.map((item) => ({ shop: item.shop, isPrimary: item.shop.id === primary.shop.id, groupSize: group.length }));
  });
}

export function MarketMapView({
  shops,
  selectedShopId,
  fallbackCoords,
  colors,
  formatDistance,
  isLoading,
  emptyMessage,
  locationLabel,
  searchValue,
  sort,
  onChangeSearch,
  onSubmitSearch,
  onClearSearch,
  onExitMap,
  onChangeSort,
  onSelectShop,
  onOpenShop,
}: MarketMapViewProps) {
  const listRef = useRef<FlatList<CoordinateShop> | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const initialRegion = useMemo(() => shopRegionForItems(shops, fallbackCoords), [fallbackCoords.lat, fallbackCoords.lng, shops]);
  const [mapRegion, setMapRegion] = useState<Region>(initialRegion);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_SHEET_HEIGHT)).current;
  const sheetStartHeight = useRef(COLLAPSED_SHEET_HEIGHT);
  const listScrollOffset = useRef(0);
  const expandedSheetHeight = Math.max(COLLAPSED_SHEET_HEIGHT, windowHeight - EXPANDED_SHEET_TOP_OFFSET);
  const selectedShop = useMemo(() => shops.find((item) => item.id === selectedShopId) ?? shops[0] ?? null, [selectedShopId, shops]);
  const visibleMarkers = useMemo(
    () => buildVisibleMarkers(shops, selectedShopId, mapRegion, mapSize),
    [mapRegion, mapSize, selectedShopId, shops]
  );

  const snapSheet = (expanded: boolean) => {
    setSheetExpanded(expanded);
    Animated.spring(sheetHeight, {
      toValue: expanded ? expandedSheetHeight : COLLAPSED_SHEET_HEIGHT,
      useNativeDriver: false,
      damping: 22,
      stiffness: 220,
      mass: 0.8,
    }).start();
  };

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) => {
          const isVertical = Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
          if (!isVertical) return false;
          if (!sheetExpanded) return true;
          return listScrollOffset.current <= 0 && gesture.dy > 0;
        },
        onPanResponderGrant: () => {
          sheetHeight.stopAnimation((value) => {
            sheetStartHeight.current = value;
          });
        },
        onPanResponderMove: (_event, gesture) => {
          const nextHeight = Math.max(
            COLLAPSED_SHEET_HEIGHT,
            Math.min(expandedSheetHeight, sheetStartHeight.current - gesture.dy)
          );
          sheetHeight.setValue(nextHeight);
        },
        onPanResponderRelease: (_event, gesture) => {
          const projectedHeight = sheetStartHeight.current - gesture.dy;
          const midpoint = COLLAPSED_SHEET_HEIGHT + (expandedSheetHeight - COLLAPSED_SHEET_HEIGHT) * 0.48;
          const shouldExpand = gesture.vy < -0.25 || projectedHeight > midpoint;
          snapSheet(shouldExpand);
        },
        onPanResponderTerminate: () => {
          snapSheet(sheetExpanded);
        },
      }),
    [expandedSheetHeight, sheetExpanded, sheetHeight]
  );

  useEffect(() => {
    setMapRegion(initialRegion);
  }, [initialRegion]);

  useEffect(() => {
    sheetHeight.setValue(sheetExpanded ? expandedSheetHeight : COLLAPSED_SHEET_HEIGHT);
  }, [expandedSheetHeight, sheetExpanded, sheetHeight]);

  useEffect(() => {
    if (!selectedShop) return;
    setMapRegion({
      latitude: selectedShop.latitude,
      longitude: selectedShop.longitude,
      latitudeDelta: 0.045,
      longitudeDelta: 0.045,
    });
  }, [selectedShop]);

  useEffect(() => {
    if (!selectedShop) return;
    const index = shops.findIndex((item) => item.id === selectedShop.id);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    }
  }, [selectedShop, shops]);

  const recenter = () => {
    setMapRegion({
      latitude: fallbackCoords.lat,
      longitude: fallbackCoords.lng,
      latitudeDelta: 0.045,
      longitudeDelta: 0.045,
    });
  };

  const handleMapLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMapSize((current) => (current.width === width && current.height === height ? current : { width, height }));
  };

  return (
    <View style={styles.mapWrap}>
      <View style={[styles.map, { backgroundColor: colors.surfaceAlt }]} onLayout={handleMapLayout}>
        <View style={styles.mapGridLayer}>
          <View style={styles.mapGridLineHorizontal} />
          <View style={[styles.mapGridLineHorizontal, styles.mapGridLineHorizontalTwo]} />
          <View style={styles.mapGridLineVertical} />
          <View style={[styles.mapGridLineVertical, styles.mapGridLineVerticalTwo]} />
        </View>
        <View style={styles.mapDistrictA} />
        <View style={styles.mapDistrictB} />
        <View style={styles.mapDistrictC} />
        <View
          style={[
            styles.currentLocationOverlay,
            {
              left: Math.max(18, mapSize.width / 2 - 17),
              top: Math.max(120, mapSize.height / 2 - 17),
            },
          ]}
        >
          <View style={styles.currentLocationHalo}>
            <View style={styles.currentLocationDot} />
          </View>
        </View>
        {visibleMarkers.map(({ shop, isPrimary, groupSize }) => (
          <Pressable
            key={shop.id}
            onPress={() => onSelectShop(shop.id)}
            style={[
              styles.markerOverlay,
              {
                left: projectShopToScreen(shop, mapRegion, mapSize)?.x ?? 0,
                top: projectShopToScreen(shop, mapRegion, mapSize)?.y ?? 0,
                zIndex: isPrimary ? 10 + groupSize : 1,
                transform: isPrimary
                  ? [{ translateX: -48 }, { translateY: -42 }]
                  : [{ translateX: -12 }, { translateY: -12 }],
              },
            ]}
          >
            {isPrimary ? (
              <View style={styles.markerWrap}>
                <View
                  style={[
                    styles.markerPill,
                    {
                      backgroundColor: selectedShopId === shop.id ? MARKER_PINK_ACTIVE : colors.surface,
                      borderColor: selectedShopId === shop.id ? MARKER_PINK_ACTIVE : MARKER_PINK,
                    },
                  ]}
                >
                  <View style={[styles.markerIcon, { backgroundColor: selectedShopId === shop.id ? "rgba(255,255,255,0.22)" : MARKER_PINK }]}>
                    <Ionicons name="sparkles" size={12} color="#fff" />
                  </View>
                  <Text style={[styles.markerText, { color: selectedShopId === shop.id ? "#fff" : MARKER_PINK_ACTIVE }]}>
                    {formatMarkerLabel(shop)}
                  </Text>
                </View>
                <Text style={[styles.markerName, { color: colors.text }]} numberOfLines={1}>
                  {shop.name}
                </Text>
              </View>
            ) : (
              <View style={styles.markerDotHitArea}>
                <View style={styles.markerDot} />
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.floatingTop}>
        <Pressable style={[styles.roundButton, { backgroundColor: colors.surface }]} onPress={onExitMap}>
          <Ionicons name="chevron-back" size={25} color={colors.text} />
        </Pressable>
        <View style={[styles.mapSearchShell, { backgroundColor: colors.surface }]}>
          <TextInput
            value={searchValue}
            onChangeText={onChangeSearch}
            onSubmitEditing={onSubmitSearch}
            returnKeyType="search"
            placeholder="搜索城市/区县/商圈/地点"
            placeholderTextColor={colors.subtext}
            style={[styles.mapSearchInput, { color: colors.text }]}
          />
          <Pressable
            style={styles.searchCloseButton}
            onPress={() => {
              if (searchValue.length > 0) onClearSearch();
              else onExitMap();
            }}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <Pressable style={[styles.locationButton, { backgroundColor: colors.surface }]} onPress={recenter}>
        <Ionicons name="locate" size={26} color={colors.text} />
      </Pressable>

      <Animated.View
        style={[styles.bottomSheet, { backgroundColor: colors.surface, height: sheetHeight }]}
        {...sheetPanResponder.panHandlers}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <View>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>附近美甲店</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.subtext }]}>{locationLabel}</Text>
          </View>
          <View style={styles.sheetActions}>
            {[
              ["default", "综合"],
              ["distance", "距离"],
            ].map(([key, label]) => {
              const active = sort === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.sheetChip, { backgroundColor: active ? colors.accentSoft : colors.input }]}
                  onPress={() => onChangeSort(key as "default" | "distance")}
                >
                  <Text style={[styles.sheetChipText, { color: active ? colors.accent : colors.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {isLoading ? (
          <View style={styles.sheetState}>
            <ActivityIndicator color={colors.accent} />
            <Text style={[styles.sheetStateText, { color: colors.subtext }]}>正在刷新门店...</Text>
          </View>
        ) : shops.length === 0 ? (
          <View style={styles.sheetState}>
            <Ionicons name="storefront-outline" size={28} color={colors.subtext} />
            <Text style={[styles.sheetStateText, { color: colors.subtext }]}>{emptyMessage || "当前区域暂无可定位门店"}</Text>
          </View>
        ) : (
          <FlatList
            ref={(ref) => {
              listRef.current = ref;
            }}
            data={shops}
            keyExtractor={(item) => `map-${item.id}`}
            scrollEnabled={sheetExpanded}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.shopList}
            onScroll={(event) => {
              listScrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            onScrollToIndexFailed={() => undefined}
            renderItem={({ item }) => {
              const selected = selectedShop?.id === item.id;
              const score = formatShopScore(item);
              const coverUri = item.cover_image_url ? resolveAssetUrl(item.cover_image_url) : null;
              return (
                <Pressable
                  style={[styles.shopRow, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.surface }]}
                  onPress={() => {
                    onSelectShop(item.id);
                    onOpenShop(item);
                  }}
                >
                  {coverUri ? (
                    <Image source={{ uri: coverUri }} style={[styles.shopImage, { backgroundColor: colors.surfaceAlt }]} />
                  ) : (
                    <Image source={DEFAULT_SHOP_COVER_SOURCE} style={[styles.shopImage, { backgroundColor: colors.surfaceAlt }]} />
                  )}
                  <View style={styles.shopInfo}>
                    <Text style={[styles.shopName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.shopMetaRow}>
                      {score ? <Text style={styles.scoreText}>{score}</Text> : null}
                      <Text style={[styles.shopMeta, { color: colors.subtext }]} numberOfLines={1}>
                        {[item.average_price_text, formatDistance(item.distance_meters)].filter(Boolean).join("  ")}
                      </Text>
                    </View>
                    <Text style={[styles.shopAddress, { color: colors.subtext }]} numberOfLines={1}>
                      {item.region ? `${item.region} · ` : ""}
                      {item.address || "地址暂未开放"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                </Pressable>
              );
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
    overflow: "hidden",
  },
  map: {
    flex: 1,
    overflow: "hidden",
  },
  mapGridLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  mapGridLineHorizontal: {
    position: "absolute",
    left: -40,
    right: -40,
    top: "34%",
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    transform: [{ rotate: "-13deg" }],
  },
  mapGridLineHorizontalTwo: {
    top: "58%",
    transform: [{ rotate: "18deg" }],
  },
  mapGridLineVertical: {
    position: "absolute",
    top: -60,
    bottom: -60,
    left: "34%",
    width: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.68)",
    transform: [{ rotate: "18deg" }],
  },
  mapGridLineVerticalTwo: {
    left: "64%",
    transform: [{ rotate: "-15deg" }],
  },
  mapDistrictA: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    left: -54,
    top: 118,
    backgroundColor: "rgba(255, 221, 228, 0.72)",
  },
  mapDistrictB: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -86,
    top: 160,
    backgroundColor: "rgba(255, 246, 214, 0.74)",
  },
  mapDistrictC: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    left: 118,
    bottom: 168,
    backgroundColor: "rgba(226, 240, 255, 0.7)",
  },
  currentLocationOverlay: {
    position: "absolute",
  },
  currentLocationHalo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.14)",
  },
  currentLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "#111111",
  },
  markerWrap: {
    alignItems: "center",
    maxWidth: 128,
  },
  markerOverlay: {
    position: "absolute",
  },
  markerPill: {
    minWidth: 70,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markerIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: {
    fontSize: 13,
    fontWeight: "900",
  },
  markerName: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    textShadowColor: "rgba(255,255,255,0.9)",
    textShadowRadius: 4,
  },
  markerDotHitArea: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: MARKER_PINK_SOFT,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  floatingTop: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  mapSearchShell: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    paddingLeft: 18,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  mapSearchInput: {
    flex: 1,
    height: 44,
    paddingVertical: 0,
    fontSize: 16,
    fontWeight: "700",
  },
  searchCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  locationButton: {
    position: "absolute",
    right: 17,
    bottom: 286,
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 270,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 9,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  sheetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sheetChip: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetChipText: {
    fontSize: 12,
    fontWeight: "900",
  },
  sheetState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sheetStateText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  shopList: {
    paddingBottom: 18,
    gap: 10,
  },
  shopRow: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 17,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shopImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  shopPhotoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  shopInfo: {
    flex: 1,
    gap: 4,
  },
  shopName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },
  shopMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "900",
  },
  shopMeta: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  shopAddress: {
    fontSize: 12,
    lineHeight: 16,
  },
});
