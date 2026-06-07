import { NailStyle, NailStyleListResponse, StyleComment, StyleDetail } from "../types/api";
import { DEFAULT_MERCHANT_AVATAR_URL } from "../constants/imageSources";

const AUTHOR_ID = "local-huanjia-shop";
const SHOP_ID = "local-huanjia-shop-futian";
const AUTHOR_AVATAR_URL = DEFAULT_MERCHANT_AVATAR_URL;

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

const extraSeedRows = [
  ["013", "这款清透法式美甲很适合夏天", "清透底色搭配细法式边，干净耐看，适合日常通勤。", "9683111116d9a690ab49.png", ["法式", "清透", "通勤", "显白"], "handmade", 3842, 2761, 188],
  ["014", "裸色猫眼这款上手很显气质", "低饱和裸色加细腻猫眼光，温柔但有细节。", "979acb4859e514c2622f.png", ["猫眼", "裸粉", "约会", "显白"], "handmade", 4528, 3185, 214],
  ["015", "短甲也能做的温柔奶白美甲", "短甲友好，奶白色系干净自然，不挑手型。", "1727defff41d50951fa1.png", ["奶白", "短甲", "温柔", "通勤"], "handmade", 3316, 2419, 155],
  ["016", "细闪裸粉美甲真的很显白", "细闪不会太夸张，裸粉底色让手看起来更干净。", "0911c36eb8d93ecb6040.png", ["细闪", "裸粉", "显白", "约会"], "handmade", 4168, 2992, 201],
  ["017", "这款显白通勤美甲很耐看", "颜色低调但有质感，适合上班和日常穿搭。", "8724edcc98296b6596dc.png", ["通勤", "显白", "温柔", "裸粉"], "handmade", 3624, 2536, 172],
  ["018", "法式贴钻这款精致感很足", "细法式搭配局部贴钻，适合约会和聚会场景。", "60bfb6eab9427da7bf60.png", ["法式", "贴钻", "节日", "约会"], "handmade", 4936, 3578, 237],
  ["019", "裸透猫眼美甲上手很高级", "裸透底色降低厚重感，猫眼光泽让整体更有层次。", "0dcf0b32e72f3f6fa4d2.png", ["裸透", "猫眼", "高级", "显白"], "handmade", 4387, 3120, 198],
  ["020", "这款温柔法式适合第一次做甲", "不夸张也不单调，保留自然甲色，适合新手尝试。", "49c580de6d9b0750fe60.png", ["法式", "温柔", "自然", "通勤"], "handmade", 2926, 2104, 129],
  ["021", "显白裸粉手工甲最近很火", "裸粉色系更衬肤色，手工甲质感也更自然。", "0386a8c9ad19b50a51e3.png", ["裸粉", "显白", "手工甲", "温柔"], "handmade", 4762, 3405, 224],
  ["022", "这款奶白亮片美甲很适合拍照", "奶白底色加一点亮片，干净又有氛围感。", "2473c998ab58a921a917.png", ["奶白", "亮片", "节日", "拍照"], "handmade", 3895, 2817, 166],
  ["023", "猫眼渐变这款美甲太有层次了", "渐变和猫眼结合，光线下更显精致，适合长甲型。", "82b5b1a25cea6d12b975.png", ["猫眼", "渐变", "长甲", "约会"], "handmade", 5218, 3792, 246],
  ["024", "低调显白的通勤美甲模板", "颜色干净，款式不抢眼，但整体很有精致感。", "2b9f8338d05a25538dee.png", ["通勤", "显白", "低调", "裸粉"], "handmade", 3440, 2369, 148],
  ["025", "清透裸色穿戴甲备用款", "保留一款穿戴甲作为快速换装选择，适合临时搭配。", "24bdf1782bde4c25cbf0.png", ["裸色", "穿戴甲", "快速", "清透"], "press_on", 1864, 1205, 83],
] as const;

const extraMockRows = extraSeedRows.map(
  ([id, title, description, fileName, tags, nailType, likeCount, favoriteCount, commentCount], index) => ({
    id: `local-style-${id}`,
    title,
    description,
    image_url: `/files/seed/nails/${fileName}`,
    tags,
    dominant_colors: ["#eadbd4", "#fff4ef", "#cdb4aa"],
    popularity_score: 118 + index * 2.7,
    nail_type: nailType,
    like_count: likeCount,
    favorite_count: favoriteCount,
    comment_count: commentCount,
  }),
);

export const mockDiscoverStyles: NailStyle[] = [...mockRows, ...extraMockRows].map((item) => ({
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

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/^#+/, "");
}

export function searchMockDiscoverStyles(query: string, pageSize = mockDiscoverStyles.length): NailStyleListResponse {
  const token = normalizeSearchText(query);
  const items = token
    ? mockDiscoverStyles.filter((item) => {
        const searchableText = [
          item.title,
          item.description,
          item.nail_type === "handmade" ? "手工甲" : "穿戴甲",
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase();
        return searchableText.includes(token);
      })
    : mockDiscoverStyles;

  return {
    page: 1,
    page_size: pageSize,
    total: items.length,
    items: items.slice(0, pageSize),
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
