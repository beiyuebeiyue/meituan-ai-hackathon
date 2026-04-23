export type User = {
  id: string;
  email: string;
  phone?: string | null;
  username: string;
  avatar_url?: string | null;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type UserHandPhoto = {
  id: string;
  image_url: string;
  created_at: string;
};

export type NailStyle = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  tags: string[];
  dominant_colors: string[];
  popularity_score: number;
  is_trending: boolean;
  is_favorited: boolean;
  created_at: string;
};

export type NailStyleListResponse = {
  page: number;
  page_size: number;
  total: number;
  items: NailStyle[];
};

export type RecommendationResponse = {
  request_id: string;
  items: Array<{
    style_id: string;
    title: string;
    image_url: string;
    tags: string[];
    reason: string;
    score: number;
  }>;
};

export type TryOnJob = {
  job_id: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  result_image_url?: string | null;
  source_hand_image_url?: string | null;
  error_message?: string | null;
  prompt_text?: string | null;
  selected_style_id: string;
  created_at: string;
};

export type UserPost = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  tags: string[];
  created_at: string;
};
