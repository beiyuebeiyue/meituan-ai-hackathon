from __future__ import annotations

from app.models.nail_style import NailStyle


def create_style(image_factory, title: str, description: str, tags: list[str], *, popularity: int = 10) -> NailStyle:
    return NailStyle(
        title=title,
        description=description,
        image_url=f"http://example.com/{title}.png",
        local_image_path=str(image_factory(f"{title}.png")),
        source_type="seed_xlsx",
        tags_json=tags,
        dominant_colors_json=["#f4c7c1"],
        style_metadata_json={},
        popularity_score=popularity,
        is_trending=False,
    )


def test_search_styles_supports_title_description_and_hashtag(client, db_session, image_factory):
    title_style = create_style(image_factory, "蜜桃法式", "通勤显白", ["法式", "蜜桃"], popularity=18)
    description_style = create_style(image_factory, "星月跳色", "适合约会的雾面奶咖设计", ["约会", "跳色"], popularity=15)
    hashtag_style = create_style(image_factory, "极简裸粉", "百搭耐看", ["猫眼", "显白"], popularity=12)
    db_session.add_all([title_style, description_style, hashtag_style])
    db_session.commit()

    title_response = client.get("/api/v1/nails/search?query=法式&page=1&page_size=20")
    assert title_response.status_code == 200
    title_items = title_response.json()["items"]
    assert any(item["id"] == title_style.id for item in title_items)

    description_response = client.get("/api/v1/nails/search?query=奶咖&page=1&page_size=20")
    assert description_response.status_code == 200
    description_items = description_response.json()["items"]
    assert any(item["id"] == description_style.id for item in description_items)

    hashtag_response = client.get("/api/v1/nails/search?query=%23猫眼&page=1&page_size=20")
    assert hashtag_response.status_code == 200
    hashtag_items = hashtag_response.json()["items"]
    assert any(item["id"] == hashtag_style.id for item in hashtag_items)
