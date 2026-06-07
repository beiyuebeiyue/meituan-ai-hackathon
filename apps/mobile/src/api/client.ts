import { Platform } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { useContentPreferenceStore } from "../store/useContentPreferenceStore";
import {
  getMockDiscoverResponse,
  getMockDiscoverStyle,
  getMockStyleComments,
  isMockDiscoverStyleId,
  searchMockDiscoverStyles,
} from "../data/mockDiscoverStyles";
import {
  AIChatMessage,
  AIChatResponse,
  AuthResponse,
  AuthorProfile,
  Booking,
  BrowseHistoryItem,
  DirectMessage,
  DirectMessageThread,
  GeneratedPostMetadata,
  MessageInboxResponse,
  MessageInboxThread,
  MerchantTrendNotification,
  MerchantShop,
  MyStyleCommentListResponse,
  NailStyleListResponse,
  NearbyShopSearchResponse,
  RecommendationResponse,
  StyleComment,
  StyleDetail,
  TryOnHistoryItem,
  TryOnJob,
  User,
  UserHandPhoto,
  UserPost,
  UserPrivacy,
  UserSummary,
  AnalyticsEventPayload,
} from "../types/api";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://dongli-meituan-ai-hackathon.hf.space/api/v1";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
const AUTH_FAILURE_EXEMPT_PATHS = new Set(["/auth/login", "/auth/register"]);

function withXhsPreference(path: string, includeOverride?: boolean) {
  const includeXhsPosts = includeOverride ?? useContentPreferenceStore.getState().includeXhsPosts;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}include_xhs_posts=${includeXhsPosts ? "true" : "false"}`;
}

function buildHeaders(extra?: HeadersInit) {
  const token = useAuthStore.getState().token;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
  });
  if (!response.ok) {
    if (response.status === 401 && !AUTH_FAILURE_EXEMPT_PATHS.has(path)) {
      await useAuthStore.getState().clearSession();
      throw new Error("登录状态已失效，请重新登录");
    }
    const text = await response.text();
    throw new Error(text || "请求失败");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function appendImageFile(form: FormData, fieldName: string, imageUri: string, fileName: string, mimeType = "image/jpeg") {
  if (Platform.OS === "web") {
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error("图片读取失败，请重新选择图片");
    }
    const blob = await response.blob();
    const uploadFile = new File([blob], fileName, { type: blob.type || mimeType });
    form.append(fieldName, uploadFile);
    return;
  }

  form.append(fieldName, { uri: imageUri, name: fileName, type: mimeType } as never);
}

export const api = {
  register: (payload: { phone: string; password: string; username: string }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  login: (payload: { phone: string; password: string; requested_role?: "consumer" | "merchant" }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
  getMe: () => request<User>("/users/me"),
  getMyPrivacy: () => request<UserPrivacy>("/users/me/privacy"),
  updateMyPrivacy: (payload: Partial<UserPrivacy>) =>
    request<UserPrivacy>("/users/me/privacy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getSavedHandPhotos: () => request<{ items: UserHandPhoto[] }>("/users/me/hand-photos"),
  uploadSavedHandPhoto: async (imageUri: string) => {
    const form = new FormData();
    await appendImageFile(form, "image", imageUri, "hand.jpg");
    return request<UserHandPhoto>("/users/me/hand-photos", { method: "POST", body: form });
  },
  updateMe: async (payload: { username?: string; birthday?: string; bio?: string; avatarUri?: string }) => {
    const form = new FormData();
    if (payload.username !== undefined) form.append("username", payload.username);
    if (payload.birthday !== undefined) form.append("birthday", payload.birthday);
    if (payload.bio !== undefined) {
      if (payload.bio.trim()) {
        form.append("bio", payload.bio);
      } else {
        form.append("clear_bio", "true");
      }
    }
    if (payload.avatarUri) {
      await appendImageFile(form, "avatar_file", payload.avatarUri, "avatar.jpg");
    }
    return request<User>("/users/me", { method: "PUT", body: form });
  },
  getHot: () => request<NailStyleListResponse>(withXhsPreference("/nails/hot?page=1&page_size=20")),
  getDiscover: () => Promise.resolve(getMockDiscoverResponse(20)),
  getDefaultGalleryStyles: () => Promise.resolve(getMockDiscoverResponse(30)),
  getShopStyles: (shopId: string) => request<NailStyleListResponse>(`/nails/by-shop/${shopId}?page=1&page_size=30`),
  searchStyles: async (query: string) => {
    const localResults = searchMockDiscoverStyles(query, 20);
    if (localResults.items.length > 0) {
      return localResults;
    }
    return request<NailStyleListResponse>(withXhsPreference(`/nails/search?query=${encodeURIComponent(query)}&page=1&page_size=20`));
  },
  searchUsers: (query: string) => request<{ items: UserSummary[] }>(`/users/search?query=${encodeURIComponent(query)}&limit=30`),
  getFollowingStyles: () => request<NailStyleListResponse>(withXhsPreference("/nails/following?page=1&page_size=20")),
  getLatest: () => request<NailStyleListResponse>(withXhsPreference("/nails/latest?page=1&page_size=20")),
  getLocalStyles: (city: string) => request<NailStyleListResponse>(withXhsPreference(`/nails/local?city=${encodeURIComponent(city)}&page=1&page_size=20`)),
  getStyle: (styleId: string) => {
    const mockStyle = getMockDiscoverStyle(styleId);
    return mockStyle ? Promise.resolve(mockStyle) : request<StyleDetail>(`/nails/${styleId}`);
  },
  recordStyleView: (styleId: string) => request<{ message: string }>(`/nails/${styleId}/views`, { method: "POST" }),
  getStyleComments: (styleId: string) => {
    const mockComments = getMockStyleComments(styleId);
    return mockComments ? Promise.resolve(mockComments) : request<{ items: StyleComment[] }>(`/nails/${styleId}/comments`);
  },
  likeStyle: (styleId: string) =>
    isMockDiscoverStyleId(styleId)
      ? Promise.resolve({ message: "点赞成功" })
      : request<{ message: string }>(`/nails/${styleId}/likes`, { method: "POST" }),
  unlikeStyle: (styleId: string) =>
    isMockDiscoverStyleId(styleId)
      ? Promise.resolve({ message: "已取消点赞" })
      : request<{ message: string }>(`/nails/${styleId}/likes`, { method: "DELETE" }),
  createStyleComment: (styleId: string, content: string) =>
    request<StyleComment>(`/nails/${styleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),
  deleteStyleComment: (styleId: string, commentId: string) =>
    request<{ message: string }>(`/nails/${styleId}/comments/${commentId}`, { method: "DELETE" }),
  getLikedStyles: () => request<{ items: NailStyleListResponse["items"] }>("/nails/likes/me"),
  followUser: (userId: string) => request<{ message: string }>(`/users/${userId}/follow`, { method: "POST" }),
  unfollowUser: (userId: string) => request<{ message: string }>(`/users/${userId}/follow`, { method: "DELETE" }),
  blockUser: (userId: string) => request<{ message: string }>(`/users/${userId}/block`, { method: "POST" }),
  unblockUser: (userId: string) => request<{ message: string }>(`/users/${userId}/block`, { method: "DELETE" }),
  addFavorite: (styleId: string) =>
    request<{ message: string }>("/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style_id: styleId }),
    }),
  removeFavorite: (styleId: string) => request<{ message: string }>(`/favorites/${styleId}`, { method: "DELETE" }),
  createPost: async (payload: {
    title: string;
    description: string;
    tags: string;
    imageUri: string;
    shopId?: string | null;
    verifiedBookingId?: string | null;
  }) => {
    const form = new FormData();
    form.append("title", payload.title);
    form.append("description", payload.description);
    form.append("tags", payload.tags);
    if (payload.shopId) form.append("shop_id", payload.shopId);
    if (payload.verifiedBookingId) form.append("verified_booking_id", payload.verifiedBookingId);
    await appendImageFile(form, "image", payload.imageUri, "post.jpg");
    return request<UserPost>("/posts", { method: "POST", body: form });
  },
  generatePostMetadata: async (imageUri: string) => {
    const form = new FormData();
    await appendImageFile(form, "image", imageUri, "post.jpg");
    return request<GeneratedPostMetadata>("/posts/generate-metadata", { method: "POST", body: form });
  },
  getMyMerchantShops: () => request<{ items: MerchantShop[] }>("/merchant/shops/me"),
  createMerchantShop: (payload: Partial<MerchantShop> & { name: string; city: string }) =>
    request<MerchantShop>("/merchant/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateMerchantShop: (shopId: string, payload: Partial<MerchantShop>) =>
    request<MerchantShop>(`/merchant/shops/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  createBooking: (payload: { shop_id: string; style_id?: string | null; appointment_time: string; contact_phone: string; note?: string | null }) =>
    request<Booking>("/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getMyBookings: () => request<{ items: Booking[] }>("/bookings/me"),
  getMerchantBookings: () => request<{ items: Booking[] }>("/bookings/merchant"),
  updateMerchantBookingStatus: (bookingId: string, status: Booking["status"]) =>
    request<Booking>(`/bookings/merchant/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  getMyPosts: () => request<{ items: UserPost[] }>("/posts/me"),
  getAuthorProfile: (authorId: string) => request<AuthorProfile>(`/users/${authorId}/author-profile`),
  getMyStyleComments: () => request<MyStyleCommentListResponse>("/users/me/style-comments"),
  getUserStyleComments: (userId: string) => request<MyStyleCommentListResponse>(`/users/${userId}/style-comments`),
  getUserLikedStyles: (userId: string) => request<NailStyleListResponse>(`/users/${userId}/liked-styles`),
  getUserFollowing: (userId: string) => request<{ items: UserSummary[] }>(`/users/${userId}/following`),
  getUserFollowers: (userId: string) => request<{ items: UserSummary[] }>(`/users/${userId}/followers`),
  getBlockedUsers: () => request<{ items: UserSummary[] }>("/users/me/blocks"),
  getNearbyShops: (params: {
    place?: string | null;
    city: string;
    region?: string | null;
    lat?: number | null;
    lng?: number | null;
    sort?: "default" | "distance";
    view?: "list" | "map";
    styleId?: string | null;
  }) => {
    const search = new URLSearchParams();
    if (params.place) search.set("place", params.place);
    search.set("city", params.city);
    if (params.region) search.set("region", params.region);
    if (params.lat !== undefined && params.lat !== null) search.set("lat", String(params.lat));
    if (params.lng !== undefined && params.lng !== null) search.set("lng", String(params.lng));
    if (params.sort) search.set("sort", params.sort);
    if (params.view) search.set("view", params.view);
    if (params.styleId) search.set("style_id", params.styleId);
    return request<NearbyShopSearchResponse>(`/market/shops/nearby?${search.toString()}`);
  },
  getMerchantTrendNotifications: () => request<{ items: MerchantTrendNotification[] }>("/merchant/trend-notifications"),
  claimMerchantTrend: (styleId: string, campaignId?: string | null) =>
    request<{ style_id: string; shop_id: string; campaign_id?: string | null; can_do_style: boolean }>("/merchant/trend-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style_id: styleId, campaign_id: campaignId ?? null }),
    }),
  deleteMerchantTrendClaim: (styleId: string) => request<void>(`/merchant/trend-claims/${styleId}`, { method: "DELETE" }),
  getMessageInbox: () => request<MessageInboxResponse>("/messages/inbox"),
  getStrangerMessages: () => request<{ items: MessageInboxThread[] }>("/messages/strangers"),
  markAllMessagesRead: () => request<{ updated: number }>("/messages/read-all", { method: "POST" }),
  getConversation: (userId: string) => request<DirectMessageThread>(`/messages/conversations/${userId}`),
  sendMessage: (userId: string, content: string) =>
    request<DirectMessage>(`/messages/conversations/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),
  sendStyleMessage: (userId: string, styleId: string, content = "") =>
    request<DirectMessage>(`/messages/conversations/${userId}/styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style_id: styleId, content }),
    }),
  sendTryOnResultMessage: (userId: string, tryOnJobId: string, content = "") =>
    request<DirectMessage>(`/messages/conversations/${userId}/tryon-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tryon_job_id: tryOnJobId, content }),
    }),
  sendBookingInviteMessage: (userId: string, shopId?: string | null, content = "") =>
    request<DirectMessage>(`/messages/conversations/${userId}/booking-invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId ?? null, content }),
    }),
  sendImageMessage: async (userId: string, imageUri: string, content?: string) => {
    const form = new FormData();
    if (content?.trim()) form.append("content", content.trim());
    await appendImageFile(form, "image", imageUri, "message.jpg");
    return request<DirectMessage>(`/messages/conversations/${userId}/images`, { method: "POST", body: form });
  },
  updateMyPost: (postId: string, payload: { title?: string; description?: string; tags?: string[]; is_hidden?: boolean }) =>
    request<UserPost>(`/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteMyPost: (postId: string) => request<{ message: string }>(`/posts/${postId}`, { method: "DELETE" }),
  getBrowseHistory: () => request<{ items: BrowseHistoryItem[] }>("/users/me/browse-history"),
  recordBrowseHistory: async (styleId: string) => {
    const form = new FormData();
    form.append("style_id", styleId);
    return request<{ message: string }>("/users/me/browse-history", { method: "POST", body: form });
  },
  deleteBrowseHistory: (historyId: string) => request<{ message: string }>(`/users/me/browse-history/${historyId}`, { method: "DELETE" }),
  deleteBrowseHistoryBatch: (historyIds: string[]) =>
    request<{ deleted_count: number }>("/users/me/browse-history/batch-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history_ids: historyIds }),
    }),
  deleteSavedHandPhoto: (handPhotoId: string) => request<{ message: string }>(`/users/me/hand-photos/${handPhotoId}`, { method: "DELETE" }),
  recommend: (queryText: string) =>
    request<RecommendationResponse>("/ai/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query_text: queryText, limit: 5 }),
    }),
  chat: (messages: AIChatMessage[]) =>
    request<AIChatResponse>("/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    }),
  chatWithHand: async (messages: AIChatMessage[], handImageUri?: string | null, savedHandPhotoId?: string | null) => {
    const form = new FormData();
    form.append("messages", JSON.stringify(messages));
    if (savedHandPhotoId) {
      form.append("saved_hand_photo_id", savedHandPhotoId);
    } else if (handImageUri) {
      await appendImageFile(form, "hand_image", handImageUri, "hand.jpg");
    }
    return request<AIChatResponse>("/ai/chat", { method: "POST", body: form });
  },
  materializeXhsRecommendationStyle: (noteId: string) =>
    request<{ style_id: string }>(`/ai/xhs-recommendations/${encodeURIComponent(noteId)}/style`, { method: "POST" }),
  createTryOnJob: async (payload: {
    styleId: string;
    promptText: string;
    handImageUri?: string | null;
    savedHandPhotoId?: string | null;
    prepareOnly?: boolean;
  }) => {
    const form = new FormData();
    form.append("style_id", payload.styleId);
    form.append("prompt_text", payload.promptText);
    form.append("prepare_only", payload.prepareOnly === false ? "false" : "true");
    if (payload.savedHandPhotoId) {
      form.append("saved_hand_photo_id", payload.savedHandPhotoId);
    } else if (payload.handImageUri) {
      await appendImageFile(form, "hand_image", payload.handImageUri, "hand.jpg");
    }
    return request<{ job_id: string; status: TryOnJob["status"]; stage?: TryOnJob["stage"]; source_hand_image_url?: string | null; mask_url?: string | null }>("/tryon/jobs", { method: "POST", body: form });
  },
  submitTryOnJob: (jobId: string) =>
    request<{ job_id: string; status: TryOnJob["status"]; stage?: TryOnJob["stage"]; source_hand_image_url?: string | null; mask_url?: string | null }>(
      `/tryon/jobs/${jobId}/submit`,
      { method: "POST" },
    ),
  getTryOnJob: (jobId: string) => request<TryOnJob>(`/tryon/jobs/${jobId}`),
  getTryOnHistory: () => request<{ items: TryOnHistoryItem[] }>("/tryon/jobs"),
  deleteTryOnJob: (jobId: string) => request<{ message: string }>(`/tryon/jobs/${jobId}`, { method: "DELETE" }),
  recordStyleEvents: (items: Array<{ style_id: string; event_type: string; source: string; count?: number }>) =>
    request<{ updated: number }>("/events/styles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }),
  recordAnalyticsEvents: (items: AnalyticsEventPayload[]) =>
    request<{ inserted: number; skipped: number }>("/events/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }),
};

export const isIOS = Platform.OS === "ios";

export function resolveAssetUrl(value?: string | null): string {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${API_ORIGIN}${value}`;
  return `${API_ORIGIN}/${value}`;
}
