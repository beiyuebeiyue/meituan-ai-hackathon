export type User = {
  id: string;
  uid: number;
  email: string;
  phone?: string | null;
  username: string;
  avatar_url?: string | null;
  birthday?: string | null;
  bio?: string | null;
  location_city?: string | null;
  show_following_public: boolean;
  show_followers_public: boolean;
  show_comments_public: boolean;
  show_likes_public: boolean;
  created_at: string;
};

export type UserPrivacy = {
  show_following_public: boolean;
  show_followers_public: boolean;
  show_comments_public: boolean;
  show_likes_public: boolean;
};

export type UserSummary = {
  id: string;
  uid: number;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  city: string;
  is_following: boolean;
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

export type BrowseHistoryItem = {
  id: string;
  style: NailStyle;
  viewed_at: string;
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
  is_liked: boolean;
  like_count: number;
  is_favorited: boolean;
  favorite_count: number;
  comment_count: number;
  author_id?: string | null;
  author_name: string;
  author_avatar_url?: string | null;
  is_following_author: boolean;
  is_authored_by_me: boolean;
  created_at: string;
};

export type StyleDetail = NailStyle & {
  like_count: number;
  favorite_count: number;
  comment_count: number;
};

export type StyleComment = {
  id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_avatar_url?: string | null;
  is_mine: boolean;
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

export type TryOnHistoryItem = {
  job_id: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  result_image_url?: string | null;
  source_hand_image_url?: string | null;
  prompt_text?: string | null;
  selected_style_id: string;
  style_title: string;
  style_image_url: string;
  created_at: string;
};

export type UserPost = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_hidden: boolean;
};

export type AuthorPost = {
  id: string;
  manage_post_id?: string | null;
  title: string;
  description: string;
  image_url: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_hidden: boolean;
  is_liked: boolean;
  like_count: number;
  view_count: number;
  unique_viewer_count: number;
};

export type AuthorProfile = {
  id: string;
  uid: number;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  city: string;
  follower_count: number;
  following_count: number;
  published_count: number;
  total_like_count: number;
  is_following: boolean;
  is_mine: boolean;
  can_view_following: boolean;
  can_view_followers: boolean;
  can_view_comments: boolean;
  can_view_likes: boolean;
  has_blocked_viewer: boolean;
  viewer_has_blocked_author: boolean;
  posts: AuthorPost[];
};

export type NearbyShop = {
  id: string;
  name: string;
  cover_image_url: string;
  city: string;
  region: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number | null;
  rating?: number | null;
  heat_text: string;
  average_price_text: string;
};

export type NearbyShopSearchResponse = {
  items: NearbyShop[];
  resolved_city: string;
  resolved_region?: string | null;
  used_location: boolean;
  available_sorts: Array<"default" | "distance">;
  source?: "meituan" | "unavailable";
  message?: string | null;
};

export type MyStyleCommentItem = {
  comment_id: string;
  style_id: string;
  style_title: string;
  style_image_url: string;
  comment_content: string;
  comment_created_at: string;
  style_author_id?: string | null;
  style_author_name: string;
  style_author_avatar_url?: string | null;
};

export type MyStyleCommentListResponse = {
  items: MyStyleCommentItem[];
};

export type DirectMessageTarget = {
  id: string;
  uid: number;
  username: string;
  avatar_url?: string | null;
};

export type DirectMessage = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  content: string;
  created_at: string;
  is_mine: boolean;
  read_at?: string | null;
};

export type DirectMessageThread = {
  target: DirectMessageTarget;
  items: DirectMessage[];
  can_send: boolean;
  is_mutual_follow: boolean;
  viewer_follows_target: boolean;
  blocked_by_target: boolean;
  viewer_has_blocked_target: boolean;
  notice?: string | null;
};

export type MessageInboxThread = {
  target: DirectMessageTarget;
  last_message_preview: string;
  last_message_at: string;
  last_message_is_mine: boolean;
  unread_count: number;
  is_muted: boolean;
  is_stranger_source: boolean;
  can_send: boolean;
  is_mutual_follow: boolean;
  viewer_follows_target: boolean;
  blocked_by_target: boolean;
  viewer_has_blocked_target: boolean;
};

export type StrangerBucketSummary = {
  unread_count: number;
  thread_count: number;
  latest_message_preview?: string | null;
  latest_message_at?: string | null;
};

export type MessageBadgeSummary = {
  has_stranger_unread: boolean;
  main_unread_count: number;
};

export type MessageInboxResponse = {
  stranger_bucket?: StrangerBucketSummary | null;
  items: MessageInboxThread[];
  badge: MessageBadgeSummary;
};
