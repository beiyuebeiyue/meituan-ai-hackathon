import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { Keyboard } from "react-native";
import { api } from "../api/client";
import { useMarketStore } from "../store/useMarketStore";
import { NearbyShop } from "../types/api";
import { DEFAULT_MARKET_CITY, findMarketCity, getMarketCityCenter } from "../utils/marketCities";

const DEFAULT_CITY_CENTER = getMarketCityCenter(DEFAULT_MARKET_CITY) ?? { lat: 22.5431, lng: 114.0579 };

export function formatMarketDistance(distanceMeters?: number | null) {
  if (distanceMeters == null) return "距离暂未开放";
  if (distanceMeters < 1000) return `${distanceMeters}m`;
  return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)}km`;
}

export function formatMarketLocationLine(region?: string | null, address?: string | null) {
  const normalizedRegion = region?.trim();
  const normalizedAddress = address?.trim();
  if (!normalizedRegion) return normalizedAddress || "地址暂未开放";
  if (!normalizedAddress) return normalizedRegion;
  if (normalizedAddress.includes(normalizedRegion)) return normalizedAddress;
  return `${normalizedRegion} · ${normalizedAddress}`;
}

export function hasShopCoordinate(shop?: NearbyShop | null): shop is NearbyShop & { latitude: number; longitude: number } {
  return typeof shop?.latitude === "number" && typeof shop?.longitude === "number";
}

export function useMarketShops(view: "list" | "map") {
  const selectedCity = useMarketStore((state) => state.selectedCity);
  const setSelectedCity = useMarketStore((state) => state.setSelectedCity);
  const sort = useMarketStore((state) => state.sort);
  const setSort = useMarketStore((state) => state.setSort);
  const searchDraft = useMarketStore((state) => state.searchDraft);
  const setSearchDraft = useMarketStore((state) => state.setSearchDraft);
  const submittedPlace = useMarketStore((state) => state.submittedPlace);
  const setSubmittedPlace = useMarketStore((state) => state.setSubmittedPlace);
  const selectedShopId = useMarketStore((state) => state.selectedShopId);
  const setSelectedShopId = useMarketStore((state) => state.setSelectedShopId);
  const clearSearchState = useMarketStore((state) => state.clearSearch);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationBootstrapped, setLocationBootstrapped] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

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
  const requestPlace = submittedPlace.trim();
  const shouldUsePlaceSearch = requestPlace.length > 0;
  const queryFallbackCoords = shouldUsePlaceSearch ? selectedCityCenter : requestCoords;

  const query = useQuery({
    queryKey: [
      "market-shops",
      selectedCity,
      sort,
      requestPlace || "nearby",
      shouldUsePlaceSearch ? "place" : `${requestCoords.lat}:${requestCoords.lng}`,
    ],
    queryFn: () =>
      api.getNearbyShops({
        place: requestPlace || null,
        city: selectedCity,
        lat: shouldUsePlaceSearch ? null : requestCoords.lat,
        lng: shouldUsePlaceSearch ? null : requestCoords.lng,
        sort,
        view,
      }),
    enabled: locationBootstrapped,
  });

  const coordinateShops = useMemo(() => (query.data?.items ?? []).filter(hasShopCoordinate), [query.data?.items]);

  useEffect(() => {
    const firstId = query.data?.items[0]?.id;
    setSelectedShopId(firstId ?? null);
  }, [query.data?.items, setSelectedShopId]);

  const submitSearch = () => {
    setSubmittedPlace(searchDraft.trim());
    Keyboard.dismiss();
  };

  const clearSearch = () => {
    clearSearchState();
  };

  const locationCopy = shouldUsePlaceSearch ? `${requestPlace}附近` : shouldUseDeviceCoords ? "当前定位附近" : `${selectedCity}中心附近`;
  const unavailableMessage = query.data?.source === "unavailable" ? query.data.message : null;

  return {
    selectedCity,
    setSelectedCity,
    sort,
    setSort,
    searchDraft,
    setSearchDraft,
    submittedPlace,
    selectedShopId,
    setSelectedShopId,
    locationDenied,
    locationBootstrapped,
    query,
    coordinateShops,
    queryFallbackCoords,
    locationCopy,
    unavailableMessage,
    submitSearch,
    clearSearch,
  };
}
