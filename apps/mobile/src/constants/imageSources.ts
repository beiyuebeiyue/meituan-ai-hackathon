import type { ImageSourcePropType } from "react-native";

export type AvatarOwner = {
  role?: "consumer" | "merchant" | string | null;
  is_shop?: boolean | null;
  avatar_url?: string | null;
};

export const DEFAULT_CONSUMER_AVATAR_URL =
  "https://pub-17b30b99b4d24df39184b3477620adcd.r2.dev/app/default-avatars/consumer.png";

export const DEFAULT_MERCHANT_AVATAR_URL =
  "https://pub-17b30b99b4d24df39184b3477620adcd.r2.dev/app/default-avatars/merchant.png";

export const DEFAULT_CONSUMER_AVATAR_SOURCE: ImageSourcePropType = {
  uri: DEFAULT_CONSUMER_AVATAR_URL,
};

export const DEFAULT_MERCHANT_AVATAR_SOURCE: ImageSourcePropType = {
  uri: DEFAULT_MERCHANT_AVATAR_URL,
};

export const DEFAULT_AVATAR_SOURCE = DEFAULT_CONSUMER_AVATAR_SOURCE;

export const DEFAULT_PROFILE_BACKGROUND_SOURCE: ImageSourcePropType = {
  uri: DEFAULT_CONSUMER_AVATAR_URL,
};

export const BRAND_LOGO_SOURCE: ImageSourcePropType = {
  uri: "https://huanjia.eu.cc/favicon.png?v=20260607b",
};

export const DEFAULT_SHOP_COVER_SOURCE: ImageSourcePropType = require("../../assets/app/default_shop_cover.png");

export function defaultAvatarSourceFor(owner?: AvatarOwner | null): ImageSourcePropType {
  if (owner?.avatar_url) {
    return { uri: owner.avatar_url };
  }
  return owner?.role === "merchant" || owner?.is_shop
    ? DEFAULT_MERCHANT_AVATAR_SOURCE
    : DEFAULT_CONSUMER_AVATAR_SOURCE;
}
