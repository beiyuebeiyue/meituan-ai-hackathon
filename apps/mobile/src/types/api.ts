export type User = {
  id: string;
  uid: number;
  phone?: string | null;
  username: string;
  avatar_url?: string | null;
  birthday?: string | null;
  bio?: string | null;
  last_login_ip_location?: string | null;
  role: "consumer" | "merchant";
  is_shop: boolean;
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
  ip_location: string;
  is_shop: boolean;
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
  processing_status?: "pending" | "processing" | "succeeded" | "failed" | null;
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
  author_is_shop: boolean;
  is_following_author: boolean;
  is_authored_by_me: boolean;
  shop_id?: string | null;
  shop_name?: string | null;
  shop_city?: string | null;
  shop_address?: string | null;
  verified_consumption: boolean;
  verified_shop_id?: string | null;
  verified_shop_name?: string | null;
  verified_shop_city?: string | null;
  verified_shop_address?: string | null;
  manage_post_id?: string | null;
  is_hidden?: boolean;
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
  author_is_shop: boolean;
  is_style_author: boolean;
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
  stage?: "pending" | "preprocessing" | "generating" | "succeeded" | "failed";
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
  stage?: "pending" | "preprocessing" | "generating" | "succeeded" | "failed";
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
  verified_consumption: boolean;
  verified_shop_name?: string | null;
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
  verified_consumption: boolean;
  verified_shop_name?: string | null;
};

export type AuthorProfile = {
  id: string;
  uid: number;
  role: "consumer" | "merchant";
  is_shop: boolean;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  ip_location: string;
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
  shop_id?: string | null;
  shop_name?: string | null;
  shop_city?: string | null;
  shop_address?: string | null;
  posts: AuthorPost[];
};

export type NearbyShop = {
  id: string;
  platform_shop_id?: string | null;
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
  business_time_text?: string | null;
  phone_text?: string | null;
};

export type NearbyShopSearchResponse = {
  items: NearbyShop[];
  resolved_city: string;
  resolved_region?: string | null;
  center_lat?: number | null;
  center_lng?: number | null;
  used_location: boolean;
  available_sorts: Array<"default" | "distance">;
  source?: "gaode" | "unavailable";
  message?: string | null;
};

export type MerchantShop = {
  id: string;
  merchant_user_id: string;
  name: string;
  city: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  contact_phone?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type BookingStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export type Booking = {
  id: string;
  style_id?: string | null;
  style_title: string;
  style_image_url: string;
  shop_id: string;
  shop_name: string;
  shop_city: string;
  merchant_user_id: string;
  merchant_name: string;
  user_id: string;
  user_name: string;
  appointment_time: string;
  contact_phone: string;
  status: BookingStatus;
  note?: string | null;
  created_at: string;
  updated_at: string;
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
  role: "consumer" | "merchant";
  is_shop: boolean;
  avatar_url?: string | null;
};

export type DirectMessage = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  content: string;
  image_url?: string | null;
  shared_style?: {
    id: string;
    title: string;
    image_url: string;
    author_name: string;
    author_avatar_url?: string | null;
    author_is_shop: boolean;
    like_count: number;
  } | null;
  booking_invite?: {
    shop_id: string;
    shop_name: string;
    shop_city: string;
    shop_address?: string | null;
  } | null;
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
