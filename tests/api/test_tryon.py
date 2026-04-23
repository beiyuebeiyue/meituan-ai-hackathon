from __future__ import annotations

from app.models.nail_style import NailStyle
from app.providers.hand_landmarker_provider import HandDetectionResult, FingertipROI, Landmark
from app.providers.openai_image_provider import GeneratedImageResult
from PIL import Image


def _create_user(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"phone": "13900001111", "password": "secret123", "username": "tester"},
    )
    data = response.json()
    return data["access_token"], data["user"]


def test_tryon_job_success_and_failure(client, db_session, image_factory, app_env, monkeypatch):
    token, _ = _create_user(client)
    style = NailStyle(
        title="法式裸粉",
        description="desc",
        image_url="http://example.com/style.png",
        local_image_path=str(image_factory("style.png")),
        source_type="seed_xlsx",
        tags_json=["法式", "裸粉"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=12,
        is_trending=True,
    )
    db_session.add(style)
    db_session.commit()
    db_session.refresh(style)

    from app.routers.tryon import tryon_service

    monkeypatch.setattr(
        tryon_service.hand_service,
        "detect",
        lambda _: HandDetectionResult(
            landmarks=[Landmark(x=0.2, y=0.2)],
            fingertip_rois=[FingertipROI(x=20, y=20, width=30, height=20)],
        ),
    )
    monkeypatch.setattr(
        tryon_service.segmentation_service,
        "segment",
        lambda *_args, **_kwargs: type("Segmentation", (), {"mask_path": None, "roi_boxes": [{"x": 20, "y": 20, "width": 30, "height": 20}], "confidence": 0.8})(),
    )

    success_output = app_env.tryon_result_path / "success.png"
    success_output.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (256, 256), (240, 180, 180)).save(success_output)
    monkeypatch.setattr(
        tryon_service.image_edit_service,
        "generate_tryon",
        lambda **_kwargs: GeneratedImageResult(local_path=success_output, public_url="/files/tryon_results/success.png", provider_trace_id="mock"),
    )

    with image_factory("hand.png").open("rb") as hand_file:
        response = client.post(
            "/api/v1/tryon/jobs",
            headers={"Authorization": f"Bearer {token}"},
            files={"hand_image": ("hand.png", hand_file.read(), "image/png")},
            data={"style_id": style.id, "prompt_text": "裸粉法式"},
        )
    assert response.status_code == 200
    job_id = response.json()["job_id"]

    status_response = client.get(f"/api/v1/tryon/jobs/{job_id}", headers={"Authorization": f"Bearer {token}"})
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "succeeded"
    assert status_response.json()["result_image_url"] == "/files/tryon_results/success.png"
    assert status_response.json()["source_hand_image_url"].startswith("/files/uploads/hands/")

    hand_photos_response = client.get("/api/v1/users/me/hand-photos", headers={"Authorization": f"Bearer {token}"})
    assert hand_photos_response.status_code == 200
    hand_photos = hand_photos_response.json()["items"]
    assert len(hand_photos) == 1
    saved_hand_photo_id = hand_photos[0]["id"]

    reused_response = client.post(
        "/api/v1/tryon/jobs",
        headers={"Authorization": f"Bearer {token}"},
        files={
            "style_id": (None, style.id),
            "prompt_text": (None, "复用手图"),
            "saved_hand_photo_id": (None, saved_hand_photo_id),
        },
    )
    assert reused_response.status_code == 200
    reused_job_id = reused_response.json()["job_id"]
    reused_status = client.get(f"/api/v1/tryon/jobs/{reused_job_id}", headers={"Authorization": f"Bearer {token}"})
    assert reused_status.status_code == 200
    assert reused_status.json()["status"] == "succeeded"
    assert reused_status.json()["source_hand_image_url"] == hand_photos[0]["image_url"]

    monkeypatch.setattr(
        tryon_service.image_edit_service,
        "generate_tryon",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("mock failure")),
    )
    with image_factory("hand-fail.png").open("rb") as hand_file:
        failed_response = client.post(
            "/api/v1/tryon/jobs",
            headers={"Authorization": f"Bearer {token}"},
            files={"hand_image": ("hand.png", hand_file.read(), "image/png")},
            data={"style_id": style.id, "prompt_text": "失败"},
        )
    failed_job_id = failed_response.json()["job_id"]
    failed_status = client.get(f"/api/v1/tryon/jobs/{failed_job_id}", headers={"Authorization": f"Bearer {token}"})
    assert failed_status.status_code == 200
    assert failed_status.json()["status"] == "failed"
    assert "mock failure" in failed_status.json()["error_message"]
