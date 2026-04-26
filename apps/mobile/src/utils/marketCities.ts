export type MarketCity = {
  name: string;
  initial: string;
  latitude: number;
  longitude: number;
};

export const DEFAULT_MARKET_CITY = "深圳";

export const MARKET_CITIES: MarketCity[] = [
  { name: "深圳", initial: "S", latitude: 22.5431, longitude: 114.0579 },
  { name: "北京", initial: "B", latitude: 39.9042, longitude: 116.4074 },
  { name: "上海", initial: "S", latitude: 31.2304, longitude: 121.4737 },
  { name: "广州", initial: "G", latitude: 23.1291, longitude: 113.2644 },
  { name: "成都", initial: "C", latitude: 30.5728, longitude: 104.0668 },
  { name: "武汉", initial: "W", latitude: 30.5928, longitude: 114.3055 },
  { name: "杭州", initial: "H", latitude: 30.2741, longitude: 120.1551 },
  { name: "天津", initial: "T", latitude: 39.3434, longitude: 117.3616 },
  { name: "西安", initial: "X", latitude: 34.3416, longitude: 108.9398 },
  { name: "南京", initial: "N", latitude: 32.0603, longitude: 118.7969 },
  { name: "重庆", initial: "C", latitude: 29.563, longitude: 106.5516 },
  { name: "长沙", initial: "C", latitude: 28.2282, longitude: 112.9388 },
  { name: "苏州", initial: "S", latitude: 31.2989, longitude: 120.5853 },
  { name: "青岛", initial: "Q", latitude: 36.0671, longitude: 120.3826 },
  { name: "厦门", initial: "X", latitude: 24.4798, longitude: 118.0894 },
  { name: "佛山", initial: "F", latitude: 23.0218, longitude: 113.1219 },
  { name: "东莞", initial: "D", latitude: 23.0207, longitude: 113.7518 },
  { name: "珠海", initial: "Z", latitude: 22.2711, longitude: 113.5767 },
  { name: "郑州", initial: "Z", latitude: 34.7466, longitude: 113.6254 },
  { name: "合肥", initial: "H", latitude: 31.8206, longitude: 117.2272 },
  { name: "宁波", initial: "N", latitude: 29.8683, longitude: 121.544 },
  { name: "无锡", initial: "W", latitude: 31.4912, longitude: 120.3119 },
  { name: "福州", initial: "F", latitude: 26.0745, longitude: 119.2965 },
  { name: "济南", initial: "J", latitude: 36.6512, longitude: 117.1201 },
  { name: "昆明", initial: "K", latitude: 25.0389, longitude: 102.7183 },
  { name: "南宁", initial: "N", latitude: 22.817, longitude: 108.3669 },
];

export const RECOMMENDED_MARKET_CITIES = ["深圳", "北京", "上海", "广州", "成都", "武汉", "杭州", "天津", "西安", "南京", "重庆", "长沙"];
export const MARKET_CITY_INITIALS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "W", "X", "Y", "Z"];

export function findMarketCity(name: string): MarketCity | undefined {
  return MARKET_CITIES.find((city) => city.name === name || name.includes(city.name));
}

export function getMarketCityCenter(name: string): { lat: number; lng: number } | null {
  const city = findMarketCity(name);
  if (!city) return null;
  return { lat: city.latitude, lng: city.longitude };
}

export function resolveMarketCityName(name?: string | null): string {
  if (!name) return DEFAULT_MARKET_CITY;
  return findMarketCity(name)?.name ?? DEFAULT_MARKET_CITY;
}
