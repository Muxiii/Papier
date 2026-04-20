import { formatHeaderDate, shiftDateISO } from '@/lib/date'

type Props = {
  viewingDate: string
  onChangeDate: (d: string) => void
  onOpenCalendar: () => void
}

export function DateHeader({
  viewingDate,
  onChangeDate,
  onOpenCalendar,
}: Props) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-amber-900/10 bg-[#fdfbf7]/95 px-3 py-3 backdrop-blur-sm">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-stone-600 transition hover:bg-stone-200/60"
        aria-label="前一天"
        onClick={() => onChangeDate(shiftDateISO(viewingDate, -1))}
      >
        ‹
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 px-2 text-center text-base font-semibold text-stone-900"
        onClick={onOpenCalendar}
      >
        {formatHeaderDate(viewingDate)}
      </button>
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl text-stone-600 transition hover:bg-stone-200/60"
        aria-label="后一天"
        onClick={() => onChangeDate(shiftDateISO(viewingDate, 1))}
      >
        ›
      </button>
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-stone-600 transition hover:bg-stone-200/60"
        aria-label="打开日历"
        onClick={onOpenCalendar}
      >
        📅
      </button>
    </header>
  )
}
