# 焕甲 GPU Try-on Service

独立部署在 GPU 机器上的 FastAPI 服务。手机端不直接访问它，主 API 服务通过 `REMOTE_GPU_TRYON_URL` 调用。

```bash
cd services/gpu
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
OPENAI_API_KEY=... OPENAI_BASE_URL=... uvicorn app:app --host 0.0.0.0 --port 8100
```

主 API `.env`:

```bash
REMOTE_GPU_TRYON_URL=http://<gpu-host>:8100/v1/tryon/render
REMOTE_GPU_TRYON_API_KEY=
```

SAM3.1 可通过 HTTP 服务接入：

```bash
SAM31_ENDPOINT=http://<sam-host>:8200/v1/segment
```

如果未配置 `SAM31_ENDPOINT`，服务会使用 box-mask fallback，方便联调接口；生产环境应替换为真实 SAM3.1。
