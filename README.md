# Sticker Diary（v1）

纸质风画布日记：按日管理贴纸（待办 / 已完成），与 AI 对话生成贴纸备选，数据默认保存在浏览器 `localStorage`。

**产品与技术细节（给协作者 / AI 上下文）：请读 [SPEC.md](./SPEC.md)。**

## 本地运行

1. 安装依赖：`npm install`
2. **配置 AI 密钥（对话功能需要）**  
   - 复制：`cp .env.example .env`，在项目根目录编辑 `.env`。  
   - **Moonshot（Kimi）**：`LLM_PROVIDER=moonshot`、`MOONSHOT_API_KEY=你的密钥`（默认请求 `https://api.moonshot.ai/v1`；若需国内节点可设 `MOONSHOT_BASE_URL=https://api.moonshot.cn/v1`）。  
   - **Anthropic**：`ANTHROPIC_API_KEY=sk-ant-...`（不设 `LLM_PROVIDER` 时默认走 Anthropic）。  
   - **OpenAI**：`LLM_PROVIDER=openai`、`OPENAI_API_KEY=sk-...`  
3. 启动：`npm run dev`（改完 `.env` 后需重启一次）  
4. 浏览器打开终端里提示的地址（一般为 `http://localhost:5173`）。

`npm run dev` 会通过 Vite 把 `/api` 代理到 `http://localhost:8787` 上的 Express 服务，避免把 API Key 打进前端包。

## 构建

```bash
npm run build
```

产物在 `dist/`。部署静态前端时，需要单独部署 `server/index.ts` 对应的 Node 服务或使用 Serverless，并把前端的 `/api` 指向该服务。

## 线上部署（Vercel + Render）

推荐拆成两部分：
- **Render** 托管 `server/index.ts`（对外提供 `/api/chat`）
- **Vercel** 托管 `dist/`（前端页面）

### 1) 先部署 Render（后端）

1. 在 Render 新建 **Web Service**，连接本仓库（目录选 `sticker_diary`）。
2. Runtime 选 **Node**。
3. Build Command：`npm install`
4. Start Command：`npm run start`
5. 在 Render 的 Environment 里配置：
   - `LLM_PROVIDER`（`anthropic` / `openai` / `moonshot`）
   - 对应的 API Key（如 `ANTHROPIC_API_KEY`）
   - 可选模型变量（如 `ANTHROPIC_MODEL`）
   - `PORT` 不填也可（Render 会自动注入）
6. 部署成功后拿到后端地址，例如：`https://papier-api.onrender.com`

### 2) 再部署 Vercel（前端）

1. 在 Vercel 新建项目，连接同一个仓库，Root Directory 选 `sticker_diary`。
2. Build Command：`npm run build`
3. Output Directory：`dist`
4. 在 Vercel 项目环境变量添加：
   - `VITE_API_BASE_URL=https://你的-render-域名`
5. 触发部署，拿到前端地址（例如 `https://papier.vercel.app`）。

### 3) 发布后检查

- 打开前端链接，确认页面可访问；
- 在 AI 对话里问一个普通问题（例如“西雅图在哪里”）应能正常回答；
- 再试一个待办句子，确认候选贴纸可生成。

> 说明：当前数据仍是浏览器 `localStorage`，不同设备之间不会自动同步（符合 v1 设计）。

## 后续（v2）

云端同步可考虑 Supabase；贴纸素材库与 AI 绘图在 spec 中已标为后续版本。
