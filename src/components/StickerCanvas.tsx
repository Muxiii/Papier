import { useCallback, useRef } from 'react'

import type { Sticker } from '@/types/sticker'

import { StickerCard } from '@/components/StickerCard'

type NavDir = 'prev' | 'next' | null

type Props = {
  viewingDate: string
  stickers: Sticker[]
  slideDir: NavDir
  selectedStickerId: string | null
  onSelectSticker: (id: string | null) => void
  onNavigateDay: (dir: 'prev' | 'next') => void
  onStickerMoveEnd: (id: string, pos: { x: number; y: number }) => void
  onStickerOpen: (id: string) => void
  onStickerPatch: (id: string, patch: Partial<Sticker>) => void
}

const SWIPE_MIN = 56
const RATIO = 1.25

export function StickerCanvas({
  viewingDate,
  stickers,
  slideDir,
  selectedStickerId,
  onSelectSticker,
  onNavigateDay,
  onStickerMoveEnd,
  onStickerOpen,
  onStickerPatch,
}: Props) {
  const swipe = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-sticker]')) {
        onSelectSticker(null)
      }
      if ((e.target as HTMLElement).closest('[data-sticker]')) return
      swipe.current = { x: e.clientX, y: e.clientY }
    },
    [onSelectSticker],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!swipe.current) return
      const dx = e.clientX - swipe.current.x
      const dy = e.clientY - swipe.current.y
      swipe.current = null
      if (Math.abs(dx) < SWIPE_MIN) return
      if (Math.abs(dx) < Math.abs(dy) * RATIO) return
      if (dx < 0) onNavigateDay('next')
      else onNavigateDay('prev')
    },
    [onNavigateDay],
  )

  const animClass =
    slideDir === 'next'
      ? 'animate-slide-in-right'
      : slideDir === 'prev'
        ? 'animate-slide-in-left'
        : ''

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        key={viewingDate}
        className={`paper-bg relative min-h-[calc(100svh-220px)] px-3 pb-28 pt-4 sm:min-h-[calc(100svh-200px)] ${animClass}`}
      >
        {stickers.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center px-6 text-center text-sm text-stone-500">
            这天还没有记录，和 AI 聊聊吧~
          </div>
        ) : (
          <div className="relative min-h-[480px]">
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
        )}
      </div>
    </div>
  )
}
