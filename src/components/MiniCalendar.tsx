import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'

import { formatMonthYear, todayISO } from '@/lib/date'

type Props = {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  viewingDate: string
  onSelectDate: (iso: string) => void
  onClose: () => void
  dayMarks: Map<string, { todo: boolean; done: boolean }>
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function MiniCalendar({
  open,
  anchorRef,
  viewingDate,
  onSelectDate,
  onClose,
  dayMarks,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  /** 浮层每次打开会挂载新实例（见 App 条件渲染 + key），初始月份与 viewingDate 对齐 */
  const [visibleMonth, setVisibleMonth] = useState(() =>
    parseISO(`${viewingDate}T12:00:00`),
  )

  const monthDate = visibleMonth

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start, end })
    const rows: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7))
    }
    return rows
  }, [monthDate])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent | TouchEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (anchorRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const today = todayISO()
  const viewing = parseISO(`${viewingDate}T12:00:00`)

  return (
    <div
      ref={panelRef}
      className="absolute left-2 right-2 top-full z-40 mt-1 max-h-[260px] overflow-hidden rounded-xl border border-amber-200/80 bg-[#fdfbf7] shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-amber-900/10 px-2 py-2">
        <button
          type="button"
          className="rounded px-2 py-1 text-lg text-stone-600 hover:bg-stone-100"
          aria-label="上个月"
          onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-stone-800">
          {formatMonthYear(format(monthDate, 'yyyy-MM-dd'))}
        </span>
        <button
          type="button"
          className="rounded px-2 py-1 text-lg text-stone-600 hover:bg-stone-100"
          aria-label="下个月"
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0 px-1 pb-2 pt-1 text-center text-[11px] text-stone-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 font-medium">
            {w}
          </div>
        ))}
      </div>
      <div className="max-h-[180px] overflow-y-auto px-1 pb-2">
        {weeks.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-0.5">
            {row.map((day) => {
              const iso = format(day, 'yyyy-MM-dd')
              const inMonth = isSameMonth(day, monthDate)
              const isToday = iso === today
              const isViewing = isSameDay(day, viewing)
              const marks = dayMarks.get(iso)
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!inMonth}
                  className={[
                    'relative flex min-h-[36px] flex-col items-center justify-start rounded-lg py-1 text-[13px] transition',
                    !inMonth && 'invisible pointer-events-none',
                    isViewing && 'bg-amber-200/90 font-semibold text-stone-900',
                    !isViewing && inMonth && 'text-stone-700 hover:bg-amber-100/80',
                    isToday && !isViewing && 'underline decoration-amber-600 decoration-2',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    onSelectDate(iso)
                    onClose()
                  }}
                >
                  <span>{format(day, 'd')}</span>
                  {marks && (marks.todo || marks.done) && (
                    <span className="mt-0.5 flex gap-0.5">
                      {marks.done && (
                        <span
                          className="h-1 w-1 rounded-full bg-emerald-500"
                          title="有已完成"
                        />
                      )}
                      {marks.todo && (
                        <span
                          className="h-1 w-1 rounded-full bg-amber-500"
                          title="有待办"
                        />
                      )}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-amber-900/10 px-2 py-1.5 text-center text-[11px] text-stone-500">
        ● 有记录 · 今天有下划线
      </div>
    </div>
  )
}
