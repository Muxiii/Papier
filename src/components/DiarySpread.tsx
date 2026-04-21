import { useEffect, useMemo, useRef, useState } from 'react'

import { StickerCard } from '@/components/StickerCard'
import { formatStickerDate } from '@/lib/date'
import type { Sticker } from '@/types/sticker'

type Props = {
  activeDate: string
  leftDate: string
  rightDate: string
  leftStickers: Sticker[]
  rightStickers: Sticker[]
  selectedStickerId: string | null
  onSelectSticker: (id: string | null) => void
  onStickerMoveEnd: (id: string, pos: { x: number; y: number }) => void
  onStickerOpen: (id: string) => void
  onStickerPatch: (id: string, patch: Partial<Sticker>) => void
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
}: PageProps) {
  const contentRef = useRef<HTMLDivElement>(null)
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

  return (
    <div
      className={[
        'relative h-[600px] flex-1 overflow-hidden border border-stone-300/70 bg-[#fdfcf8]',
        pageClassName ?? '',
      ].join(' ')}
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('[data-sticker]')) onSelectSticker(null)
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
      <div ref={contentRef} className="relative h-[540px]">
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
  activeDate,
  leftDate,
  rightDate,
  leftStickers,
  rightStickers,
  selectedStickerId,
  onSelectSticker,
  onStickerMoveEnd,
  onStickerOpen,
  onStickerPatch,
}: Props) {
  const sortedLeft = useMemo(
    () => [...leftStickers].sort((a, b) => a.id.localeCompare(b.id)),
    [leftStickers],
  )
  const sortedRight = useMemo(
    () => [...rightStickers].sort((a, b) => a.id.localeCompare(b.id)),
    [rightStickers],
  )

  return (
    <div className="paper-dots h-full flex-1 overflow-hidden p-6 pb-20">
      <div className="mx-auto max-w-[1180px]">
        <div className="relative flex gap-0">
          <DiaryPage
            date={leftDate}
            stickers={sortedLeft}
            pageClassName="rounded-l-[20px]"
            active={activeDate === leftDate}
            selectedStickerId={selectedStickerId}
            onSelectSticker={onSelectSticker}
            onStickerMoveEnd={onStickerMoveEnd}
            onStickerOpen={onStickerOpen}
            onStickerPatch={onStickerPatch}
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
            dimmed
            selectedStickerId={selectedStickerId}
            onSelectSticker={onSelectSticker}
            onStickerMoveEnd={onStickerMoveEnd}
            onStickerOpen={onStickerOpen}
            onStickerPatch={onStickerPatch}
          />
        </div>
      </div>
    </div>
  )
}

