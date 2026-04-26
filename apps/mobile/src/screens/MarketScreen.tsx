import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { api, resolveAssetUrl } from "../api/client";
import { useMarketStore } from "../store/useMarketStore";
import { NearbyShop } from "../types/api";
import { DEFAULT_MARKET_CITY, findMarketCity, getMarketCityCenter } from "../utils/marketCities";
import { useThemeColors } from "../utils/theme";

const DEFAULT_CITY_CENTER = getMarketCityCenter(DEFAULT_MARKET_CITY) ?? { lat: 22.5431, lng: 114.0579 };

function formatDistance(distanceMeters?: number | null) {
  if (distanceMeters == null) return "距离暂未开放";
  if (distanceMeters < 1000) return `${distanceMeters}m`;
  return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)}km`;
}

function formatRating(rating?: number | null) {
  return typeof rating === "number" && rating > 0 ? rating.toFixed(1) : null;
}

function hasShopCoordinate(shop?: NearbyShop | null): shop is NearbyShop & { latitude: number; longitude: number } {
  return typeof shop?.latitude === "number" && typeof shop?.longitude === "number";
}

function shopRegionForItems(items: NearbyShop[], fallback: { lat: number; lng: number }): Region {
  const base = items.find(hasShopCoordinate);
  return {
    latitude: base?.latitude ?? fallback.lat,
    longitude: base?.longitude ?? fallback.lng,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
}

export function MarketScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const selectedCity = useMarketStore((state) => state.selectedCity);
  const setSelectedCity = useMarketStore((state) => state.setSelectedCity);
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<"default" | "distance">("default");
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationBootstrapped, setLocationBootstrapped] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          if (!cancelled) {
            setLocationDenied(true);
            setSelectedCity(DEFAULT_MARKET_CITY);
          }
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        const nextCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCoords(nextCoords);
        try {
          const geocoded = await Location.reverseGeocodeAsync({
            latitude: nextCoords.lat,
            longitude: nextCoords.lng,
          });
          if (cancelled) return;
          const matchedCity = findMarketCity(geocoded[0]?.city ?? geocoded[0]?.subregion ?? geocoded[0]?.region ?? "");
          if (matchedCity) {
            setDetectedCity(matchedCity.name);
            setSelectedCity(matchedCity.name);
          } else {
            setDetectedCity(null);
            setSelectedCity(DEFAULT_MARKET_CITY);
          }
        } catch {
          if (!cancelled) {
            setDetectedCity(null);
            setSelectedCity(DEFAULT_MARKET_CITY);
          }
        }
      } catch {
        if (!cancelled) {
          setLocationDenied(true);
          setSelectedCity(DEFAULT_MARKET_CITY);
        }
      } finally {
        if (!cancelled) {
          setLocationBootstrapped(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSelectedCity]);

  const selectedCityCenter = getMarketCityCenter(selectedCity) ?? DEFAULT_CITY_CENTER;
  const shouldUseDeviceCoords = Boolean(coords && detectedCity && detectedCity === selectedCity);
  const requestCoords = shouldUseDeviceCoords && coords ? coords : selectedCityCenter;

  const query = useQuery({
    queryKey: ["market-shops", selectedCity, sort, submittedKeyword || "default", `${requestCoords.lat}:${requestCoords.lng}`],
    queryFn: () =>
      api.getNearbyShops({
        keyword: submittedKeyword || null,
        city: selectedCity,
        lat: requestCoords.lat,
        lng: requestCoords.lng,
        sort,
        view,
      }),
    enabled: locationBootstrapped,
  });

  const coordinateShops = useMemo(() => (query.data?.items ?? []).filter(hasShopCoordinate), [query.data?.items]);

  useEffect(() => {
    const firstId = query.data?.items[0]?.id;
    setSelectedShopId(firstId ?? null);
  }, [query.data?.items]);

  const selectedShop = useMemo(
    () => query.data?.items.find((item) => item.id === selectedShopId) ?? query.data?.items[0] ?? null,
    [query.data?.items, selectedShopId]
  );

  useEffect(() => {
    if (view !== "map" || !hasShopCoordinate(selectedShop) || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: selectedShop.latitude,
        longitude: selectedShop.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      },
      260
    );
  }, [selectedShop, view]);

  const submitSearch = () => {
    setSubmittedKeyword(searchDraft.trim());
    Keyboard.dismiss();
  };

  const clearSearch = () => {
    setSearchDraft("");
    setSubmittedKeyword("");
  };

  const openInMaps = async (shop: NearbyShop) => {
    if (!hasShopCoordinate(shop)) return;
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?ll=${shop.latitude},${shop.longitude}&q=${encodeURIComponent(shop.name)}`
        : `geo:${shop.latitude},${shop.longitude}?q=${encodeURIComponent(shop.name)}`;
    await Linking.openURL(url);
  };

  const renderShopCard = ({ item }: { item: NearbyShop }) => {
    const rating = formatRating(item.rating);
    return (
      <Pressable style={styles.resultCard} onPress={() => (hasShopCoordinate(item) ? openInMaps(item) : undefined)}>
        <Image source={{ uri: resolveAssetUrl(item.cover_image_url) }} style={[styles.resultImage, { backgroundColor: colors.surfaceAlt }]} />
        <View style={styles.resultBody}>
          <View style={styles.resultTitleRow}>
            <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[styles.resultDistance, { color: colors.subtext }]}>{formatDistance(item.distance_meters)}</Text>
          </View>
          <View style={styles.ratingRow}>
            {rating ? (
              <>
                <Ionicons name="star" size={14} color="#ff6b26" />
                <Text style={styles.ratingText}>{rating}</Text>
              </>
            ) : null}
            <Text style={[styles.resultMeta, { color: colors.subtext }]} numberOfLines={1}>
              {rating ? "评价暂未开放" : "美团点评"} · {item.average_price_text}
            </Text>
          </View>
          <Text style={[styles.resultMeta, { color: colors.subtext }]} numberOfLines={1}>
            美甲 · {item.region || "丽人"}
          </Text>
          <View style={styles.tagRow}>
            <Text style={[styles.rankTag, { color: colors.accent, backgroundColor: colors.accentSoft }]} numberOfLines={1}>
              {item.heat_text || "美团点评门店"}
            </Text>
            <Text style={[styles.softTag, { color: colors.subtext, borderColor: colors.border }]}>到店咨询</Text>
            <Text style={[styles.softTag, { color: colors.subtext, borderColor: colors.border }]}>美甲</Text>
          </View>
          <Text style={[styles.addressText, { color: colors.subtext }]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
      </Pressable>
    );
  };

  const locationCopy = shouldUseDeviceCoords ? "当前定位附近" : `${selectedCity}中心附近`;
  const unavailableMessage = query.data?.source === "unavailable" ? query.data.message : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.cityButton} onPress={() => navigation.navigate("MarketCityPicker")}>
          <Ionicons name="location-outline" size={17} color={colors.text} />
          <Text style={[styles.cityText, { color: colors.text }]} numberOfLines={1}>
            {selectedCity}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.subtext} />
        </Pressable>
        <View style={[styles.searchShell, { backgroundColor: colors.input }]}>
          <Ionicons name="search-outline" size={18} color={colors.subtext} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchDraft}
            onChangeText={setSearchDraft}
            placeholder="搜索美甲店"
            placeholderTextColor={colors.subtext}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
          {searchDraft.length > 0 ? (
            <Pressable onPress={clearSearch}>
              <Ionicons name="close-circle" size={18} color={colors.subtext} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.mapEntry} onPress={() => setView((current) => (current === "map" ? "list" : "map"))}>
          <Ionicons name={view === "map" ? "list-outline" : "map-outline"} size={24} color={colors.text} />
          <Text style={[styles.mapEntryText, { color: colors.text }]}>{view === "map" ? "列表" : "地图"}</Text>
        </Pressable>
      </View>

      {locationDenied ? (
        <View style={[styles.noticeBanner, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="location-outline" size={16} color={colors.subtext} />
          <Text style={[styles.noticeText, { color: colors.subtext }]}>定位未开启，已为你展示深圳附近的美甲店。</Text>
        </View>
      ) : null}

      {unavailableMessage ? (
        <View style={[styles.noticeBanner, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.subtext} />
          <Text style={[styles.noticeText, { color: colors.subtext }]}>{unavailableMessage}</Text>
        </View>
      ) : null}

      <View style={styles.sortRow}>
        {[
          ["default", "综合排序"],
          ["distance", "距离优先"],
        ].map(([key, label]) => {
          const active = sort === key;
          return (
            <Pressable
              key={key}
              style={[styles.sortChip, { backgroundColor: active ? colors.accentSoft : colors.surface }]}
              onPress={() => setSort(key as "default" | "distance")}
            >
              <Text style={[styles.sortChipText, { color: active ? colors.accent : colors.text }]}>{label}</Text>
              <Ionicons name="chevron-down" size={13} color={active ? colors.accent : colors.subtext} />
            </Pressable>
          );
        })}
        <View style={[styles.sortChip, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sortChipText, { color: colors.text }]}>5km内</Text>
        </View>
        <View style={[styles.sortChip, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sortChipText, { color: colors.text }]}>美甲</Text>
        </View>
      </View>

      <Text style={[styles.resultHint, { color: colors.subtext }]}>
        {submittedKeyword ? `搜索 “${submittedKeyword}”` : "美甲店"} · {locationCopy}
      </Text>

      {!locationBootstrapped || query.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>正在帮你找附近值得做的美甲店...</Text>
        </View>
      ) : view === "map" ? (
        coordinateShops.length === 0 ? (
          <View style={styles.mapUnavailable}>
            <Ionicons name="map-outline" size={36} color={colors.subtext} />
            <Text style={[styles.emptyText, { color: colors.subtext }]}>当前数据暂不支持地图定位。</Text>
          </View>
        ) : (
          <View style={styles.mapWrap}>
            <MapView
              ref={(ref) => {
                mapRef.current = ref;
              }}
              style={styles.map}
              initialRegion={shopRegionForItems(coordinateShops, requestCoords)}
            >
              {coordinateShops.map((shop) => (
                <Marker
                  key={shop.id}
                  coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
                  pinColor={selectedShopId === shop.id ? colors.accent : undefined}
                  title={shop.name}
                  description={shop.address}
                  onPress={() => setSelectedShopId(shop.id)}
                />
              ))}
            </MapView>
            <FlatList
              horizontal
              pagingEnabled
              snapToInterval={290}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              data={coordinateShops}
              keyExtractor={(item) => `map-${item.id}`}
              contentContainerStyle={styles.mapCards}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.mapCard, { backgroundColor: colors.surface }]}
                  onPress={() => {
                    setSelectedShopId(item.id);
                    openInMaps(item);
                  }}
                >
                  <Text style={[styles.mapCardTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.mapCardMeta, { color: colors.subtext }]} numberOfLines={1}>
                    {item.region} · {formatDistance(item.distance_meters)} · {item.average_price_text}
                  </Text>
                  <Text style={[styles.mapCardMeta, { color: colors.subtext }]} numberOfLines={2}>
                    {item.address}
                  </Text>
                </Pressable>
              )}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / 290);
                const shop = coordinateShops[index];
                if (shop) {
                  setSelectedShopId(shop.id);
                }
              }}
            />
          </View>
        )
      ) : (
        <FlatList
          data={query.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderShopCard}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.subtext }]}>{unavailableMessage || "当前没有可展示的门店。"}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cityButton: {
    maxWidth: 84,
    minWidth: 68,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cityText: { maxWidth: 44, fontSize: 16, fontWeight: "800" },
  searchShell: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: "600",
  },
  mapEntry: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  mapEntryText: { marginTop: 1, fontSize: 11, fontWeight: "800" },
  noticeBanner: {
    marginHorizontal: 14,
    marginTop: 4,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  sortRow: {
    paddingHorizontal: 14,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sortChip: {
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sortChipText: { fontSize: 13, fontWeight: "700" },
  resultHint: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 3,
    fontSize: 12,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 13 },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 18,
  },
  resultCard: {
    flexDirection: "row",
    gap: 12,
  },
  resultImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
  },
  resultBody: {
    flex: 1,
    minHeight: 112,
    gap: 5,
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  resultTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  resultDistance: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
  },
  ratingRow: {
    minHeight: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: { color: "#ff6b26", fontSize: 15, fontWeight: "900" },
  resultMeta: { fontSize: 13, lineHeight: 18 },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  rankTag: {
    maxWidth: 150,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "800",
  },
  softTag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  addressText: { fontSize: 12, lineHeight: 17 },
  emptyText: {
    paddingTop: 40,
    textAlign: "center",
    fontSize: 14,
  },
  mapWrap: {
    flex: 1,
    marginTop: 8,
  },
  mapUnavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  map: {
    flex: 1,
  },
  mapCards: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 112,
    paddingHorizontal: 16,
    gap: 10,
  },
  mapCard: {
    width: 274,
    borderRadius: 18,
    padding: 14,
    marginRight: 10,
    gap: 8,
  },
  mapCardTitle: { fontSize: 16, fontWeight: "800" },
  mapCardMeta: { fontSize: 12, lineHeight: 18 },
});
