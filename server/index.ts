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
  status: 'done' | 'todo'
  sticker_date?: string
}

type CandidateOut = {
  title: string
  status: 'done' | 'todo'
  sticker_date: string
}

function isValidYyyyMmDd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const t = Date.parse(`${s}T12:00:00`)
  return !Number.isNaN(t)
}

function buildSystemPrompt(anchorDate: string, clientToday: string): string {
  return `你是「贴纸日记」助手。根据用户说的话，判断是已完成的事还是待办，或需要澄清。

【当前日期上下文】（必须用于推算每条贴纸落在哪一天）
- anchorDate=${anchorDate}：用户当前在 App 里**正在查看**的日历日（yyyy-MM-dd）。用户说「今天」「这天」「今儿」记录的事 → 贴纸的 sticker_date 应取 anchorDate。
- clientToday=${clientToday}：用户设备本地的「真实今天」。仅当用户**明确**把事件锚在「现实世界的今天/明天」（与当前查看日明显不是同一天、且话里强调现实日历）时，可用 clientToday 推算「现实明天」等；**默认情况**下，用户说「明天」「后天」「昨天」等**相对日期**，一律相对 **anchorDate** 做自然日加减得到 sticker_date（例如用户正在看 4 月 17 日时说「明天去看电影」→ sticker_date 应为 4 月 18 日）。

【状态规则】
- 用户表达「今天做了」「已经完成」「去了」「做完了」等过去完成 → status 为 done
- 「打算」「计划」「提醒我」「还没」「要做」等 → todo
- 若无法判断，设置 ask_clarification 为 true，在 reply 中用一句中文问：「这件事完成了吗？」，candidates 为空数组

【贴纸标题 title — 必须具体、可辨认，禁止空泛类别词】
- 标题要「从用户原话里抽具体信息」：地名、店名、活动对象、具体行为。
- 优先保留用户提到的专有名词（公园名、餐厅名、品牌名、书名等），可略作润色，但不要改成抽象大类。
- 每个候选 title 建议 4～16 个字为宜（英文店名可保留原文）。

【贴纸日历日 sticker_date — 必填】
- 每个 candidate 必须包含 sticker_date（yyyy-MM-dd），表示该贴纸应出现在 App 的哪一天画布上。
- 用户给出具体月日（如「4月18号去看电影」）→ 换算为合理年份的 yyyy-MM-dd（可参照 anchorDate 所在年份补全）。

否则在 reply 里简短友好回应，并给出 2-3 个贴纸标题备选。

你必须只输出一个 JSON 对象，不要 markdown，不要其它文字。格式严格如下：
{"reply":"string","candidates":[{"title":"string","status":"done"|"todo","sticker_date":"yyyy-MM-dd"}],"ask_clarification":boolean}`
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

function finalizeCandidates(
  raw: CandidateParsed[] | undefined,
  anchorDate: string,
): CandidateOut[] {
  const list = (raw ?? []).slice(0, 3)
  return list.map((c) => ({
    title: c.title,
    status: c.status === 'todo' ? 'todo' : 'done',
    sticker_date:
      c.sticker_date && isValidYyyyMmDd(c.sticker_date.trim())
        ? c.sticker_date.trim()
        : anchorDate,
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
      : finalizeCandidates(data.candidates, ctx.anchorDate),
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
      : finalizeCandidates(data.candidates, ctx.anchorDate),
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
      : finalizeCandidates(data.candidates, ctx.anchorDate),
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
