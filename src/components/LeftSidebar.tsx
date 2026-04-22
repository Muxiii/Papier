import { format, parseISO } from 'date-fns'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { shiftDateISO, todayISO } from '@/lib/date'
import type { Sticker } from '@/types/sticker'

type Props = {
  viewingDate: string
  stickers: Sticker[]
  onSelectDate: (date: string, source?: 'date' | 'todo') => void
  /** 抽屉内：显示关闭并回调 */
  mode?: 'inline' | 'drawer'
  onClose?: () => void
  /** 与 `mode=inline` 搭配：由父级控制宽度（如 style={{ width }}） */
  className?: string
  style?: CSSProperties
}

type TabKey = 'date' | 'todo'

function formatTabDate(dateISO: string): string {
  const d = parseISO(`${dateISO}T12:00:00`)
  return format(d, 'MMM d')
}

function daySummary(dateISO: string, stickers: Sticker[]): string {
  const today = todayISO()
  if (dateISO > today) return ''
  const day = stickers.filter((s) => s.date === dateISO)
  const withDesc = day.find((s) => s.description.trim().length > 0)
  if (withDesc) return `- ${withDesc.description.trim()}`
  if (day.length === 0) {
    return dateISO === today ? '- 今天会是快乐的一天' : '- 这一天还没有记录'
  }
  const todo = day.filter((s) => s.status === 'todo').length
  const done = day.filter((s) => s.status === 'done').length
  if (done > 0 && todo > 0) return `- 完成 ${done} 项，也留下 ${todo} 项待办`
  if (done > 0) return `- 完成了 ${done} 项事情`
  return `- 留下了 ${todo} 项待办`
}

export function LeftSidebar({
  viewingDate,
  stickers,
  onSelectDate,
  mode = 'inline',
  onClose,
  className = '',
  style,
}: Props) {
  const [tab, setTab] = useState<TabKey>('date')
  const today = todayISO()
  const dateListRef = useRef<HTMLDivElement>(null)
  const recenterTimerRef = useRef<number | null>(null)

  const dateItems = useMemo(() => {
    return Array.from({ length: 241 }, (_, i) => shiftDateISO(today, i - 120))
  }, [today])

  const dateRows = useMemo(() => {
    const rows: Array<
      | { type: 'month'; key: string; label: string }
      | { type: 'date'; key: string; date: string }
    > = []
    let prevMonth = ''

    for (const d of dateItems) {
      const monthLabel = format(parseISO(`${d}T12:00:00`), 'MMMM').toUpperCase()
      if (monthLabel !== prevMonth) {
        rows.push({ type: 'month', key: `month-${d}`, label: monthLabel })
        prevMonth = monthLabel
      }
      rows.push({ type: 'date', key: d, date: d })
    }

    return rows
  }, [dateItems])

  useEffect(() => {
    if (tab !== 'date') return
    const el = dateListRef.current?.querySelector<HTMLElement>(
      `[data-date="${viewingDate}"]`,
    )
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [tab, viewingDate])

  useEffect(() => {
    return () => {
      if (recenterTimerRef.current !== null) {
        window.clearTimeout(recenterTimerRef.current)
      }
    }
  }, [])

  const todos = useMemo(() => {
    const futureEnd = shiftDateISO(today, 2)
    const pastStart = shiftDateISO(today, -7)
    return stickers
      .filter((s) => s.status === 'todo')
      .filter((s) => {
        if (s.date >= today && s.date <= futureEnd) return true
        return s.date < today && s.date >= pastStart
      })
      .sort((a, b) => {
        const aFuture = a.date >= today && a.date <= futureEnd
        const bFuture = b.date >= today && b.date <= futureEnd
        if (aFuture !== bFuture) return aFuture ? -1 : 1
        if (aFuture) return a.date.localeCompare(b.date)
        return b.date.localeCompare(a.date)
      })
  }, [stickers, today])

  const dayDotCounts = useMemo(() => {
    const m = new Map<string, { yellow: number; white: number }>()
    for (const s of stickers) {
      const cur = m.get(s.date) ?? { yellow: 0, white: 0 }
      if (s.status === 'note') {
        cur.white = Math.min(3, cur.white + 1)
      } else {
        cur.yellow = Math.min(3, cur.yellow + 1)
      }
      m.set(s.date, cur)
    }
    return m
  }, [stickers])

  const rootClass = [
    'flex flex-col border-stone-300/70 bg-[#ece8e2]/95',
    mode === 'drawer'
      ? 'h-full min-h-0 w-full border-r-0 p-4'
      : `h-svh min-w-0 shrink-0 border-r p-2 sm:p-3 ${className}`,
  ]
    .filter(Boolean)
    .join(' ')

  const Root = mode === 'drawer' ? 'div' : 'aside'

  return (
    <Root
      className={rootClass}
      style={style}
      role={mode === 'drawer' ? 'complementary' : undefined}
    >
      {mode === 'drawer' ? (
        <div className="mb-3 flex items-center justify-between border-b border-stone-300/70 pb-3">
          <div className="flex items-center gap-2">
            <img
              src="/papier-icon.png"
              alt="Papier logo"
              className="h-9 w-9 rounded-[8px] border border-stone-300/60 bg-[#f4efe5] object-cover"
            />
            <p className="text-[15px] font-semibold text-stone-800">Papier</p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-sm text-stone-600 transition hover:bg-stone-200/80"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-stone-300/70 pb-4 xl:gap-3">
          <img
            src="/papier-icon.png"
            alt="Papier logo"
            className="h-9 w-9 shrink-0 rounded-[8px] border border-stone-300/60 bg-[#f4efe5] object-cover xl:h-10 xl:w-10"
          />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-stone-800 xl:text-[15px]">
              Papier
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex rounded-md bg-[#E2DDD4] p-0.5 text-[12px]">
        <button
          type="button"
          className={`flex-1 rounded px-2 py-1 transition ${tab === 'date' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}
          onClick={() => setTab('date')}
        >
          日期
        </button>
        <button
          type="button"
          className={`flex-1 rounded px-2 py-1 transition ${tab === 'todo' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}
          onClick={() => setTab('todo')}
        >
          待办
        </button>
      </div>

      <div className="mt-3 min-h-0 flex-1">
        {tab === 'date' ? (
          <div className="flex h-full flex-col">
          <div className="relative">
            <div
              ref={dateListRef}
              className="max-h-[340px] space-y-1 overflow-y-auto pr-1 scroll-smooth"
              onScroll={() => {
                if (recenterTimerRef.current !== null) {
                  window.clearTimeout(recenterTimerRef.current)
                }
                recenterTimerRef.current = window.setTimeout(() => {
                  const currentEl = dateListRef.current?.querySelector<HTMLElement>(
                    `[data-date="${viewingDate}"]`,
                  )
                  currentEl?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                }, 3000)
              }}
            >
              {dateRows.map((row) => {
                if (row.type === 'month') {
                  return (
                    <div
                      key={row.key}
                      className="flex h-[34px] items-center px-2 text-[9px] font-medium uppercase tracking-[0.08em] text-stone-400"
                      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
                    >
                      {row.label}
                    </div>
                  )
                }

                const d = row.date
                const selected = d === viewingDate
                const future = d > today
                const dots = dayDotCounts.get(d) ?? { yellow: 0, white: 0 }
                return (
                  <button
                    key={row.key}
                    data-date={d}
                    type="button"
                    className={`block w-full rounded px-2 py-1.5 text-left text-[13px] transition ${
                      selected
                        ? 'bg-[#E7E2DA] font-semibold text-stone-900'
                        : 'text-stone-700 hover:bg-stone-200/70'
                    } ${future ? 'opacity-30' : ''}`}
                    onClick={() => onSelectDate(d, 'date')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{formatTabDate(d)}</span>
                      <span className="flex items-center gap-1">
                        {Array.from({ length: dots.yellow }, (_, i) => (
                          <span
                            key={`y-${d}-${i}`}
                            className="h-1.5 w-1.5 rounded-full bg-amber-400/90"
                          />
                        ))}
                        {Array.from({ length: dots.white }, (_, i) => (
                          <span
                            key={`w-${d}-${i}`}
                            className="h-1.5 w-1.5 rounded-full border border-stone-300/80 bg-white/95"
                          />
                        ))}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#ece8e2] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#ece8e2] to-transparent" />
          </div>
          <p className="mt-3 truncate border-t border-stone-300/70 pt-3 text-[12px] text-stone-600">
            {daySummary(viewingDate, stickers)}
          </p>
          </div>
        ) : (
          <div className="max-h-full space-y-2 overflow-y-auto pr-1">
          {todos.length === 0 ? (
            <p className="text-[12px] text-stone-500">未来 3 天到过去一周暂无待办</p>
          ) : (
            todos.map((t) => (
              <button
                key={t.id}
                type="button"
                className="block w-full rounded border border-stone-300/70 bg-white/70 px-2 py-1.5 text-left transition hover:bg-white"
                onClick={() => onSelectDate(t.date, 'todo')}
              >
                <p className="truncate text-[12px] text-stone-800">{t.title}</p>
                <p className="mt-0.5 text-[10px] text-stone-500">{formatTabDate(t.date)}</p>
              </button>
            ))
          )}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-stone-300/70 pt-3">
        <div className="flex items-center gap-2 text-[12px] text-stone-700">
          <div className="h-5 w-5 rounded-full bg-stone-300" />
          <span>用户名</span>
        </div>
      </div>
    </Root>
  )
}

