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

## 后续（v2）

云端同步可考虑 Supabase；贴纸素材库与 AI 绘图在 spec 中已标为后续版本。
