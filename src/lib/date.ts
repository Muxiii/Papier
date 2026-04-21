import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'

/**
 * 固定「某一日历日」在双页摊开中落在左页还是右页（与当前查看日无关）。
 * 以 UTC 日历日差值的奇偶性分区，相邻自然日一定分居左右。
 */
const PAGE_SLOT_ANCHOR = '1970-01-01'

export function datePageSlot(dateISO: string): 'left' | 'right' {
  const d = differenceInCalendarDays(
    parseISO(`${dateISO}T12:00:00`),
    parseISO(`${PAGE_SLOT_ANCHOR}T12:00:00`),
  )
  return d % 2 === 0 ? 'left' : 'right'
}

/** 本地日历日期的 yyyy-MM-dd */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatHeaderDate(dateISO: string): string {
  const d = parseISO(`${dateISO}T12:00:00`)
  return format(d, 'M月d日 EEEE', { locale: zhCN })
}

export function formatMonthYear(dateISO: string): string {
  const d = parseISO(`${dateISO}T12:00:00`)
  return format(d, 'yyyy年M月', { locale: zhCN })
}

export function formatStickerDate(dateISO: string): string {
  const d = parseISO(`${dateISO}T12:00:00`)
  return format(d, 'M月d日', { locale: zhCN })
}

export function shiftDateISO(dateISO: string, deltaDays: number): string {
  const d = parseISO(`${dateISO}T12:00:00`)
  return format(addDays(d, deltaDays), 'yyyy-MM-dd')
}

/** 根据当前选中日，返回左页日期与右页日期（相邻两天，且选中日在其固定侧） */
export function spreadDatesForViewing(viewingDateISO: string): {
  leftDate: string
  rightDate: string
} {
  if (datePageSlot(viewingDateISO) === 'left') {
    return { leftDate: viewingDateISO, rightDate: shiftDateISO(viewingDateISO, 1) }
  }
  return { leftDate: shiftDateISO(viewingDateISO, -1), rightDate: viewingDateISO }
}

export function parseISODate(dateISO: string): Date {
  return parseISO(`${dateISO}T12:00:00`)
}

/** 今天及未来日期的贴纸可编辑标题与简介；昨天及以前只读 */
export function isStickerContentEditable(dateISO: string): boolean {
  return dateISO >= todayISO()
}

/** 校验 AI 返回的 yyyy-MM-dd；非法则回退 fallback */
export function normalizeStickerDateInput(
  raw: string | undefined,
  fallback: string,
): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return fallback
  const d = parseISO(`${raw.trim()}T12:00:00`)
  if (Number.isNaN(d.getTime())) return fallback
  return format(d, 'yyyy-MM-dd')
}
