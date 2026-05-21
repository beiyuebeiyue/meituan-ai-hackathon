from __future__ import annotations

import importlib.util
import json
import sys
import types
import zipfile
from pathlib import Path

from PIL import Image


def load_script():
    path = Path(__file__).resolve().parents[2] / "scripts" / "build_xhs_standard_nail_embeddings_remote.py"
    spec = importlib.util.spec_from_file_location("build_xhs_standard_nail_embeddings_remote", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def make_assets(tmp_path: Path) -> Path:
    assets_dir = tmp_path / "assets"
    image_dir = assets_dir / "20260520" / "images" / "note-1"
    image_dir.mkdir(parents=True)
    image_path = image_dir / "note-1_01.png"
    Image.new("RGB", (16, 16), (255, 180, 180)).save(image_path)
    (assets_dir / "xhs_image_features.json").write_text(
        json.dumps(
            {
                "items": [
                    {
                        "note_id": "note-1",
                        "run_dir": "20260520",
                        "image_path": "20260520/images/note-1/note-1_01.png",
                        "status": 200,
                        "features": {
                            "hand": {"skin_undertone": "暖", "finger_shape": "修长"},
                            "nail": {"shape": "椭圆", "length": "中", "colors": ["粉色"]},
                        },
                    },
                    {
                        "note_id": "note-2",
                        "run_dir": "20260520",
                        "image_path": "20260520/images/note-2/missing.png",
                        "status": 200,
                    },
                    {
                        "note_id": "note-3",
                        "run_dir": "20260520",
                        "image_path": "20260520/images/note-1/note-1_01.png",
                        "status": 422,
                    },
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return assets_dir


def test_package_standard_nail_images(tmp_path):
    script = load_script()
    assets_dir = make_assets(tmp_path)
    output = tmp_path / "package.zip"

    summary = script.package_standard_nail_images(assets_dir, output)

    assert summary == {"written": 1, "skipped": 2}
    with zipfile.ZipFile(output) as archive:
        names = set(archive.namelist())
        assert "images/000000_note-1.png" in names
        metadata = [json.loads(line) for line in archive.read("metadata.jsonl").decode("utf-8").splitlines()]
    assert metadata[0]["note_id"] == "note-1"
    assert metadata[0]["features"]["hand"]["skin_undertone"] == "暖"


def test_call_gradio_and_extracts_embedding_zip(tmp_path, monkeypatch):
    script = load_script()
    package_path = tmp_path / "package.zip"
    package_path.write_bytes(b"placeholder")
    returned_zip = tmp_path / "remote_result.zip"
    with zipfile.ZipFile(returned_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("xhs_standard_nail.faiss", b"fake")
        archive.writestr(
            "xhs_standard_nail_manifest.json",
            json.dumps({"model": "Qwen/Qwen3-VL-Embedding-2B", "dimension": 512, "count": 1}),
        )
        archive.writestr("xhs_standard_nail_metadata.jsonl", json.dumps({"row": 0, "note_id": "note-1"}) + "\n")

    calls = {}

    class FakeClient:
        def __init__(self, space_id, **kwargs):
            calls["space_id"] = space_id
            calls["kwargs"] = kwargs

        def predict(self, uploaded_file, embedding_dimension, api_name):
            calls["uploaded_file"] = uploaded_file
            calls["embedding_dimension"] = embedding_dimension
            calls["api_name"] = api_name
            return "ok", str(returned_zip)

    fake_module = types.SimpleNamespace(Client=FakeClient, handle_file=lambda value: {"path": value})
    monkeypatch.setitem(sys.modules, "gradio_client", fake_module)

    status, file_path = script.call_gradio(
        "dongli/nail_embedder",
        package_path,
        "/build_xhs_standard_nail_embeddings",
        "token",
        512,
    )
    output_dir = tmp_path / "embeddings"
    script.safe_extract_zip(file_path, output_dir)
    validation = script.validate_embedding_output(output_dir, expected_embedding_dimension=512)

    assert status == "ok"
    assert calls["space_id"] == "dongli/nail_embedder"
    assert calls["api_name"] == "/build_xhs_standard_nail_embeddings"
    assert calls["embedding_dimension"] == 512
    assert calls["kwargs"] == {"token": "token"}
    assert validation == {"count": 1, "model": "Qwen/Qwen3-VL-Embedding-2B", "dimension": 512}


def test_validate_embedding_output_rejects_wrong_dimension(tmp_path):
    script = load_script()
    output_dir = tmp_path / "embeddings"
    output_dir.mkdir()
    (output_dir / "xhs_standard_nail.faiss").write_bytes(b"fake")
    (output_dir / "xhs_standard_nail_manifest.json").write_text(
        json.dumps({"model": "Qwen/Qwen3-VL-Embedding-2B", "dimension": 1024, "count": 1}),
        encoding="utf-8",
    )
    (output_dir / "xhs_standard_nail_metadata.jsonl").write_text(
        json.dumps({"row": 0, "note_id": "note-1"}) + "\n",
        encoding="utf-8",
    )

    try:
        script.validate_embedding_output(output_dir, expected_embedding_dimension=512)
    except ValueError as exc:
        assert "Expected embedding dimension 512, got 1024" in str(exc)
    else:
        raise AssertionError("Expected dimension mismatch to fail")
