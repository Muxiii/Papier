import { useEffect, useMemo, useRef, useState } from 'react'

import { StickerCard } from '@/components/StickerCard'
import { formatStickerDate } from '@/lib/date'
import { BOOK_DESIGN_WIDTH, DIARY_VIEWPORT } from '@/lib/diaryViewportLayout'
import type { Sticker } from '@/types/sticker'

export type PasteAnchor = { date: string; x: number; y: number }

export type DiaryLayoutMode = 'spread' | 'single'

type Props = {
  layout?: DiaryLayoutMode
  /** 双页时整体缩放 (0.8, 1]，由视口布局计算 */
  spreadScale?: number
  /** 水平白边（px），替代固定 Tailwind padding */
  padXPx?: number
  /** 单页时纸张宽度（px），与设计半页宽一致 */
  singlePageWidthPx?: number
  /** 单页时整体等比缩放（含贴纸） */
  singleScale?: number
  activeDate: string
  leftDate: string
  rightDate: string
  leftStickers: Sticker[]
  rightStickers: Sticker[]
  /** 单页模式：当前查看日的贴纸 */
  singleStickers?: Sticker[]
  selectedStickerId: string | null
  onSelectSticker: (id: string | null) => void
  onStickerMoveEnd: (id: string, pos: { x: number; y: number }) => void
  onStickerOpen: (id: string) => void
  onStickerPatch: (id: string, patch: Partial<Sticker>) => void
  onFlipPrev: () => void
  onFlipNext: () => void
  onDiaryPaperHoverChange?: (hovered: boolean) => void
  onPasteAnchorChange?: (anchor: PasteAnchor | null) => void
  onStickerAreaBounds?: (date: string, bounds: { width: number; height: number }) => void
}

const BOOK_DESIGN_W = BOOK_DESIGN_WIDTH
const BOOK_PAGE_H = 630

type PageProps = {
  date: string
  stickers: Sticker[]
  pageClassName?: string
  active?: boolean
  dimmed?: boolean
  selectedStickerId: string | null
  onSelectSticker: (id: string | null) => void
  onStickerMoveEnd: (id: string, pos: { x: number; y: number }) => void
  onStickerOpen: (id: string) => void
  onStickerPatch: (id: string, patch: Partial<Sticker>) => void
  onFlip?: () => void
  /** 单页空白点击：由父级根据点击位置决定上一日/下一日 */
  onBlankClickSplit?: (e: React.MouseEvent<HTMLDivElement>) => void
  onPasteAnchorChange?: (anchor: PasteAnchor | null) => void
  onStickerAreaBounds?: (date: string, bounds: { width: number; height: number }) => void
  /** 双页 flex 行内均分宽度；单页固定宽 */
  spreadFlex?: boolean
}

function DiaryPage({
  date,
  stickers,
  pageClassName,
  active,
  dimmed,
  selectedStickerId,
  onSelectSticker,
  onStickerMoveEnd,
  onStickerOpen,
  onStickerPatch,
  onFlip,
  onBlankClickSplit,
  onPasteAnchorChange,
  onStickerAreaBounds,
  spreadFlex = true,
}: PageProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  /** 本次点击若用于取消选中，则不再触发翻页 */
  const skipFlipForDeselectRef = useRef(false)
  const [bounds, setBounds] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const update = () => {
      setBounds({
        width: el.clientWidth,
        height: el.clientHeight,
      })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    onStickerAreaBounds?.(date, bounds)
  }, [date, bounds, onStickerAreaBounds])

  return (
    <div
      className={[
        spreadFlex
          ? 'relative h-[630px] min-w-0 flex-1 overflow-hidden border border-stone-300/70 bg-[#fdfcf8]'
          : 'relative h-[630px] w-full shrink-0 overflow-hidden border border-stone-300/70 bg-[#fdfcf8]',
        pageClassName ?? '',
      ].join(' ')}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-sticker]')) return
        skipFlipForDeselectRef.current = selectedStickerId !== null
        onSelectSticker(null)
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-sticker]')) return
        if (skipFlipForDeselectRef.current) {
          skipFlipForDeselectRef.current = false
          return
        }
        if (onBlankClickSplit) {
          onBlankClickSplit(e)
          return
        }
        onFlip?.()
      }}
    >
      <div
        className={[
          'flex h-[60px] items-center border-b border-stone-300/60 px-6 text-[12px]',
          active ? 'font-semibold text-stone-900' : 'text-stone-700',
        ].join(' ')}
      >
        {formatStickerDate(date)}
      </div>
      <div
        ref={contentRef}
        className="relative h-[570px]"
        onPointerMove={(e) => {
          const el = contentRef.current
          if (!el || !onPasteAnchorChange) return
          const r = el.getBoundingClientRect()
          onPasteAnchorChange({
            date,
            x: e.clientX - r.left,
            y: e.clientY - r.top,
          })
        }}
      >
        {stickers.length === 0 && (
          <p className="px-4 py-4 text-[12px] text-stone-400">这天还没有贴纸记录</p>
        )}
        {stickers.map((s) => (
          <StickerCard
            key={s.id}
            sticker={s}
            selected={selectedStickerId === s.id}
            bounds={bounds}
            onSelect={(id) => onSelectSticker(id)}
            onMoveEnd={onStickerMoveEnd}
            onOpen={onStickerOpen}
            onPatch={onStickerPatch}
          />
        ))}
      </div>
      {dimmed && <div className="pointer-events-none absolute inset-0 bg-white/60" />}
    </div>
  )
}

export function DiarySpread({
  layout = 'spread',
  spreadScale = 1,
  padXPx = DIARY_VIEWPORT.PAD_MIN,
  singlePageWidthPx = DIARY_VIEWPORT.HALF_PAGE_W,
  singleScale = DIARY_VIEWPORT.SINGLE_PAGE_SCALE,
  activeDate,
  leftDate,
  rightDate,
  leftStickers,
  rightStickers,
  singleStickers,
  selectedStickerId,
  onSelectSticker,
  onStickerMoveEnd,
  onStickerOpen,
  onStickerPatch,
  onFlipPrev,
  onFlipNext,
  onDiaryPaperHoverChange,
  onPasteAnchorChange,
  onStickerAreaBounds,
}: Props) {
  const sortedSingle = useMemo(
    () =>
      [...(singleStickers ?? [])].sort(
        (a, b) =>
          (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.id.localeCompare(b.id),
      ),
    [singleStickers],
  )

  const sortedLeft = useMemo(
    () =>
      [...leftStickers].sort(
        (a, b) =>
          (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.id.localeCompare(b.id),
      ),
    [leftStickers],
  )
  const sortedRight = useMemo(
    () =>
      [...rightStickers].sort(
        (a, b) =>
          (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.id.localeCompare(b.id),
      ),
    [rightStickers],
  )

  const handleSingleBlankClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const t = r.width / 3
    if (x < t) onFlipPrev()
    else if (x > 2 * t) onFlipNext()
  }

  const scaledW = BOOK_DESIGN_W * spreadScale
  const scaledH = BOOK_PAGE_H * spreadScale
  const singleScaledW = singlePageWidthPx * singleScale
  const singleScaledH = BOOK_PAGE_H * singleScale

  return (
    <div
      className="paper-dots h-full flex-1 overflow-hidden pb-20 pt-3 transition-[padding] duration-150 ease-out"
      style={{
        paddingLeft: padXPx,
        paddingRight: padXPx,
      }}
      onPointerEnter={() => onDiaryPaperHoverChange?.(true)}
      onPointerLeave={() => onDiaryPaperHoverChange?.(false)}
    >
      {layout === 'single' ? (
        <div className="relative flex w-full justify-center">
          <div
            className="shrink-0 overflow-hidden transition-[width,height] duration-150 ease-out"
            style={{ width: singleScaledW, height: singleScaledH, maxWidth: '100%' }}
          >
            <div
              style={{
                width: singlePageWidthPx,
                height: BOOK_PAGE_H,
                transform: `scale(${singleScale})`,
                transformOrigin: 'top left',
              }}
            >
              <DiaryPage
                date={activeDate}
                stickers={sortedSingle}
                pageClassName="rounded-[20px]"
                active
                dimmed={false}
                selectedStickerId={selectedStickerId}
                onSelectSticker={onSelectSticker}
                onStickerMoveEnd={onStickerMoveEnd}
                onStickerOpen={onStickerOpen}
                onStickerPatch={onStickerPatch}
                onBlankClickSplit={handleSingleBlankClick}
                onPasteAnchorChange={onPasteAnchorChange}
                onStickerAreaBounds={onStickerAreaBounds}
                spreadFlex={false}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex w-full justify-center">
          <div
            className="overflow-hidden transition-[width,height] duration-150 ease-out"
            style={{ width: scaledW, height: scaledH }}
          >
            <div
              className="relative flex gap-0"
              style={{
                width: BOOK_DESIGN_W,
                height: BOOK_PAGE_H,
                transform: `scale(${spreadScale})`,
                transformOrigin: 'top left',
              }}
            >
              <DiaryPage
                date={leftDate}
                stickers={sortedLeft}
                pageClassName="rounded-l-[20px]"
                active={activeDate === leftDate}
                dimmed={activeDate !== leftDate}
                selectedStickerId={selectedStickerId}
                onSelectSticker={onSelectSticker}
                onStickerMoveEnd={onStickerMoveEnd}
                onStickerOpen={onStickerOpen}
                onStickerPatch={onStickerPatch}
                onFlip={onFlipPrev}
                onPasteAnchorChange={onPasteAnchorChange}
                onStickerAreaBounds={onStickerAreaBounds}
              />
              <div className="relative w-6 shrink-0 overflow-hidden bg-gradient-to-r from-[#e6ddcf] via-[#f3ebdf] to-[#e7dece]">
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-stone-700/10" />
                <div className="absolute inset-y-0 left-0 w-1 bg-black/[0.04] blur-[2px]" />
                <div className="absolute inset-y-0 right-0 w-1 bg-white/70 blur-[2px]" />
              </div>
              <DiaryPage
                date={rightDate}
                stickers={sortedRight}
                pageClassName="rounded-r-[20px]"
                active={activeDate === rightDate}
                dimmed={activeDate !== rightDate}
                selectedStickerId={selectedStickerId}
                onSelectSticker={onSelectSticker}
                onStickerMoveEnd={onStickerMoveEnd}
                onStickerOpen={onStickerOpen}
                onStickerPatch={onStickerPatch}
                onFlip={onFlipNext}
                onPasteAnchorChange={onPasteAnchorChange}
                onStickerAreaBounds={onStickerAreaBounds}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

