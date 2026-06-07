import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolveAssetUrl } from "../api/client";
import {
  formatMarketDistance,
  formatMarketLocationLine,
  useMarketShops,
} from "../hooks/useMarketShops";
import { useMarketStore } from "../store/useMarketStore";
import { NearbyShop } from "../types/api";
import { useThemeColors } from "../utils/theme";
import { DEFAULT_SHOP_COVER_SOURCE } from "../constants/imageSources";

function formatRating(rating?: number | null) {
  return typeof rating === "number" && rating > 0 ? rating.toFixed(1) : null;
}

function joinMeta(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" · ");
}

export function MarketScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const pendingBookingStyleId = useMarketStore(
    (state) => state.pendingBookingStyleId,
  );
  const {
    selectedCity,
    sort,
    setSort,
    searchDraft,
    setSearchDraft,
    locationDenied,
    locationBootstrapped,
    query,
    locationCopy,
    unavailableMessage,
    submitSearch,
    clearSearch,
  } = useMarketShops("list");

  const openShopDetail = (shop: NearbyShop) => {
    navigation.navigate("MarketShopDetail", { shop, entryEdge: "right" });
  };

  const renderShopCard = ({ item }: { item: NearbyShop }) => {
    const rating = formatRating(item.rating);
    const priceAndTime = joinMeta([
      item.average_price_text,
      item.business_time_text,
    ]);
    const coverUri = item.cover_image_url
      ? resolveAssetUrl(item.cover_image_url)
      : null;
    return (
      <Pressable style={styles.resultCard} onPress={() => openShopDetail(item)}>
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={[styles.resultImage, { backgroundColor: colors.surfaceAlt }]}
          />
        ) : (
          <Image
            source={DEFAULT_SHOP_COVER_SOURCE}
            style={[styles.resultImage, { backgroundColor: colors.surfaceAlt }]}
          />
        )}
        <View style={styles.resultBody}>
          <View style={styles.resultTitleRow}>
            <Text
              style={[styles.resultTitle, { color: colors.text }]}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <Text style={[styles.resultDistance, { color: colors.subtext }]}>
              {formatMarketDistance(item.distance_meters)}
            </Text>
          </View>
          {item.can_do_style ? (
            <View style={[styles.claimBadge, { borderColor: colors.accent }]}>
              <Ionicons
                name="checkmark-circle"
                size={13}
                color={colors.accent}
              />
              <Text style={[styles.claimBadgeText, { color: colors.accent }]}>
                可做这款
              </Text>
            </View>
          ) : null}
          <View style={styles.ratingRow}>
            {rating ? (
              <>
                <Ionicons name="star" size={14} color={colors.text} />
                <Text style={[styles.ratingText, { color: colors.text }]}>{rating}</Text>
              </>
            ) : null}
            {priceAndTime ? (
              <Text
                style={[styles.resultMeta, { color: colors.subtext }]}
                numberOfLines={1}
              >
                {priceAndTime}
              </Text>
            ) : null}
          </View>
          <Text
            style={[styles.resultMeta, { color: colors.subtext }]}
            numberOfLines={1}
          >
            {formatMarketLocationLine(item.region, item.address)}
          </Text>
          {item.heat_text ? (
            <Text
              style={[styles.addressText, { color: colors.subtext }]}
              numberOfLines={1}
            >
              商圈：{item.heat_text}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.topBar}>
        <Pressable
          style={styles.cityButton}
          onPress={() =>
            navigation.navigate("MarketCityPicker", { entryEdge: "left" })
          }
        >
          <Ionicons name="location-outline" size={17} color={colors.text} />
          <Text
            style={[styles.cityText, { color: colors.text }]}
            numberOfLines={1}
          >
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
            placeholder="搜索城市/区县/商圈/地点"
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
        <Pressable
          style={styles.mapEntry}
          onPress={() =>
            navigation.navigate("MarketMap", { entryEdge: "right" })
          }
        >
          <Ionicons name="map-outline" size={24} color={colors.text} />
          <Text style={[styles.mapEntryText, { color: colors.text }]}>
            地图
          </Text>
        </Pressable>
      </View>

      {locationDenied ? (
        <View
          style={[styles.noticeBanner, { backgroundColor: colors.surfaceAlt }]}
        >
          <Ionicons name="location-outline" size={16} color={colors.subtext} />
          <Text style={[styles.noticeText, { color: colors.subtext }]}>
            定位未开启，已为你展示深圳附近的美甲店。
          </Text>
        </View>
      ) : null}

      {unavailableMessage ? (
        <View
          style={[styles.noticeBanner, { backgroundColor: colors.surfaceAlt }]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={colors.subtext}
          />
          <Text style={[styles.noticeText, { color: colors.subtext }]}>
            {unavailableMessage}
          </Text>
        </View>
      ) : null}

      {pendingBookingStyleId ? (
        <View
          style={[styles.noticeBanner, { backgroundColor: colors.surfaceAlt }]}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.subtext} />
          <Text style={[styles.noticeText, { color: colors.subtext }]}>
            正在为刚才试戴的手工甲选择可预约商家。
          </Text>
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
              style={[
                styles.sortChip,
                {
                  backgroundColor: active ? colors.accentSoft : colors.surface,
                },
              ]}
              onPress={() => setSort(key as "default" | "distance")}
            >
              <Text
                style={[
                  styles.sortChipText,
                  { color: active ? colors.accent : colors.text },
                ]}
              >
                {label}
              </Text>
              <Ionicons
                name="chevron-down"
                size={13}
                color={active ? colors.accent : colors.subtext}
              />
            </Pressable>
          );
        })}
        <View style={[styles.sortChip, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sortChipText, { color: colors.text }]}>
            5km内
          </Text>
        </View>
        <View style={[styles.sortChip, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sortChipText, { color: colors.text }]}>
            美甲
          </Text>
        </View>
      </View>

      <Text style={[styles.resultHint, { color: colors.subtext }]}>
        美甲店 · {locationCopy}
      </Text>

      {!locationBootstrapped || query.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            正在为您搜索附近的美甲店
          </Text>
        </View>
      ) : (
        <FlatList
          data={query.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderShopCard}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              {unavailableMessage || "当前没有可展示的门店。"}
            </Text>
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
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  compactPhotoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    fontSize: 11,
    fontWeight: "700",
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
  ratingText: { fontSize: 15, fontWeight: "900" },
  claimBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  claimBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  resultMeta: { fontSize: 13, lineHeight: 18 },
  addressText: { fontSize: 12, lineHeight: 17 },
  emptyText: {
    paddingTop: 40,
    textAlign: "center",
    fontSize: 14,
  },
  mapUnavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
});
