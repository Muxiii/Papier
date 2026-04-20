import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AIChatDrawer } from '@/components/AIChatDrawer'
import { DateHeader } from '@/components/DateHeader'
import { MiniCalendar } from '@/components/MiniCalendar'
import { StickerCanvas } from '@/components/StickerCanvas'
import { StickerModal } from '@/components/StickerModal'
import { shiftDateISO } from '@/lib/date'
import { useDiaryStore } from '@/store/useDiaryStore'

type SlideDir = 'prev' | 'next' | null

export default function App() {
  const viewingDate = useDiaryStore((s) => s.viewingDate)
  const setViewingDate = useDiaryStore((s) => s.setViewingDate)
  const updateSticker = useDiaryStore((s) => s.updateSticker)
  const removeSticker = useDiaryStore((s) => s.removeSticker)
  const allStickers = useDiaryStore((s) => s.stickers)

  const [slideDir, setSlideDir] = useState<SlideDir>(null)
  const [calOpen, setCalOpen] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  const [modalId, setModalId] = useState<string | null>(null)
  const [persistHydrated, setPersistHydrated] = useState(() =>
    useDiaryStore.persist.hasHydrated(),
  )

  const stickers = useMemo(
    () =>
      allStickers
        .filter((st) => st.date === viewingDate)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [allStickers, viewingDate],
  )

  const dayMarks = useMemo(() => {
    const m = new Map<string, { todo: boolean; done: boolean }>()
    for (const st of allStickers) {
      const cur = m.get(st.date) ?? { todo: false, done: false }
      if (st.status === 'todo') cur.todo = true
      if (st.status === 'done') cur.done = true
      m.set(st.date, cur)
    }
    return m
  }, [allStickers])

  useEffect(() => {
    const t = window.setTimeout(() => setSlideDir(null), 320)
    return () => window.clearTimeout(t)
  }, [viewingDate])

  useEffect(() => {
    return useDiaryStore.persist.onFinishHydration(() =>
      setPersistHydrated(true),
    )
  }, [])

  const navigateBy = useCallback(
    (dir: 'prev' | 'next') => {
      setSlideDir(dir === 'next' ? 'next' : 'prev')
      setViewingDate(shiftDateISO(viewingDate, dir === 'next' ? 1 : -1))
    },
    [setViewingDate, viewingDate],
  )

  const changeDate = useCallback(
    (d: string) => {
      if (d > viewingDate) setSlideDir('next')
      else if (d < viewingDate) setSlideDir('prev')
      else setSlideDir(null)
      setViewingDate(d)
    },
    [setViewingDate, viewingDate],
  )

  const activeSticker = useDiaryStore((s) =>
    modalId ? s.stickers.find((x) => x.id === modalId) ?? null : null,
  )

  const onToggleStatus = useCallback(
    (id: string) => {
      const s = useDiaryStore.getState().stickers.find((x) => x.id === id)
      if (!s) return
      updateSticker(id, { status: s.status === 'done' ? 'todo' : 'done' })
    },
    [updateSticker],
  )

  const onDeleteSticker = useCallback(
    (id: string) => {
      removeSticker(id)
      setModalId(null)
    },
    [removeSticker],
  )

  const onSaveStickerEdit = useCallback(
    (stickerId: string, patch: { title: string; description: string }) => {
      updateSticker(stickerId, patch)
    },
    [updateSticker],
  )

  return (
    <div className="flex min-h-svh flex-col bg-[#e8e4dc]">
      <div ref={headerRef} className="relative z-30 shrink-0">
        <DateHeader
          viewingDate={viewingDate}
          onChangeDate={changeDate}
          onOpenCalendar={() => setCalOpen(true)}
        />
        {calOpen && (
          <MiniCalendar
            key={viewingDate}
            open
            anchorRef={headerRef}
            viewingDate={viewingDate}
            onSelectDate={changeDate}
            onClose={() => setCalOpen(false)}
            dayMarks={dayMarks}
          />
        )}
      </div>

      {persistHydrated ? (
        <StickerCanvas
          viewingDate={viewingDate}
          stickers={stickers}
          slideDir={slideDir}
          onNavigateDay={navigateBy}
          onStickerMoveEnd={(id, pos) => updateSticker(id, { position: pos })}
          onStickerOpen={(id) => setModalId(id)}
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-stone-500">
          加载中…
        </div>
      )}

      {modalId && persistHydrated && activeSticker ? (
        <StickerModal
          key={modalId}
          sticker={activeSticker}
          onClose={() => setModalId(null)}
          onToggleStatus={onToggleStatus}
          onDelete={onDeleteSticker}
          onSaveEdit={onSaveStickerEdit}
        />
      ) : null}

      <AIChatDrawer />
    </div>
  )
}
