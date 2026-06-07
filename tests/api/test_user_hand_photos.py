from __future__ import annotations

from PIL import Image

from app.utils.files import path_from_public_url


def _create_user(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"phone": "13900002222", "password": "secret123", "username": "hand-user"},
    )
    data = response.json()
    return data["access_token"]


def test_upload_hand_photo_segments_and_saves_artifact(client, image_factory, app_env, monkeypatch):
    token = _create_user(client)

    from app.routers.users import hand_photo_service

    segment_calls = []

    def mock_segment(image_path):
        segment_calls.append(str(image_path))
        mask_path = image_path.parent / f"{image_path.stem}_mock_mask.png"
        mask_path.write_bytes(image_factory("mock-mask.png").read_bytes())
        return type(
            "Segmentation",
            (),
            {"mask_path": mask_path, "roi_boxes": [{"x": 10, "y": 12, "width": 24, "height": 20}], "confidence": 0.91},
        )()

    monkeypatch.setattr(hand_photo_service.segmentation_service, "segment", mock_segment)

    image_path = image_factory("hand-upload.png")
    with image_path.open("rb") as hand_file:
        response = client.post(
            "/api/v1/users/me/hand-photos",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("hand.png", hand_file.read(), "image/png")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["processing_status"] == "succeeded"
    assert data["mask_url"]
    assert data["cutout_url"]
    assert data["roi_boxes"] == [{"x": 10, "y": 12, "width": 24, "height": 20}]
    assert data["quality_score"] == 0.91
    assert len(segment_calls) == 1
    mask_path = path_from_public_url(data["mask_url"])
    assert mask_path is not None
    mask = Image.open(mask_path)
    hand = Image.open(image_path)
    assert mask.format == "PNG"
    assert mask.mode == "RGBA"
    assert "A" in mask.getbands()
    assert mask.size == hand.size

    with image_path.open("rb") as hand_file:
        duplicate = client.post(
            "/api/v1/users/me/hand-photos",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("hand.png", hand_file.read(), "image/png")},
        )

    assert duplicate.status_code == 200
    assert duplicate.json()["id"] == data["id"]
    assert duplicate.json()["processing_status"] == "succeeded"
    assert len(segment_calls) == 1


def test_upload_hand_photo_requires_reupload_when_no_nails_detected(client, image_factory, monkeypatch):
    token = _create_user(client)

    from app.routers.users import hand_photo_service

    def mock_segment(image_path):
        mask_path = image_path.parent / f"{image_path.stem}_empty_mask.png"
        mask_path.write_bytes(image_factory("empty-mask.png").read_bytes())
        return type(
            "Segmentation",
            (),
            {"mask_path": mask_path, "roi_boxes": [], "confidence": 0.0},
        )()

    monkeypatch.setattr(hand_photo_service.segmentation_service, "segment", mock_segment)

    image_path = image_factory("hand-without-clear-nails.png")
    with image_path.open("rb") as hand_file:
        response = client.post(
            "/api/v1/users/me/hand-photos",
            headers={"Authorization": f"Bearer {token}"},
            files={"image": ("hand.png", hand_file.read(), "image/png")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["processing_status"] == "failed"
    assert data["mask_url"] is None
    assert data["cutout_url"] is None
    assert data["roi_boxes"] == []
    assert "重新上传" in data["error_message"]
