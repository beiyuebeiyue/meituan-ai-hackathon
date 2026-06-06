from __future__ import annotations

import re

from app.models.nail_style import NailStyle
from app.providers.hand_landmarker_provider import HandDetectionResult, FingertipROI, Landmark
from app.providers.openai_image_provider import GeneratedImageResult
from app.providers.remote_gpu_tryon_provider import RemoteGpuTryOnProvider, RemoteGpuTryOnResult
from PIL import Image


def _create_user(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"phone": "13900001111", "password": "secret123", "username": "tester"},
    )
    data = response.json()
    return data["access_token"], data["user"]


def test_tryon_job_success_and_failure(client, db_session, image_factory, app_env, monkeypatch):
    token, user = _create_user(client)
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
    import app.tasks.tryon_tasks as tryon_tasks

    monkeypatch.setattr(tryon_tasks, "TryOnService", lambda: tryon_service)

    detect_calls = []

    def mock_detect(path):
        detect_calls.append(str(path))
        return HandDetectionResult(
            landmarks=[Landmark(x=0.2, y=0.2)],
            fingertip_rois=[FingertipROI(x=20, y=20, width=30, height=20)],
        )

    segmentation_calls = []

    def mock_segment(*_args, **_kwargs):
        segmentation_calls.append(True)
        return type(
            "Segmentation",
            (),
            {"mask_path": None, "roi_boxes": [{"x": 20, "y": 20, "width": 30, "height": 20}], "confidence": 0.8},
        )()

    monkeypatch.setattr(tryon_service.hand_service, "detect", mock_detect)
    monkeypatch.setattr(tryon_service.segmentation_service, "segment", mock_segment)

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
    assert status_response.json()["stage"] == "succeeded"
    assert status_response.json()["result_image_url"] == "/files/tryon_results/success.png"
    assert status_response.json()["source_hand_image_url"].startswith("/files/uploads/hands/")

    hand_photos_response = client.get("/api/v1/users/me/hand-photos", headers={"Authorization": f"Bearer {token}"})
    assert hand_photos_response.status_code == 200
    hand_photos = hand_photos_response.json()["items"]
    assert len(hand_photos) == 1
    assert hand_photos[0]["processing_status"] == "succeeded"
    assert re.search(rf"/files/uploads/hands/{user['uid']}/{user['uid']}-\d{{20}}-[0-9a-f]{{16}}\.", hand_photos[0]["image_url"]) is not None
    saved_hand_photo_id = hand_photos[0]["id"]
    assert len(detect_calls) == 2
    assert len(segmentation_calls) == 2

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
    assert len(detect_calls) == 2
    assert len(segmentation_calls) == 2

    monkeypatch.setattr(
        tryon_service.image_edit_service,
        "generate_tryon",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("mock failure")),
    )
    monkeypatch.setattr(
        tryon_service,
        "_generate_preview_fallback",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("fallback failure")),
    )
    with image_factory("hand-fail.png", color=(180, 120, 120)).open("rb") as hand_file:
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
    assert "fallback failure" in failed_status.json()["error_message"]


def test_remote_gpu_tryon_receives_cached_artifacts(client, db_session, image_factory, app_env, monkeypatch):
    token, _user = _create_user(client)
    style = NailStyle(
        title="猫眼显白",
        description="desc",
        image_url="http://example.com/style-remote.png",
        local_image_path=str(image_factory("style-remote.png")),
        source_type="seed_xlsx",
        tags_json=["猫眼"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=8,
        is_trending=True,
    )
    db_session.add(style)
    db_session.commit()
    db_session.refresh(style)

    calls: list[dict[str, object]] = []

    def mock_render_tryon(self, **kwargs):
        calls.append(kwargs)
        output = app_env.tryon_result_path / f"remote-{len(calls)}.png"
        output.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (64, 64), (230, 160, 160)).save(output)
        return RemoteGpuTryOnResult(
            local_path=output,
            public_url=f"/files/tryon_results/{output.name}",
            provider_trace_id="remote-mock",
            artifacts={
                "user_hand_landmarks": [{"x": 0.2, "y": 0.2}],
                "user_hand_roi_boxes": [{"x": 10, "y": 10, "width": 20, "height": 18}],
                "user_hand_quality_score": 0.9,
                "style_hand_landmarks": [{"x": 0.3, "y": 0.3}],
                "style_hand_roi_boxes": [{"x": 12, "y": 12, "width": 22, "height": 20}],
                "style_hand_quality_score": 0.88,
            },
        )

    monkeypatch.setattr(RemoteGpuTryOnProvider, "is_configured", property(lambda _self: True))
    monkeypatch.setattr(RemoteGpuTryOnProvider, "render_tryon", mock_render_tryon)

    with image_factory("remote-hand.png").open("rb") as hand_file:
        response = client.post(
            "/api/v1/tryon/jobs",
            headers={"Authorization": f"Bearer {token}"},
            files={"hand_image": ("hand.png", hand_file.read(), "image/png")},
            data={"style_id": style.id, "prompt_text": "远程"},
        )
    assert response.status_code == 200
    first_job = response.json()["job_id"]
    first_status = client.get(f"/api/v1/tryon/jobs/{first_job}", headers={"Authorization": f"Bearer {token}"})
    assert first_status.json()["status"] == "succeeded"
    assert calls[0]["cached_user_artifact"] is None
    assert calls[0]["cached_style_artifact"] is None

    hand_photos = client.get("/api/v1/users/me/hand-photos", headers={"Authorization": f"Bearer {token}"}).json()["items"]
    reused_response = client.post(
        "/api/v1/tryon/jobs",
        headers={"Authorization": f"Bearer {token}"},
        files={
            "style_id": (None, style.id),
            "prompt_text": (None, "远程复用"),
            "saved_hand_photo_id": (None, hand_photos[0]["id"]),
        },
    )
    assert reused_response.status_code == 200
    second_job = reused_response.json()["job_id"]
    second_status = client.get(f"/api/v1/tryon/jobs/{second_job}", headers={"Authorization": f"Bearer {token}"})
    assert second_status.json()["status"] == "succeeded"
    assert calls[1]["cached_user_artifact"] is not None
    assert calls[1]["cached_style_artifact"] is not None
