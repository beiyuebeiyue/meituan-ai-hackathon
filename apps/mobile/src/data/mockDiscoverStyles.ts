import { NailStyle, NailStyleListResponse, StyleComment, StyleDetail } from "../types/api";

const AUTHOR_ID = "local-huanjia-shop";
const SHOP_ID = "local-huanjia-shop-futian";
const AUTHOR_AVATAR_URL = "https://pub-17b30b99b4d24df39184b3477620adcd.r2.dev/uploads/avatars/0/p0.png";

const baseCreatedAt = "2026-06-05T03:02:53.377396Z";

const mockRows = [
  {
    id: "local-style-001",
    title: "这款裸粉法式美甲真的太好看了",
    description: "通勤和日常都很合适，干净温柔，做出来特别显手白。",
    image_url: "/files/seed/nails/ff31a259a83d23c8c4ce.png",
    tags: ["法式", "裸粉", "通勤", "显白"],
    dominant_colors: ["#f8ddec", "#f2dddc", "#eee4dc"],
    popularity_score: 112.7,
    nail_type: "press_on",
    like_count: 3357,
    favorite_count: 2568,
    comment_count: 186,
  },
  {
    id: "local-style-002",
    title: "这款贴钻法式美甲谁做谁好看",
    description: "精致贴钻和细法式很适合拍照，节日感足但不夸张。",
    image_url: "/files/seed/nails/f900ec2752316f706a3b.png",
    tags: ["贴钻", "节日", "法式", "冷调"],
    dominant_colors: ["#c6c7c2", "#c7c8c3", "#c7c8c2"],
    popularity_score: 148.3,
    nail_type: "press_on",
    like_count: 2984,
    favorite_count: 2176,
    comment_count: 142,
  },
  {
    id: "local-style-003",
    title: "最近超爱这款裸透温柔美甲",
    description: "裸透底色更显干净，适合第一次尝试温柔风手工甲。",
    image_url: "/files/seed/nails/ecc07b789de32b8e83a0.png",
    tags: ["裸透", "温柔", "通勤", "暖调"],
    dominant_colors: ["#adafaa", "#1a1f23", "#cfb4a6"],
    popularity_score: 104.6,
    nail_type: "handmade",
    like_count: 4218,
    favorite_count: 3104,
    comment_count: 219,
  },
  {
    id: "local-style-004",
    title: "裸粉镜面这款美甲上手太绝了",
    description: "镜面质感更有光泽，裸粉色系保留温柔感，约会很适合。",
    image_url: "/files/seed/nails/e8f5bd1c802dd24cb939.png",
    tags: ["镜面", "节日", "亮片", "裸粉"],
    dominant_colors: ["#edc6c7", "#e8cacf", "#ebc8c7"],
    popularity_score: 98,
    nail_type: "handmade",
    like_count: 3762,
    favorite_count: 2890,
    comment_count: 164,
  },
  {
    id: "local-style-005",
    title: "这款裸粉猫眼美甲真的太好看了",
    description: "猫眼光泽不重，裸粉底色显白，日常也不会显得过分隆重。",
    image_url: "/files/seed/nails/df8e5082e19e3c6d2cba.png",
    tags: ["猫眼", "约会", "显白", "裸粉"],
    dominant_colors: ["#9e9e99", "#9c9c97", "#9f9f9a"],
    popularity_score: 103.5,
    nail_type: "handmade",
    like_count: 5126,
    favorite_count: 4072,
    comment_count: 251,
  },
  {
    id: "local-style-006",
    title: "这款裸粉奶白美甲谁做谁好看",
    description: "奶白和裸粉叠加很显气质，适合短甲和自然甲型。",
    image_url: "/files/seed/nails/cfb9b2f6b1f31cadc1ea.png",
    tags: ["奶白", "通勤", "温柔", "裸粉"],
    dominant_colors: ["#786e65", "#7a7067", "#796f65"],
    popularity_score: 136.2,
    nail_type: "handmade",
    like_count: 4688,
    favorite_count: 3520,
    comment_count: 208,
  },
  {
    id: "local-style-007",
    title: "最近超爱这款裸粉法式美甲",
    description: "细边法式更修饰甲型，裸粉底色温柔又不挑肤色。",
    image_url: "/files/seed/nails/c02fc4b90e971811645b.png",
    tags: ["法式", "裸粉", "通勤", "显白"],
    dominant_colors: ["#dde1e2", "#e1e5e6", "#e0e4e5"],
    popularity_score: 95.6,
    nail_type: "handmade",
    like_count: 2841,
    favorite_count: 1906,
    comment_count: 117,
  },
  {
    id: "local-style-008",
    title: "裸粉贴钻这款美甲上手太绝了",
    description: "局部贴钻增加精致度，保留裸粉的清透，不会显得厚重。",
    image_url: "/files/seed/nails/b7a95ce3eaa347337c20.png",
    tags: ["贴钻", "节日", "法式", "裸粉"],
    dominant_colors: ["#f6f7f9", "#f5f6f8", "#f5f5f7"],
    popularity_score: 105.5,
    nail_type: "handmade",
    like_count: 3915,
    favorite_count: 2774,
    comment_count: 173,
  },
  {
    id: "local-style-009",
    title: "这款裸粉裸透美甲真的太好看了",
    description: "裸透感清爽耐看，上班、约会、拍照都比较稳妥。",
    image_url: "/files/seed/nails/b15299db25e9224e6433.png",
    tags: ["裸透", "温柔", "通勤", "裸粉"],
    dominant_colors: ["#e4e8e7", "#e3e7e6", "#e2e6e5"],
    popularity_score: 96.3,
    nail_type: "handmade",
    like_count: 4420,
    favorite_count: 3308,
    comment_count: 226,
  },
  {
    id: "local-style-010",
    title: "这款裸粉镜面美甲谁做谁好看",
    description: "镜面和亮片细节更适合节日，但整体仍然是温柔裸粉基调。",
    image_url: "/files/seed/nails/a7f7e7d8ea0b459e3695.png",
    tags: ["镜面", "节日", "亮片", "裸粉"],
    dominant_colors: ["#dcd7d3", "#d9d4d0", "#ddd8d4"],
    popularity_score: 121.6,
    nail_type: "handmade",
    like_count: 3579,
    favorite_count: 2651,
    comment_count: 153,
  },
  {
    id: "local-style-011",
    title: "最近超爱这款裸粉猫眼美甲",
    description: "猫眼细闪在光线下很有层次，裸粉色系更显手净。",
    image_url: "/files/seed/nails/a7d088afd2b2640befac.png",
    tags: ["猫眼", "约会", "显白", "裸粉"],
    dominant_colors: ["#deb9b5", "#dfbdb8", "#e0bcb6"],
    popularity_score: 88,
    nail_type: "handmade",
    like_count: 4897,
    favorite_count: 3662,
    comment_count: 241,
  },
  {
    id: "local-style-012",
    title: "奶白温柔这款美甲上手太绝了",
    description: "奶白调更干净，适合想要低调高级感的手工甲。",
    image_url: "/files/seed/nails/9b97fb63f01f54e8872c.png",
    tags: ["奶白", "通勤", "温柔", "暖调"],
    dominant_colors: ["#d0b097", "#ddbda8", "#cbab92"],
    popularity_score: 93.6,
    nail_type: "handmade",
    like_count: 3186,
    favorite_count: 2247,
    comment_count: 138,
  },
] as const;

export const mockDiscoverStyles: NailStyle[] = mockRows.map((item) => ({
  ...item,
  is_trending: true,
  source_type: "seed_local",
  is_liked: false,
  is_favorited: false,
  author_id: AUTHOR_ID,
  author_name: "焕甲测试美甲店",
  author_avatar_url: AUTHOR_AVATAR_URL,
  author_is_shop: true,
  is_following_author: false,
  is_authored_by_me: false,
  shop_id: SHOP_ID,
  shop_name: "焕甲测试美甲店",
  shop_city: "深圳",
  shop_address: "福田中心",
  verified_consumption: false,
  verified_shop_id: null,
  verified_shop_name: null,
  verified_shop_city: null,
  verified_shop_address: null,
  manage_post_id: null,
  is_hidden: false,
  created_at: baseCreatedAt,
}));

export function getMockDiscoverResponse(pageSize = mockDiscoverStyles.length): NailStyleListResponse {
  return {
    page: 1,
    page_size: pageSize,
    total: mockDiscoverStyles.length,
    items: mockDiscoverStyles.slice(0, pageSize),
  };
}

export function getMockDiscoverStyle(styleId: string): StyleDetail | undefined {
  const style = mockDiscoverStyles.find((item) => item.id === styleId);
  return style ? { ...style } : undefined;
}

export function isMockDiscoverStyleId(styleId: string): boolean {
  return mockDiscoverStyles.some((item) => item.id === styleId);
}

export function getMockStyleComments(styleId: string): { items: StyleComment[] } | undefined {
  if (!isMockDiscoverStyleId(styleId)) return undefined;
  return {
    items: [
      {
        id: `${styleId}-comment-1`,
        content: "这个颜色很显白，做出来会很适合通勤。",
        created_at: baseCreatedAt,
        author_name: "焕甲用户",
        author_avatar_url: null,
        author_is_shop: false,
        is_style_author: false,
        is_mine: false,
      },
      {
        id: `${styleId}-comment-2`,
        content: "裸粉和细闪都很耐看，适合想要温柔一点的款式。",
        created_at: baseCreatedAt,
        author_name: "深圳美甲灵感",
        author_avatar_url: null,
        author_is_shop: false,
        is_style_author: false,
        is_mine: false,
      },
    ],
  };
}
