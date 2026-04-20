import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { postChat } from '@/lib/api'
import {
  formatStickerDate,
  normalizeStickerDateInput,
  todayISO,
} from '@/lib/date'
import { useDiaryStore } from '@/store/useDiaryStore'
import type { ChatCandidate, ChatMessage } from '@/types/chat'

function genMsgId(): string {
  return crypto.randomUUID()
}

function buildFollowupQuestion(title: string, userLine: string): string {
  const text = `${title} ${userLine}`.toLowerCase()

  if (/(电影|影院|看了|观影|首映|imx|3d)/.test(text)) {
    return '要补充一点描述吗？比如电影怎么样？'
  }
  if (/(公园|草地|湖边|散步|徒步|爬山|郊游)/.test(text)) {
    return '要补充一点描述吗？比如那里美吗？'
  }
  if (/(餐|炸鸡|火锅|咖啡|奶茶|吃了|试了|饭店|raising cane)/.test(text)) {
    return '要补充一点描述吗？比如味道怎么样？'
  }
  if (/(演唱会|音乐会|live|剧场|话剧|展览|博物馆)/.test(text)) {
    return '要补充一点描述吗？比如现场氛围怎么样？'
  }
  if (/(学习|复习|读书|课程|考试|刷题|写作业|项目)/.test(text)) {
    return '要补充一点描述吗？比如你最大的收获是什么？'
  }

  return `要补充一点描述吗？比如「${title}」里最值得记的一点是什么？`
}

export function AIChatDrawer() {
  const id = useId()
  const viewingDate = useDiaryStore((s) => s.viewingDate)
  const addSticker = useDiaryStore((s) => s.addSticker)
  const updateSticker = useDiaryStore((s) => s.updateSticker)
  const chatMessages = useDiaryStore((s) => s.chatMessages)
  const setChatMessages = useDiaryStore((s) => s.setChatMessages)

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pendingDescId, setPendingDescId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    scrollToBottom()
  }, [open, chatMessages, scrollToBottom])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const sendUser = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text) return
      setErr(null)

      if (pendingDescId) {
        updateSticker(pendingDescId, {
          description: text,
        })
        setChatMessages((m) => [
          ...m,
          { id: genMsgId(), role: 'user', content: text },
          {
            id: genMsgId(),
            role: 'assistant',
            content: '好的，已经记下来了。',
          },
        ])
        setPendingDescId(null)
        setInput('')
        return
      }

      const base = useDiaryStore.getState().chatMessages
      const next: ChatMessage[] = [
        ...base,
        { id: genMsgId(), role: 'user', content: text },
      ]
      setChatMessages(next)
      setInput('')
      setLoading(true)
      try {
        const history = next.map((x) => ({
          role: x.role,
          content: x.content,
        }))
        const res = await postChat(history, {
          anchorDate: viewingDate,
          clientToday: todayISO(),
        })
        setChatMessages((m) => [
          ...m,
          {
            id: genMsgId(),
            role: 'assistant',
            content: res.reply,
            candidates:
              res.candidates.length > 0 ? res.candidates : undefined,
          },
        ])
      } catch (e) {
        setErr(e instanceof Error ? e.message : '发送失败')
      } finally {
        setLoading(false)
      }
    },
    [pendingDescId, setChatMessages, updateSticker, viewingDate],
  )

  const pickCandidate = useCallback(
    (c: ChatCandidate) => {
      const prev = useDiaryStore.getState().chatMessages
      const lastUser = [...prev].reverse().find((x) => x.role === 'user')
      const userLine =
        lastUser?.role === 'user' ? lastUser.content : ''

      const stickerDate = normalizeStickerDateInput(
        c.sticker_date,
        viewingDate,
      )

      const newId = addSticker({
        title: c.title,
        date: stickerDate,
        description: userLine,
        status: c.status,
      })
      const dateHint =
        stickerDate !== viewingDate
          ? `（${formatStickerDate(stickerDate)}，可切日期查看）`
          : ''
      setToast(`「${c.title}」已放到画布${dateHint}`)
      setPendingDescId(newId)

      const followup = buildFollowupQuestion(c.title, userLine)
      setChatMessages((p) => {
        const cleared = p.map((x) =>
          x.role === 'assistant' &&
          'candidates' in x &&
          x.candidates?.length
            ? { ...x, candidates: undefined }
            : x,
        )
        return [
          ...cleared,
          {
            id: genMsgId(),
            role: 'assistant',
            content: followup,
          },
        ]
      })
    },
    [addSticker, setChatMessages, viewingDate],
  )

  return (
    <>
      {toast && (
        <div
          className="fixed top-4 left-1/2 z-[60] max-w-[min(90vw,360px)] -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-2.5 text-center text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}

      {!open && (
        <button
          type="button"
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-amber-900/10 bg-[#fdfbf7]/95 px-4 py-3 text-left text-sm text-stone-500 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md"
          onClick={() => setOpen(true)}
        >
          和 AI 聊聊今天的事…
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-black/40"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="mt-auto flex max-h-[85vh] flex-col rounded-t-2xl bg-[#fdfbf7] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-amber-900/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-stone-900" id={id}>
                和 AI 聊聊
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
                onClick={() => setOpen(false)}
              >
                收起
              </button>
            </div>

            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
              aria-labelledby={id}
            >
              {chatMessages.length === 0 && (
                <p className="text-center text-sm text-stone-500">
                  说说今天做了什么，或打算做什么…
                </p>
              )}
              {chatMessages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                  }
                >
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-md bg-amber-600 px-3 py-2 text-sm text-white'
                        : 'max-w-[90%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm text-stone-800 shadow-sm ring-1 ring-stone-200/80'
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === 'assistant' &&
                      m.candidates &&
                      m.candidates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.candidates.map((c) => (
                            <button
                              key={`${c.title}-${c.status}-${c.sticker_date ?? ''}`}
                              type="button"
                              className="rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-left text-xs text-stone-800 transition hover:border-amber-400"
                              onClick={() => pickCandidate(c)}
                            >
                              <span className="font-medium">{c.title}</span>
                              <span className="mt-0.5 block text-[10px] text-stone-500">
                                {c.status === 'done' ? '已完成' : '未完成'}
                                {c.sticker_date ? (
                                  <>
                                    {' · '}
                                    {formatStickerDate(
                                      normalizeStickerDateInput(
                                        c.sticker_date,
                                        viewingDate,
                                      ),
                                    )}
                                  </>
                                ) : null}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              ))}
              {loading && (
                <p className="text-sm text-stone-500">AI 正在想…</p>
              )}
              {err && <p className="text-sm text-red-600">{err}</p>}
            </div>

            <form
              className="border-t border-amber-900/10 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                void sendUser(input)
              }}
            >
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder={
                    pendingDescId
                      ? '补充一点描述…'
                      : '我今天去公园散步了'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={loading || !input.trim()}
                >
                  发送
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
