import { format, parseISO } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'

import { shiftDateISO, todayISO } from '@/lib/date'
import type { Sticker } from '@/types/sticker'

type Props = {
  viewingDate: string
  stickers: Sticker[]
  onSelectDate: (date: string) => void
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

export function LeftSidebar({ viewingDate, stickers, onSelectDate }: Props) {
  const [tab, setTab] = useState<TabKey>('date')
  const today = todayISO()
  const dateListRef = useRef<HTMLDivElement>(null)

  const dateItems = useMemo(() => {
    return Array.from({ length: 241 }, (_, i) => shiftDateISO(today, i - 120))
  }, [today])

  useEffect(() => {
    if (tab !== 'date') return
    const el = dateListRef.current?.querySelector<HTMLElement>(
      `[data-date="${viewingDate}"]`,
    )
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [tab, viewingDate])

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

  return (
    <aside className="flex h-svh w-[280px] shrink-0 flex-col border-r border-stone-300/70 bg-[#ece8e2]/95 p-4">
      <div className="flex items-center gap-2 border-b border-stone-300/70 pb-4">
        <img
          src="/favicon.svg"
          alt="Papier logo"
          className="h-5 w-5 rounded-[4px] border border-stone-300/60 bg-[#f4efe5]"
        />
        <div>
          <p className="text-[15px] font-semibold text-stone-800">Papier</p>
        </div>
      </div>

      <div className="mt-4 flex rounded-md bg-stone-200/70 p-0.5 text-[12px]">
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
              onWheel={(e) => {
                if (Math.abs(e.deltaY) < 16) return
                onSelectDate(shiftDateISO(viewingDate, e.deltaY > 0 ? 1 : -1))
              }}
            >
              {dateItems.map((d) => {
                const selected = d === viewingDate
                const future = d > today
                return (
                  <button
                    key={d}
                    data-date={d}
                    type="button"
                    className={`block w-full rounded px-2 py-1.5 text-left text-[13px] transition ${
                      selected ? 'bg-stone-300/90 font-semibold text-stone-900' : 'text-stone-700 hover:bg-stone-200/70'
                    } ${future ? 'opacity-30' : ''}`}
                    onClick={() => onSelectDate(d)}
                  >
                    {formatTabDate(d)}
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
                onClick={() => onSelectDate(t.date)}
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
    </aside>
  )
}

