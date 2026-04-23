import { Platform } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { AuthResponse, NailStyleListResponse, RecommendationResponse, TryOnJob, User, UserHandPhoto, UserPost } from "../types/api";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

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
    const text = await response.text();
    throw new Error(text || "请求失败");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  register: (payload: { phone: string; password: string; username: string }) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  login: (payload: { phone: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
  getMe: () => request<User>("/users/me"),
  getSavedHandPhotos: () => request<{ items: UserHandPhoto[] }>("/users/me/hand-photos"),
  updateMe: async (payload: { username?: string; avatarUri?: string }) => {
    const form = new FormData();
    if (payload.username) form.append("username", payload.username);
    if (payload.avatarUri) {
      form.append("avatar_file", {
        uri: payload.avatarUri,
        name: "avatar.jpg",
        type: "image/jpeg",
      } as never);
    }
    return request<User>("/users/me", { method: "PUT", body: form });
  },
  getHot: () => request<NailStyleListResponse>("/nails/hot?page=1&page_size=20"),
  getLatest: () => request<NailStyleListResponse>("/nails/latest?page=1&page_size=20"),
  getFavorites: () => request<{ items: NailStyleListResponse["items"] }>("/favorites/me"),
  addFavorite: (styleId: string) =>
    request<{ message: string }>("/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style_id: styleId }),
    }),
  removeFavorite: (styleId: string) => request<{ message: string }>(`/favorites/${styleId}`, { method: "DELETE" }),
  createPost: async (payload: { title: string; description: string; tags: string; imageUri: string }) => {
    const form = new FormData();
    form.append("title", payload.title);
    form.append("description", payload.description);
    form.append("tags", payload.tags);
    form.append("image", { uri: payload.imageUri, name: "post.jpg", type: "image/jpeg" } as never);
    return request<UserPost>("/posts", { method: "POST", body: form });
  },
  getMyPosts: () => request<{ items: UserPost[] }>("/posts/me"),
  recommend: (queryText: string) =>
    request<RecommendationResponse>("/ai/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query_text: queryText, limit: 5 }),
    }),
  createTryOnJob: async (payload: { styleId: string; promptText: string; handImageUri?: string | null; savedHandPhotoId?: string | null }) => {
    const form = new FormData();
    form.append("style_id", payload.styleId);
    form.append("prompt_text", payload.promptText);
    if (payload.savedHandPhotoId) {
      form.append("saved_hand_photo_id", payload.savedHandPhotoId);
    } else if (payload.handImageUri) {
      form.append("hand_image", { uri: payload.handImageUri, name: "hand.jpg", type: "image/jpeg" } as never);
    }
    return request<{ job_id: string; status: string }>("/tryon/jobs", { method: "POST", body: form });
  },
  getTryOnJob: (jobId: string) => request<TryOnJob>(`/tryon/jobs/${jobId}`),
  recordStyleEvents: (items: Array<{ style_id: string; event_type: string; source: string; count?: number }>) =>
    request<{ updated: number }>("/events/styles", {
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
