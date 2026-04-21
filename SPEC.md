# Sticker Diary — 产品与技术规格（上下文快照）

> 本文档用于在对话上下文不足时快速恢复对项目的理解。**以仓库当前实现为准**；每次功能变更请同步更新本文。

---

## 1. 产品是什么

单页 Web 应用：左侧为 **280px 导航栏**（品牌、日期/待办切换、用户区），右侧为**双页并排日记画布**（相邻两个日历日；**每个日期固定落在左页或右页之一**，不随查看日左右对调）。用户可通过**底部 AI 对话**从自然语言生成贴纸备选并贴到画布；贴纸可**拖拽**、**缩放与旋转**、**双击查看详情**、**编辑（限今天及未来）**、**切换状态**、**删除**。

- 无账号、无多设备同步（v1）。
- 数据默认存浏览器 **localStorage**（含贴纸与 AI 对话历史）。

---

## 2. 已实现功能清单

### 2.1 左侧导航栏（约 280px）

- 顶部品牌区：App Logo + 应用名 `Papier`（移除“选择日期”副标题）。
- 双 Tab：`日期` / `待办`。
- **日期 Tab**：
  - 日期列表覆盖更长时间范围（相对今天约前后 120 天）；滚动区上下有渐隐遮罩，暗示可继续滚动。
  - 点击某个日期后，列表会平滑滚动并将该日期自动居中。
  - 在日期列表内滚动**仅浏览**、不自动改选日期；滚动停止约 **3 秒**无点击则平滑回中当前已选日期。
  - 通过日期选择器切换日期会触发轻微翻页音效；跨多天时按跨度播放 2~3 次短音。
  - 日期行右侧显示当日贴纸数量打点：普通贴纸（`done` / `todo`）为黄色点，Fragments（`note`）为白色点；两类点各自最多显示 3 个。
- 未来日期降低透明度（约 30%）。
  - 当前选中日期高亮。
  - 底部显示当日一句话总结：仅当天/过去日期显示；未来日期不显示。
- **待办 Tab**：
  - 汇总 `todo` 贴纸，按“未来 3 天（升序）→ 过去 1 周（降序）”排序。
  - 点击待办可跳转到对应日期。
- 底部用户区：头像/用户名入口占位。

### 2.2 双页日记视图

- 主区为书本摊开式双页：由 `spreadDatesForViewing(viewingDate)` 得到 `leftDate` / `rightDate`（相邻自然日）。**每个日历日按与固定锚点的日历日差奇偶性**（`datePageSlot`）永远落在左页或右页之一；切换查看日时，某一具体日期不会从左侧「挪到」右侧。
- 点击左页空白区域向前翻 1 天，点击右页空白区域向后翻 1 天；翻页会触发轻微翻页音效。**若当前已选中某张贴纸**，再点击纸面空白处**仅取消选中、不翻页**。
- 去掉双页区域外层额外包框，仅保留纸页与中间书脊。
- 右页默认添加 `60%` 白色蒙层弱化，突出**当前查看日所在的那一页**（该页由 `viewingDate` 等于 `leftDate` 或 `rightDate` 决定）。
- 中间书脊使用更浅的暖色渐变与明暗高光阴影，替代纯灰色直条。
- 当前被导航选中的页面日期标题使用加粗样式强调。
- 背景改为浅点状纸张纹理（`paper-dots`），呼应 Papier 氛围。

### 2.3 贴纸交互

- 每一页可独立放置贴纸并编辑；点击页内空白区域取消贴纸选中。
- **列表订阅（重要）**：`App` 使用 `useDiaryStore((s) => s.stickers)` 订阅贴纸数组，再用 `**useMemo`** 分别过滤左右两页贴纸。
- **持久化 hydration**：在 Zustand `persist` 完成**再渲染可交互画布**，避免异步 rehydration 用旧数据覆盖刚拖动的位置（贴纸「弹回原位」问题）。
- 贴纸 **Pointer** 拖拽：`pointerdown` 后在 **window** 上监听 `move/up`；起点坐标用 **ref** 同步，避免闭包读到旧位置；松手后把 `origin + 位移` 写回 store。
- 堆叠规则：每个贴纸带 `zIndex`；用户点击某贴纸 / Fragments 时会自动提升到当前最高层并持久化。
- 贴纸 **done**：实色卡片；**todo**：半透明 + 虚线边框；**note**（Fragments）：近白色底卡 + 极浅横纹（笔记纸感），标题与正文为固定字号（标题小于正文）且不随卡片缩放变化；无额外「Fragments」副标签。
- **选中 / 详情**：**单击**贴纸（短按、位移小于阈值）→ **选中**，显示无圆角的方形选中描边（`#D3BA92`）与四角 **缩放点**；**双击**贴纸**内容区**（非边框条）→ 打开详情弹窗。点击画布空白处取消选中。换日或打开详情时清除选中。
- **尺寸与旋转**：贴纸数据含 `size?: { w, h }`（px）、`rotation?: number`（顺时针度）；新建默认 **220×72**。旧存档无 `size` 时按默认宽高渲染。缩放时位移映射到贴纸**局部坐标**（随旋转角换算），长宽比自由，**最小宽 80px、最小高 40px**（`STICKER_LAYOUT`）。
- **缩放点与旋转（类 Figma）**：四角 **18×18px** 缩放点热区（可见为约 **8×8px** 的小方块，直角无圆角，边缘色 `#D3BA92`，内部白色填充）；缩放点边缘线与选中描边统一为 **1.5px**，且缩放点图层高于选中描边（避免被挡住）。指针为斜向缩放；角外侧 **约 28px** 延伸的感应区主要在贴纸外，指针为 **grab**，拖曳为**旋转**；缩放点叠在感应区之上（z-index 更高）时优先缩放。无单独「旋转按钮」。
- **边框双击重置**：选中时，沿卡片四边有 **14px** 宽的透明「边框」热区；**双击边框**将贴纸恢复为默认 **220×72** 与 **rotation: 0**；不修改未来将引入的「字体 / 样式」等字段（当前类型中亦无此类字段）。
- **文字与内边距**：标题 `word-break` / `overflow-wrap` 可换行；`padding` 由 `min(width,height)` 驱动，并在上一版基础上再放大 1 倍：**水平 ≈ 24%×minSide**（夹 26~~96px）、**垂直 ≈ 17.6%×minSide**（夹 16~~70px）。**字号**在 **8~20px** 内取**最大**仍能排进当前内盒（含「待办」行）的值：宽贴纸若横向仍有留白，不会只因变窄而缩小字，直至折行 + padding 所留空间不足以容纳当前字号时才缩小（Canvas `measureText` + 按字素折行，`layoutTypeForBox`）。
- **待办贴纸防截断**：缩放时对 `todo` 贴纸应用额外最小高约束（`minTodoStickerHeight`），保证「待办」与标题一样在同一内容容器内遵守一致 padding，不会被底边裁切。

### 2.4 贴纸详情弹窗

- 由父级 `**key={modalId}`** 挂载，切换贴纸时表单初值重置。
- **今天及未来**（`sticker.date >= 今天`，按 `yyyy-MM-dd` 字符串比较）：可编辑**标题**、**简介**，「保存修改」后写入 store 并关闭弹窗。
- **昨天及以前**：标题与简介**只读**，提示「昨日及以前的贴纸不可编辑标题与简介」。
- **已完成**：「标记为未完成」。
- **待办（未完成）**：底部横向并列 **「已完成」**（底色 `#DEBD8C`、白字，与 AI 发送按钮一致）与 **「取消待办」**（关闭弹窗）；下方为「删除贴纸」。
- **Fragments（note）**：可编辑「标题」与「内容」；提供「转为待办」与「删除贴纸」（不提供“标记为已完成”按钮）。
- **删除贴纸**（各状态）：一键移除并关闭弹窗（无二次确认）。

### 2.5 AI 对话

- 入口位于**右侧主区域底部**；与上方日记区保持同宽并留左右内边距，呈吸底悬停感，不紧贴页面边界。
- 关闭态入口采用超大圆角（`999px`）胶囊样式。
- 用户 / AI 气泡左右分布；用户气泡底色为 `#EDE3D4`。
- 打开抽屉时添加全页面暗色蒙层；点击抽屉外区域可关闭。
- “发送”按钮底色 `#DEBD8C`，文字保持白色。
- **对话历史**存 **Zustand `chatMessages`**，与贴纸一并 **persist**；再次打开抽屉时列表保留，并用 `**useLayoutEffect`** 在打开或消息变化时**滚到底部**。
- 请求走 `POST /api/chat`（Vite 开发时代理到本机 Express），**API Key 仅在服务端**，`.env` + `dotenv`。
- **请求体**：`{ messages, context: { anchorDate, clientToday } }`（均为 `yyyy-MM-dd`）。`anchorDate` = App 当前**查看日** `viewingDate`；`clientToday` = 设备本地 `todayISO()`，供 System 消歧。
- **LLM_PROVIDER**：`anthropic` | `openai` | `moonshot`（Moonshot：`baseURL` 默认 `https://api.moonshot.ai/v1`）。
- AI 返回 JSON：`reply` + `candidates[]`，每条候选含 `**title`、`status`（`done` | `todo` | `note`）、`sticker_date`**。服务端 System 要求模型区分**已完成事项 / 待办事项 / 纯记录 Fragments**；`sticker_date` 在服务端规范化时**默认回退为 `clientToday`**（与模型输出一致化）。
- 前端从候选**添加贴纸**时：**日期一律取本地「今天」`todayISO()`**（与当前 `viewingDate` 无关）；若用户正在查看其他日期，Toast 提示可切到今天查看。
- 候选卡片上展示状态文案（已完成 / 未完成 / Fragments）与「今天」日期提示。
- System prompt 另要求标题**具体**（地名、店名等），避免泛化。
- 用户点选候选贴纸：**禁止**在 `setState` 的 updater 里调用 `addSticker`（避免 React Strict Mode **重复执行**导致双贴纸）；应先 `**addSticker` 一次**，再 `**setChatMessages`** 更新气泡。
- 点选后插入**动态追问文案**：`note` 类型使用 Fragments 向短追问；`done`/`todo` 仍按事项关键词定制（电影/公园/美食等）或通用追问。下一则用户输入可写入对应贴纸 `description`。
- 点选后顶部 **Toast**：默认「「标题」已放到画布」；若当前查看日不是今天，追加可切到今天查看的提示。

### 2.6 数据与持久化

- Zustand + `persist`，键名：`sticker-diary-v1`。
- 持久化字段：`viewingDate`、`stickers`、`chatMessages`。
- 合并策略：默认 `merge` 为 `{ ...current, ...persisted }`；旧存档无 `chatMessages` 时由当前初始状态补齐。

---

## 3. 技术栈


| 类别      | 选型                                                                          |
| ------- | --------------------------------------------------------------------------- |
| 构建 / 前端 | Vite 8、React 19、TypeScript                                                  |
| 样式      | Tailwind CSS v4（`@tailwindcss/vite`） + 全局默认字体 `Noto Serif SC`（Google Fonts） |
| 状态      | Zustand + persist（localStorage）                                             |
| 日期      | date-fns（`zhCN`）                                                            |
| 后端      | Express 5、`tsx` 运行 `server/index.ts`                                        |
| LLM     | `@anthropic-ai/sdk`、`openai`（含 Moonshot 兼容）                                 |
| 环境变量    | `dotenv`                                                                    |


路径别名：`@/`* → `src/`*。

---

## 4. 仓库文件结构（要点）

```
sticker_diary/
├── SPEC.md
├── README.md
├── .env.example
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig*.json
├── server/
│   └── index.ts              # POST /api/chat（读 context，返回带 sticker_date 的 candidates）
└── src/
    ├── main.tsx
    ├── index.css
    ├── App.tsx                 # hydration 门闸、路由级 modal key
    ├── types/
    │   ├── sticker.ts
    │   └── chat.ts             # ChatMessage、ChatCandidate
    ├── store/
    │   └── useDiaryStore.ts    # stickers、chatMessages、持久化
    ├── lib/
    │   ├── date.ts             # todayISO、spreadDatesForViewing、normalizeStickerDateInput 等
    │   ├── stickerLayout.ts    # 贴纸最小尺寸、缩放点热区、padding/字号与宽度关系、屏幕位移→局部位移
    │   └── api.ts              # postChat(messages, context)
    └── components/
        ├── LeftSidebar.tsx       # 左侧导航：日期/待办 Tab、总结、用户区
        ├── DiarySpread.tsx       # 双页并排视图（按固定奇偶槽位：每个日历日固定左或右页）
        ├── DateHeader.tsx
        ├── MiniCalendar.tsx
        ├── StickerCanvas.tsx
        ├── StickerCard.tsx
        ├── StickerModal.tsx
        └── AIChatDrawer.tsx
```

---

## 5. 脚本与环境变量

- `npm run dev`：API（默认 **8787**）+ Vite（默认 **5173**）。
- `npm run build` / `npm run lint`。

环境变量见 `.env.example`（`LLM_PROVIDER`、`ANTHROPIC_`*、`OPENAI_`*、`MOONSHOT_*`、`PORT`）。

---

## 6. 核心类型

```ts
// types/sticker.ts
type Sticker = {
  id: string
  title: string
  date: string            // yyyy-MM-dd
  description: string
  status: 'done' | 'todo' | 'note'
  position: { x: number; y: number }
  type: 'text'
  size?: { w: number; h: number }
  rotation?: number       // 顺时针，度；缺省 0
}

// types/chat.ts
type ChatCandidate = { title: string; status: 'done' | 'todo' | 'note'; sticker_date?: string }
type ChatMessage =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; content: string; candidates?: ChatCandidate[] }
```

---

## 7. 刻意未实现（v2+）

- 账号登录、云端同步（如 Supabase）。
- 贴纸素材库、手绘、图片/语音输入、导出分享等。

---

## 8. 变更记录


| 日期  | 说明                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —   | 初版 v1：画布、贴纸、AI、日历、localStorage。                                                                                                                                |
| —   | 拖拽 window 级 pointer；Moonshot；dotenv；System prompt；Toast；删除贴纸。                                                                                                  |
| —   | 可编辑标题/简介（今日及未来）；hydration 门闸修复拖拽回弹；AI 对话持久化 + 滚底；修复候选贴纸重复添加；`types/chat.ts`；SPEC 同步。                                                                           |
| —   | **订阅修复**：`App` 用 `stickers` 数组 + `useMemo` 解决拖拽后不刷新；**AI 日期**：`postChat` 传 `anchorDate`/`clientToday`，候选含 `sticker_date`；`lib/date.normalizeStickerDateInput`。 |
| —   | **动态追问**：贴纸落画布后，AI 追问由固定句改为按事项类型定制（电影/公园/美食/演出/学习等），无法识别时回退通用模板。                                                                                               |
| —   | **缩放与旋转**：单击选中 + 四角缩放；角外侧区旋转；双击内容开详情；`layoutTypeForBox` 按盒适配字号；边框双击恢复默认尺寸与角度。                                                                                  |
| —   | **默认字体**：全局字体切换为 `Noto Serif SC`，并保留 `Source Han Serif SC` / `Songti SC` / `STSong` / `SimSun` / `serif` 回退链。                                                  |
| —   | **内边距与待办缩放**：padding 改为按 `min(width,height)` 计算并整体放大约 80%；`todo` 缩放时增加最小高度保护，避免「待办」被裁切。                                                                        |
| —   | **视觉微调**：内边距继续增大（约 12% / 8.8% 的 minSide 比例），并将贴纸字号上限下调到 24、下限下调到 9，使整体更留白、文字更克制。                                                                               |
| —   | **二次视觉微调**：padding 在上一版基础上再放大 1 倍（24% / 17.6% 的 minSide 比例，范围同步翻倍），并将贴纸字号范围再下调到 8~20。                                                                          |
| —   | **布局升级**：新增 280px 左侧导航栏（日期/待办 Tab、渐隐滚动、一天一句、用户区）与双页摊开视图（当前日 + 次日），保留底部 AI 对话框入口。                                                                               |
| —   | **交互微调**：移除品牌区“选择日期”副标题；日期点击后自动平滑居中；未来日期进一步淡化；AI 抽屉限制在右侧主区域底部。                                                                                                 |
| —   | **视觉细化**：重绘 Papier 折角纸风格 favicon，并将网页标题改为 `Papier`；去掉双页外框，书脊改为暖色渐变高光；AI 底部入口与双页区域对齐且保留左右留白。                                                                    |
| —   | **第三轮细调**：书脊进一步淡化；选中页日期标题加粗；右侧纸张背景铺满；AI 关闭态入口改 999px 胶囊圆角；打开后全页面蒙层并支持外部点击收起；发送按钮改为 `#DEBD8C`（白字）。                                                              |
| —   | **纸页高度调整**：双页每页最小高度由 560px 提升到 640px；页内贴纸可用区最小高度由 500px 提升到 580px。                                                                                             |
| —   | **定高与无滚动优化**：双页改为固定高度 600px（贴纸区 540px）；应用根容器与主区域改为 `h-svh + overflow-hidden`，避免整页纵向滚动；下方 AI 入口下沉间距由 `bottom-4` 调整为 `bottom-2`，并收紧日记区底部留白。                      |
| —   | **色彩与间距微调**：AI 底部入口距离底边调整为 28px；左侧日期/待办 Tab 底色改为 `#DCD5CB`；日期选择器选中项底色同步为 `#DCD5CB`（文字色保持不变）；AI 输入框 focus 高亮边框与 ring 改为 `#DCD5CB`。                              |
| —   | **图标与拖动边界修复**：左上品牌图标改为用户提供的新 PNG（`/papier-icon.png`）；贴纸拖动改为实时边界钳制，碰到页面边缘后该方向停止移动，但另一方向仍可继续拖动。                                                                  |
| —   | **侧栏日期体验优化**：左上角图标放大到 `40x40`；日期/待办 Tab 底色改为 `#E2DDD4`；日期选中底色改为 `#E7E2DA`（文字色保持不变）；日期列表加入月份分界标记（如 `MAY`，灰色小字号，占一行高度）；移除滚轮自动选日，改为仅滚动浏览，并在滚动停止 5 秒后平滑回中当前已选日期。   |
| —   | **圆角与月份标签细调**：双页日记纸四角统一改为约 `20px` 圆角，并上调日期栏内边距以保证与边缘留白；日期列表自动回中等待时间由 5 秒缩短到 3 秒；月份分界标签改为完整月份全称（如 `APRIL`）、字号再降 2 号、使用 `Helvetica Neue` 无衬线并降低灰度。               |
| —   | **书脊内角修正**：去掉双页靠近书脊的四个内角圆角，仅保留外侧四角 `20px` 圆角（左页仅左侧圆角，右页仅右侧圆角）。                                                                                                 |
| —   | **双页日期槽位与 AI Fragments**：每个日历日按固定规则永远落在左页或右页（`spreadDatesForViewing`）；从 AI 候选添加的贴纸日期一律为本地「今天」；贴纸 `status` 增加 `note`（便签式 Fragments），服务端 JSON 与 UI 候选支持三态识别。     |
| —   | **Fragments 字体/样式与层级**：Fragments 改为固定字号（标题小于正文，不随缩放变化）；缩小时正文按可用行数自动 `...` 截断；去掉「Fragments」标签；底色改近白并加入浅横纹；点击任意贴纸或 Fragments 自动置顶（`zIndex` 提升）。                  |
| —   | **翻页交互与音效**：支持点击左/右页空白分别向前/向后翻页；日期选择器翻页也播放轻翻页音效；日期跨度较大时按距离播放 2~3 次短音。                                                                                          |
| —   | **翻页音频资源替换**：翻页音效由 WebAudio 合成改为静态 MP3 文件映射（统一放在 `public/audio/`；1 次：`单页翻页音效.MP3`，2 次：`翻2次音效.MP3`，3 次：`翻3次音效.MP3`）。                                            |


