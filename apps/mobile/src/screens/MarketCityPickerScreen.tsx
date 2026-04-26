import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SlideOverlayScreen, useOverlayDirection } from "../components/SlideOverlayScreen";
import { useMarketStore } from "../store/useMarketStore";
import { MARKET_CITIES, MARKET_CITY_INITIALS, RECOMMENDED_MARKET_CITIES } from "../utils/marketCities";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

export function MarketCityPickerScreen() {
  const navigation = useNavigation<any>();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const direction = useOverlayDirection("right");
  const setSelectedCity = useMarketStore((state) => state.setSelectedCity);
  const [query, setQuery] = useState("");

  const filteredCities = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return MARKET_CITIES;
    return MARKET_CITIES.filter((city) => city.name.includes(keyword) || city.initial.toLowerCase() === keyword.toLowerCase());
  }, [query]);

  const selectCity = (city: string, dismiss: () => void) => {
    setSelectedCity(city);
    dismiss();
  };

  return (
    <SlideOverlayScreen
      direction={direction}
      backgroundColor={isDark ? "#17171b" : colors.background}
      onDismiss={() => navigation.goBack()}
    >
      {(dismiss) => (
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#17171b" : colors.background }]}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={dismiss}>
              <Ionicons name="chevron-back" size={30} color={colors.text} />
            </Pressable>
            <View style={[styles.searchShell, { backgroundColor: colors.input }]}>
              <Ionicons name="search-outline" size={20} color={colors.subtext} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={query}
                onChangeText={setQuery}
                placeholder="城市/区县/商场等地点"
                placeholderTextColor={colors.subtext}
              />
            </View>
            <Pressable style={[styles.mapPickButton, { backgroundColor: colors.surface }]}>
              <Ionicons name="location" size={22} color="#1687ff" />
              <Text style={[styles.mapPickText, { color: colors.text }]}>地图选点</Text>
            </Pressable>
          </View>

          <View style={styles.topTabs}>
            <Text style={[styles.topTab, { color: colors.text }]}>我的地址</Text>
            <View>
              <Text style={[styles.topTab, styles.topTabActive, { color: colors.text }]}>国内城市</Text>
              <View style={styles.yellowUnderline} />
            </View>
            <Text style={[styles.topTab, { color: colors.text }]}>海外地区</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={[styles.panel, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionLabel, { color: colors.subtext }]}>推荐城市</Text>
              <View style={styles.recommendGrid}>
                {RECOMMENDED_MARKET_CITIES.map((city) => (
                  <Pressable
                    key={city}
                    style={[styles.cityPill, { backgroundColor: colors.input }]}
                    onPress={() => selectCity(city, dismiss)}
                  >
                    {city === "深圳" ? <Ionicons name="location-outline" size={17} color={colors.text} /> : null}
                    <Text style={[styles.cityPillText, { color: colors.text }]}>{city}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.sectionLabel, styles.initialTitle, { color: colors.subtext }]}>城市开头字母</Text>
              <View style={styles.initialGrid}>
                {MARKET_CITY_INITIALS.map((initial) => (
                  <View key={initial} style={[styles.initialPill, { backgroundColor: colors.input }]}>
                    <Text style={[styles.initialText, { color: colors.text }]}>{initial}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.cityList, { backgroundColor: colors.surface }]}>
              {Array.from(new Set(filteredCities.map((city) => city.initial)))
                .sort()
                .map((initial) => {
                  const cities = filteredCities.filter((city) => city.initial === initial);
                  return (
                    <View key={initial}>
                      <Text style={[styles.letterHeader, { color: colors.subtext }]}>{initial}</Text>
                      {cities.map((city) => (
                        <Pressable
                          key={city.name}
                          style={[styles.cityRow, { borderBottomColor: colors.border }]}
                          onPress={() => selectCity(city.name, dismiss)}
                        >
                          <Text style={[styles.cityRowText, { color: colors.text }]}>{city.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
            </View>
          </ScrollView>
        </SafeAreaView>
      )}
    </SlideOverlayScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  searchShell: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 0, fontSize: 16, fontWeight: "600" },
  mapPickButton: {
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapPickText: { fontSize: 15, fontWeight: "800" },
  topTabs: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topTab: { fontSize: 22, fontWeight: "800" },
  topTabActive: { textAlign: "center" },
  yellowUnderline: {
    alignSelf: "center",
    marginTop: -5,
    width: 72,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#ffe447",
    zIndex: -1,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 80 },
  panel: { borderRadius: 22, padding: 18 },
  sectionLabel: { fontSize: 16, fontWeight: "700" },
  recommendGrid: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cityPill: {
    width: "22%",
    minWidth: 76,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  cityPillText: { fontSize: 16, fontWeight: "800" },
  initialTitle: { marginTop: 28 },
  initialGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  initialPill: {
    width: "14.5%",
    minWidth: 45,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: { fontSize: 16, fontWeight: "700" },
  cityList: {
    marginTop: 18,
    borderRadius: 22,
    overflow: "hidden",
  },
  letterHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    fontSize: 16,
    fontWeight: "800",
  },
  cityRow: {
    minHeight: 58,
    paddingHorizontal: 18,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cityRowText: { fontSize: 18, fontWeight: "700" },
});
