import { useMemo } from 'react'

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
  active,
  dimmed,
  selectedStickerId,
  onSelectSticker,
  onStickerMoveEnd,
  onStickerOpen,
  onStickerPatch,
}: PageProps) {
  return (
    <div
      className="relative min-h-[560px] flex-1 border border-stone-300/70 bg-[#fdfcf8]"
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('[data-sticker]')) onSelectSticker(null)
      }}
    >
      <div
        className={[
          'border-b border-stone-300/60 px-4 py-2 text-[12px]',
          active ? 'font-semibold text-stone-900' : 'text-stone-700',
        ].join(' ')}
      >
        {formatStickerDate(date)}
      </div>
      <div className="relative min-h-[500px]">
        {stickers.length === 0 && (
          <p className="px-4 py-4 text-[12px] text-stone-400">这天还没有贴纸记录</p>
        )}
        {stickers.map((s) => (
          <StickerCard
            key={s.id}
            sticker={s}
            selected={selectedStickerId === s.id}
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
    <div className="paper-dots h-full min-h-svh flex-1 overflow-auto p-6 pb-32">
      <div className="mx-auto max-w-[1180px]">
        <div className="relative flex gap-0">
          <DiaryPage
            date={leftDate}
            stickers={sortedLeft}
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

