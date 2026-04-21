import { useCallback, useEffect, useMemo, useState } from 'react'

import { AIChatDrawer } from '@/components/AIChatDrawer'
import { DiarySpread } from '@/components/DiarySpread'
import { LeftSidebar } from '@/components/LeftSidebar'
import { StickerModal } from '@/components/StickerModal'
import { spreadDatesForViewing } from '@/lib/date'
import { useDiaryStore } from '@/store/useDiaryStore'

export default function App() {
  const viewingDate = useDiaryStore((s) => s.viewingDate)
  const setViewingDate = useDiaryStore((s) => s.setViewingDate)
  const updateSticker = useDiaryStore((s) => s.updateSticker)
  const removeSticker = useDiaryStore((s) => s.removeSticker)
  const allStickers = useDiaryStore((s) => s.stickers)

  const [modalId, setModalId] = useState<string | null>(null)
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null,
  )
  const [persistHydrated, setPersistHydrated] = useState(() =>
    useDiaryStore.persist.hasHydrated(),
  )

  const { leftDate, rightDate } = useMemo(
    () => spreadDatesForViewing(viewingDate),
    [viewingDate],
  )

  const leftStickers = useMemo(
    () =>
      allStickers
        .filter((st) => st.date === leftDate)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [allStickers, leftDate],
  )

  const rightStickers = useMemo(
    () =>
      allStickers
        .filter((st) => st.date === rightDate)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [allStickers, rightDate],
  )

  useEffect(() => {
    return useDiaryStore.persist.onFinishHydration(() =>
      setPersistHydrated(true),
    )
  }, [])

  const changeDate = useCallback(
    (d: string) => {
      if (d !== viewingDate) setSelectedStickerId(null)
      setViewingDate(d)
    },
    [setViewingDate, viewingDate],
  )

  const onSelectSticker = useCallback(
    (id: string | null) => {
      setSelectedStickerId(id)
      if (!id) return
      const stickers = useDiaryStore.getState().stickers
      const topZ = stickers.reduce((max, s) => Math.max(max, s.zIndex ?? 0), 0)
      updateSticker(id, { zIndex: topZ + 1 })
    },
    [updateSticker],
  )

  const activeSticker = useDiaryStore((s) =>
    modalId ? s.stickers.find((x) => x.id === modalId) ?? null : null,
  )

  const onDeleteSticker = useCallback(
    (id: string) => {
      removeSticker(id)
      setModalId(null)
      setSelectedStickerId((cur) => (cur === id ? null : cur))
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
    <div className="flex h-svh overflow-hidden bg-[#e5e2dc]">
      <LeftSidebar
        viewingDate={viewingDate}
        stickers={allStickers}
        onSelectDate={changeDate}
      />

      <main className="relative min-w-0 flex-1 overflow-hidden">
        {persistHydrated ? (
          <DiarySpread
            activeDate={viewingDate}
            leftDate={leftDate}
            rightDate={rightDate}
            leftStickers={leftStickers}
            rightStickers={rightStickers}
            selectedStickerId={selectedStickerId}
            onSelectSticker={onSelectSticker}
            onStickerMoveEnd={(id, pos) => updateSticker(id, { position: pos })}
            onStickerOpen={(id) => {
              setModalId(id)
              setSelectedStickerId(null)
            }}
            onStickerPatch={(id, patch) => updateSticker(id, patch)}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-stone-500">
            加载中…
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-7 z-30">
          <div className="pointer-events-auto mx-auto max-w-[1180px]">
            <AIChatDrawer />
          </div>
        </div>
      </main>

      {modalId && persistHydrated && activeSticker ? (
        <StickerModal
          key={modalId}
          sticker={activeSticker}
          onClose={() => setModalId(null)}
          onPatchSticker={updateSticker}
          onDelete={onDeleteSticker}
          onSaveEdit={onSaveStickerEdit}
        />
      ) : null}
    </div>
  )
}
