import 'dotenv/config'

import Anthropic from '@anthropic-ai/sdk'
import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'

const PORT = Number(process.env.PORT) || 8787
const provider = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase()

type ChatContextBody = {
  anchorDate: string
  clientToday: string
}

type CandidateParsed = {
  title: string
  status: 'done' | 'todo' | 'note'
  sticker_date?: string
}

type CandidateOut = {
  title: string
  status: 'done' | 'todo' | 'note'
  sticker_date: string
}

function isValidYyyyMmDd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const t = Date.parse(`${s}T12:00:00`)
  return !Number.isNaN(t)
}

function buildSystemPrompt(anchorDate: string, clientToday: string): string {
  return `你是「Papier / 贴纸日记」助手。根据用户说的话，判断是：已完成事项、待办事项、还是只想把一段话记下来（Fragments 便签），或需要澄清。

【当前日期上下文】
- anchorDate=${anchorDate}：用户当前在 App 里**正在查看**的日历日（yyyy-MM-dd）。用于理解用户说「这天」「正在看的那天」等叙事。
- clientToday=${clientToday}：用户设备本地的「真实今天」（yyyy-MM-dd）。**凡是要落到画布上的贴纸**，sticker_date 一律填 clientToday（客户端会把贴纸放到「今天」那一页，与当前查看日无关）。

【状态 status — 三选一】
- done：用户明确表达某件**具体任务/活动**已经完成（做了、去了、做完了、打卡了等）。
- todo：用户明确表达**具体任务/活动**尚未完成、计划去做、需要提醒（打算、计划、提醒我、还没、要做、待办等）。
- note：用户主要是在**记录一段想法、摘抄、心情、金句、随笔（Fragments）**，而不是在标记某个可勾选任务的完成/未完成。此时 title 用简短主题词（可从原文提炼），不要把整段话塞进 title；用户原话会由客户端写入便签内容。
- 若无法区分「任务」与「纯记录」，设置 ask_clarification 为 true，在 reply 里用一句中文追问（例如：想记成待办/已完成，还是只当 Fragments？），candidates 为空数组。

【贴纸标题 title — 必须具体、可辨认，禁止空泛类别词】
- 对 done/todo：从用户原话里抽具体信息（地名、店名、活动对象、具体行为）。
- 对 note：用 2～12 字的简短标题概括这段话（如「今日随笔」「书里一句话」），不要整段粘贴。
- 每个候选 title 建议 4～16 个字为宜（英文可保留原文）。

【贴纸日历日 sticker_date — 必填】
- 每个 candidate 必须包含 sticker_date（yyyy-MM-dd）。**一律填 clientToday（${clientToday}）**。

否则在 reply 里简短友好回应，并给出 2-3 个贴纸标题备选。

你必须只输出一个 JSON 对象，不要 markdown，不要其它文字。格式严格如下：
{"reply":"string","candidates":[{"title":"string","status":"done"|"todo"|"note","sticker_date":"yyyy-MM-dd"}],"ask_clarification":boolean}`
}

function parseJsonFromAssistant(text: string): {
  reply: string
  candidates: CandidateParsed[]
  ask_clarification: boolean
} {
  const trimmed = text.trim()
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as {
        reply: string
        candidates: CandidateParsed[]
        ask_clarification: boolean
      }
    } catch {
      return null
    }
  }
  let parsed = tryParse(trimmed)
  if (parsed) return parsed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) {
    parsed = tryParse(fence[1].trim())
    if (parsed) return parsed
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    parsed = tryParse(trimmed.slice(start, end + 1))
    if (parsed) return parsed
  }
  throw new Error('无法解析模型返回的 JSON')
}

function normalizeCandidateStatus(
  s: CandidateParsed['status'] | undefined,
): CandidateOut['status'] {
  if (s === 'todo') return 'todo'
  if (s === 'note') return 'note'
  return 'done'
}

function finalizeCandidates(
  raw: CandidateParsed[] | undefined,
  clientToday: string,
): CandidateOut[] {
  const list = (raw ?? []).slice(0, 3)
  return list.map((c) => ({
    title: c.title,
    status: normalizeCandidateStatus(c.status),
    sticker_date:
      c.sticker_date && isValidYyyyMmDd(c.sticker_date.trim())
        ? c.sticker_date.trim()
        : clientToday,
  }))
}

async function chatAnthropic(
  messages: { role: 'user' | 'assistant'; content: string }[],
  ctx: ChatContextBody,
): Promise<{ reply: string; candidates: CandidateOut[] }> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('缺少 ANTHROPIC_API_KEY')
  const client = new Anthropic({ apiKey: key })
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    system: buildSystemPrompt(ctx.anchorDate, ctx.clientToday),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })
  const block = res.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('模型无文本回复')
  const data = parseJsonFromAssistant(block.text)
  return {
    reply: data.reply,
    candidates: data.ask_clarification
      ? []
      : finalizeCandidates(data.candidates, ctx.clientToday),
  }
}

async function chatOpenAI(
  messages: { role: 'user' | 'assistant'; content: string }[],
  ctx: ChatContextBody,
): Promise<{ reply: string; candidates: CandidateOut[] }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('缺少 OPENAI_API_KEY')
  const client = new OpenAI({ apiKey: key })
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
  const res = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(ctx.anchorDate, ctx.clientToday),
      },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
  })
  const text = res.choices[0]?.message?.content
  if (!text) throw new Error('模型无回复')
  const data = parseJsonFromAssistant(text)
  return {
    reply: data.reply,
    candidates: data.ask_clarification
      ? []
      : finalizeCandidates(data.candidates, ctx.clientToday),
  }
}

async function chatMoonshot(
  messages: { role: 'user' | 'assistant'; content: string }[],
  ctx: ChatContextBody,
): Promise<{ reply: string; candidates: CandidateOut[] }> {
  const key = process.env.MOONSHOT_API_KEY
  if (!key) throw new Error('缺少 MOONSHOT_API_KEY')
  const client = new OpenAI({
    apiKey: key,
    baseURL:
      process.env.MOONSHOT_BASE_URL ?? 'https://api.moonshot.ai/v1',
  })
  const model = process.env.MOONSHOT_MODEL ?? 'moonshot-v1-8k'
  const res = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(ctx.anchorDate, ctx.clientToday),
      },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
    temperature: 0.3,
  })
  const text = res.choices[0]?.message?.content
  if (!text) throw new Error('模型无回复')
  const data = parseJsonFromAssistant(text)
  return {
    reply: data.reply,
    candidates: data.ask_clarification
      ? []
      : finalizeCandidates(data.candidates, ctx.clientToday),
  }
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

app.post('/api/chat', async (req, res) => {
  try {
    const body = req.body as {
      messages?: { role: string; content: string }[]
      context?: { anchorDate?: string; clientToday?: string }
    }
    const messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 必填' })
      return
    }
    const anchor =
      typeof body.context?.anchorDate === 'string' &&
      isValidYyyyMmDd(body.context.anchorDate)
        ? body.context.anchorDate
        : new Date().toISOString().slice(0, 10)
    const clientToday =
      typeof body.context?.clientToday === 'string' &&
      isValidYyyyMmDd(body.context.clientToday)
        ? body.context.clientToday
        : anchor
    const ctx: ChatContextBody = { anchorDate: anchor, clientToday }

    const normalized = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content ?? ''),
      }))
    const out =
      provider === 'openai'
        ? await chatOpenAI(normalized, ctx)
        : provider === 'moonshot'
          ? await chatMoonshot(normalized, ctx)
          : await chatAnthropic(normalized, ctx)
    res.json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '服务器错误'
    console.error(e)
    res.status(500).json({ error: msg })
  }
})

app.listen(PORT, () => {
  console.log(`Sticker Diary API http://localhost:${PORT} (LLM_PROVIDER=${provider})`)
})
