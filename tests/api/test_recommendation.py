from __future__ import annotations

from app.models.nail_style import NailStyle


def test_ai_recommend_supports_hot_keywords_tag_match_and_fallback(client, db_session, image_factory):
    styles = [
        NailStyle(
            title="法式裸粉",
            description="温柔显白",
            image_url="http://example.com/1.png",
            local_image_path=str(image_factory("style1.png")),
            source_type="seed_xlsx",
            tags_json=["裸粉", "法式", "显白", "通勤"],
            dominant_colors_json=["#f4d4d2"],
            style_metadata_json={"occasion_tags": ["通勤"], "color_tags": ["裸粉"]},
            popularity_score=30,
            is_trending=True,
        ),
        NailStyle(
            title="奶白通勤",
            description="日常",
            image_url="http://example.com/2.png",
            local_image_path=str(image_factory("style2.png")),
            source_type="seed_xlsx",
            tags_json=["奶白", "通勤"],
            dominant_colors_json=["#fff4ef"],
            style_metadata_json={"occasion_tags": ["通勤"], "color_tags": ["奶白"]},
            popularity_score=18,
            is_trending=False,
        ),
        NailStyle(
            title="猫眼约会",
            description="约会",
            image_url="http://example.com/3.png",
            local_image_path=str(image_factory("style3.png")),
            source_type="seed_xlsx",
            tags_json=["猫眼", "约会"],
            dominant_colors_json=["#b89cff"],
            style_metadata_json={"occasion_tags": ["约会"], "color_tags": ["冷调"]},
            popularity_score=16,
            is_trending=True,
        ),
        NailStyle(
            title="镜面节日",
            description="节日",
            image_url="http://example.com/4.png",
            local_image_path=str(image_factory("style4.png")),
            source_type="seed_xlsx",
            tags_json=["镜面", "节日"],
            dominant_colors_json=["#f0e3aa"],
            style_metadata_json={"occasion_tags": ["节日"], "color_tags": ["暖调"]},
            popularity_score=12,
            is_trending=False,
        ),
        NailStyle(
            title="裸透日常",
            description="轻透",
            image_url="http://example.com/5.png",
            local_image_path=str(image_factory("style5.png")),
            source_type="seed_xlsx",
            tags_json=["裸透", "温柔"],
            dominant_colors_json=["#f7d7d0"],
            style_metadata_json={"occasion_tags": ["日常"], "color_tags": ["裸粉"]},
            popularity_score=10,
            is_trending=False,
        ),
    ]
    db_session.add_all(styles)
    db_session.commit()

    hot_response = client.post("/api/v1/ai/recommend", json={"query_text": "推荐最近热门的温柔裸粉法式", "limit": 5})
    assert hot_response.status_code == 200
    hot_items = hot_response.json()["items"]
    assert len(hot_items) == 5
    assert hot_items[0]["title"] == "法式裸粉"
    assert "匹配到" in hot_items[0]["reason"]

    fallback_response = client.post("/api/v1/ai/recommend", json={"query_text": "完全未知关键词", "limit": 5})
    assert fallback_response.status_code == 200
    fallback_items = fallback_response.json()["items"]
    assert len(fallback_items) == 5
    returned_titles = {item["title"] for item in fallback_items}
    assert returned_titles.issubset({style.title for style in styles})
