import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AIChatDrawer } from '@/components/AIChatDrawer'
import { DiarySpread, type PasteAnchor } from '@/components/DiarySpread'
import { LeftSidebar } from '@/components/LeftSidebar'
import { StickerModal } from '@/components/StickerModal'
import { parseISODate, shiftDateISO, spreadDatesForViewing } from '@/lib/date'
import {
  isClipboardImageType,
  loadImageNaturalSize,
  sizeForPhotoSticker,
} from '@/lib/photoSticker'
import { playPageFlip } from '@/lib/pageFlipSound'
import { useDiaryStore } from '@/store/useDiaryStore'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function pickClipboardImageFile(dt: DataTransfer | null): File | null {
  if (!dt) return null
  if (dt.files?.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i]
      if (f.type.startsWith('image/')) return f
    }
  }
  for (let i = 0; i < dt.items.length; i++) {
    const it = dt.items[i]
    if (it.kind !== 'file') continue
    if (!isClipboardImageType(it.type)) continue
    const f = it.getAsFile()
    if (f) return f
  }
  return null
}

export default function App() {
  const viewingDate = useDiaryStore((s) => s.viewingDate)
  const setViewingDate = useDiaryStore((s) => s.setViewingDate)
  const updateSticker = useDiaryStore((s) => s.updateSticker)
  const removeSticker = useDiaryStore((s) => s.removeSticker)
  const addSticker = useDiaryStore((s) => s.addSticker)
  const allStickers = useDiaryStore((s) => s.stickers)

  const [modalId, setModalId] = useState<string | null>(null)
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null,
  )
  const [persistHydrated, setPersistHydrated] = useState(() =>
    useDiaryStore.persist.hasHydrated(),
  )

  const diaryPaperHoveredRef = useRef(false)
  const aiChatOpenRef = useRef(false)
  const pasteAnchorRef = useRef<PasteAnchor | null>(null)
  const boundsByDateRef = useRef<Record<string, { width: number; height: number }>>(
    {},
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

  const handleStickerAreaBounds = useCallback(
    (date: string, bounds: { width: number; height: number }) => {
      boundsByDateRef.current = {
        ...boundsByDateRef.current,
        [date]: bounds,
      }
    },
    [],
  )

  useEffect(() => {
    if (!persistHydrated) return

    const onPaste = (e: ClipboardEvent) => {
      if (modalId) return
      const file = pickClipboardImageFile(e.clipboardData)
      if (!file) return
      if (!diaryPaperHoveredRef.current && !aiChatOpenRef.current) return

      e.preventDefault()

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        void (async () => {
          try {
            const { w: nw, h: nh } = await loadImageNaturalSize(dataUrl)
            const { w: sw, h: sh } = sizeForPhotoSticker(nw, nh)
            const anchor = pasteAnchorRef.current
            const fallbackBounds = boundsByDateRef.current[viewingDate] ?? {
              width: 400,
              height: 540,
            }

            let targetDate = viewingDate
            let pos = {
              x: Math.round((fallbackBounds.width - sw) / 2),
              y: Math.round((fallbackBounds.height - sh) / 2),
            }

            if (
              anchor &&
              (anchor.date === leftDate || anchor.date === rightDate)
            ) {
              targetDate = anchor.date
              const b = boundsByDateRef.current[targetDate] ?? fallbackBounds
              const maxX = Math.max(0, b.width - sw)
              const maxY = Math.max(0, b.height - sh)
              pos = {
                x: clamp(Math.round(anchor.x - sw / 2), 0, maxX),
                y: clamp(Math.round(anchor.y - sh / 2), 0, maxY),
              }
            }

            const id = addSticker({
              type: 'photo',
              title: '',
              description: '',
              date: targetDate,
              status: 'done',
              imageDataUrl: dataUrl,
              imageNaturalW: nw,
              imageNaturalH: nh,
              size: { w: sw, h: sh },
              position: pos,
            })
            setModalId(id)
            setSelectedStickerId(null)
          } catch {
            // ignore broken image
          }
        })()
      }
      reader.readAsDataURL(file)
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [
    addSticker,
    leftDate,
    modalId,
    persistHydrated,
    rightDate,
    viewingDate,
  ])

  const changeDate = useCallback(
    (d: string, source: 'date' | 'todo' | 'page' = 'date') => {
      if (d === viewingDate) return
      const diffDays = Math.abs(
        Math.round(
          (parseISODate(d).getTime() - parseISODate(viewingDate).getTime()) /
            86400000,
        ),
      )
      playPageFlip(source === 'page' ? 1 : diffDays)
      setSelectedStickerId(null)
      setViewingDate(d)
    },
    [setViewingDate, viewingDate],
  )

  const onFlipPrev = useCallback(() => {
    changeDate(shiftDateISO(viewingDate, -1), 'page')
  }, [changeDate, viewingDate])

  const onFlipNext = useCallback(() => {
    changeDate(shiftDateISO(viewingDate, 1), 'page')
  }, [changeDate, viewingDate])

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
            onFlipPrev={onFlipPrev}
            onFlipNext={onFlipNext}
            onDiaryPaperHoverChange={(h) => {
              diaryPaperHoveredRef.current = h
            }}
            onPasteAnchorChange={(a) => {
              pasteAnchorRef.current = a
            }}
            onStickerAreaBounds={handleStickerAreaBounds}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-stone-500">
            加载中…
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-7 z-[20005]">
          <div className="pointer-events-auto mx-auto max-w-[1180px]">
            <AIChatDrawer
              onOpenChange={(open) => {
                aiChatOpenRef.current = open
              }}
            />
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
