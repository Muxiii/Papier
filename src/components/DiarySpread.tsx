import { useEffect, useMemo, useRef, useState } from 'react'

import { StickerCard } from '@/components/StickerCard'
import { formatStickerDate } from '@/lib/date'
import type { Sticker } from '@/types/sticker'

export type PasteAnchor = { date: string; x: number; y: number }

export type DiaryLayoutMode = 'spread' | 'single'

type Props = {
  layout?: DiaryLayoutMode
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
        'relative h-[600px] flex-1 overflow-hidden border border-stone-300/70 bg-[#fdfcf8]',
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
          'border-b border-stone-300/60 px-6 py-3 text-[12px]',
          active ? 'font-semibold text-stone-900' : 'text-stone-700',
        ].join(' ')}
      >
        {formatStickerDate(date)}
      </div>
      <div
        ref={contentRef}
        className="relative h-[540px]"
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
    if (x < r.width / 2) onFlipPrev()
    else onFlipNext()
  }

  return (
    <div
      className="paper-dots h-full flex-1 overflow-hidden p-3 pb-20 sm:p-6"
      onPointerEnter={() => onDiaryPaperHoverChange?.(true)}
      onPointerLeave={() => onDiaryPaperHoverChange?.(false)}
    >
      <div className="mx-auto max-w-[1180px]">
        {layout === 'single' ? (
          <div className="relative flex justify-center">
            <div className="w-full max-w-[640px]">
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
              />
            </div>
          </div>
        ) : (
          <div className="relative flex gap-0">
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
        )}
      </div>
    </div>
  )
}

