# 焕甲

焕甲是一个面向美团 AI 黑客松的美甲试戴 MVP，当前包含用户端、商家端、FastAPI 后端、运营后台和数据脚本。

## 仓库结构

```text
apps/
  mobile/      # Expo / React Native App
  ops-web/     # 运营后台
services/
  api/         # FastAPI 后端
scripts/       # 种子导入、元数据、demo 指标、日报脚本
data/          # 种子图、上传图、试戴结果、报告
openclaw/      # OpenClaw skill 模板
```

## 1. 前置依赖

本地需要：

- Docker Desktop
- Node.js 18+ / npm
- Expo Go：真机演示时安装在 iPhone 上

可选能力：

- `OPENAI_API_KEY`：真实 AI 焕甲生成需要
- 高德 Web 服务 Key：真实市场门店数据需要
- 远程 GPU 服务：MediaPipe / SAM / 图片融合流水线需要

## 2. 准备环境变量

在仓库根目录执行：

```bash
cp .env.example .env
```

最少需要确认这些变量：

```bash
OPENAI_API_KEY=replace_me
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

如果用 iPhone 真机扫码访问，`127.0.0.1` 指的是手机自己，不是你的 Mac。此时把 `.env` 里的 API 地址改成 Mac 的局域网 IP：

```bash
ipconfig getifaddr en0
```

假设输出是 `10.31.206.237`，则改成：

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.31.206.237:8000/api/v1
```

修改 `.env` 后需要重启 Expo。

## 3. 启动后端、数据库、运营后台

在仓库根目录执行：

```bash
docker compose up --build -d postgres redis api ops-web
```

启动后访问：

- API: `http://127.0.0.1:8000`
- API 文档: `http://127.0.0.1:8000/docs`
- 运营后台: `http://127.0.0.1:4173`

当前 `docker-compose.yml` 只把 API 和运营后台绑定到 `127.0.0.1`，默认仅允许本机访问，不暴露给局域网或公网。Postgres 和 Redis 不暴露宿主机端口，只在 Docker 内部网络访问。

查看日志：

```bash
docker compose logs -f api
```

## 4. 初始化演示数据

后端容器启动后，在仓库根目录执行：

```bash
docker compose exec api python /workspace/scripts/seed_from_xlsx.py --xlsx /workspace/命题三美甲评测数据（对外版）.xlsx
docker compose exec api python /workspace/scripts/enrich_style_metadata.py
docker compose exec api python /workspace/scripts/generate_demo_metrics.py --days 7
docker compose exec api python /workspace/scripts/generate_ops_report.py
```

说明：

- 第一条会从 xlsx 导入首页美甲图和测试资产。
- 第二条会补齐标题、标签、文案等展示字段。
- 第三条会生成运营后台演示指标。
- 第四条会生成今日运营日报。

如果只是重启服务，已经初始化过的数据不需要每次重新导入。

## 5. 启动移动端

新开一个终端：

```bash
cd apps/mobile
npm install
npx expo start
```

常用打开方式：

- iPhone 真机：用 Expo Go 扫终端二维码
- iOS 模拟器：在 Expo 终端按 `i`
- Android 模拟器：在 Expo 终端按 `a`
- Web 调试：执行 `npm run web`

如果 Metro 缓存异常：

```bash
npx expo start --clear
```

## 6. 演示账号

登录页可切换“我是用户 / 我是商家”。

用户端：

```text
手机号：13886722665
密码：admin@123456
短信验证码：666666
```

商家端：

```text
手机号：13886722666
密码：admin@123456
短信验证码：666666
```

当前约定：

- 用户端：浏览、市场、问问小嘉、消息、我的订单、喜爱、手图管理、焕甲记录。
- 商家端：浏览、预约、发布、消息、我的商户信息。
- 商家发布的美甲会自动归属到商家默认店铺。

## 7. 常见问题

### 打开网页看到一大段 JSON

你打开的是 Expo 的 `exp://...` manifest，不是 Web 页面。真机应使用 Expo Go 扫码；Web 调试请在 `apps/mobile` 下执行：

```bash
npm run web
```

### iPhone 真机请求不到后端

检查 `.env`：

```bash
EXPO_PUBLIC_API_BASE_URL=http://你的Mac局域网IP:8000/api/v1
```

然后重启 Expo：

```bash
npx expo start --clear
```

### 端口被占用

API 默认占用 `8000`，Expo 默认占用 `8081`。Expo 提示换端口时可以选择 `yes`，但真机扫码时以后端 API 地址为准。

### 市场页没有真实店铺

需要在 `.env` 配置高德 Web 服务 Key：

```bash
GAODE_API_KEY=你的高德Web服务Key
```

市场页定位优先级为：手机 GPS > 用户输入城市/区县/商圈 > 默认深圳。默认 GPS 场景走高德周边搜索，用户输入地点时走高德关键字搜索；搜索关键词固定为“美甲”，不使用 IP 定位。

没有可用 Key 或高德接口失败时，市场页会展示不可用提示，不再使用 mock 门店数据。

### AI 焕甲失败

真实生成需要至少配置一种生成能力：

```bash
OPENAI_API_KEY=...
```

或配置远程 GPU 服务：

```bash
REMOTE_GPU_TRYON_URL=...
REMOTE_GPU_TRYON_API_KEY=...
```

## 8. 停止与重置

停止后端、数据库和运营后台：

```bash
docker compose down
```

停止 Expo：在 Expo 终端按 `Ctrl+C`。

完全清空数据库重新开始：

```bash
docker compose down -v
docker compose up --build -d postgres redis api ops-web
```

注意：`docker compose down -v` 会删除 PostgreSQL volume，数据库里的用户、点赞、评论、预约等都会丢失。

## 9. 测试

后端测试：

```bash
./.venv/bin/pytest
```

移动端类型检查：

```bash
cd apps/mobile
npx tsc --noEmit
```

## 10. 推荐演示顺序

1. 启动 Docker 服务。
2. 初始化 xlsx 种子、元数据、demo 指标和运营日报。
3. 启动 Expo。
4. 用户端演示：浏览、同城、详情、评论、焕甲、私信商家、我的订单。
5. 商家端演示：发布美甲、预约管理、消息回复、商户信息。
6. 运营后台演示：概览、报告、表现分析、任务日志。
