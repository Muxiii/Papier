import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AIChatDrawer } from '@/components/AIChatDrawer'
import { DiarySpread, type PasteAnchor } from '@/components/DiarySpread'
import { LeftSidebar } from '@/components/LeftSidebar'
import { StickerModal } from '@/components/StickerModal'
import { useDiaryViewportLayout } from '@/hooks/useDiaryViewportLayout'
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

/** 高于 AI 抽屉 (~20020) 与贴纸画布 (~10000)，低于贴纸详情弹窗 (21000) */
const Z_NAV_MENU_BACKDROP = 20600
const Z_NAV_MENU_DRAWER = 20650
const Z_NAV_MENU_FAB = 20700

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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const layout = useDiaryViewportLayout()

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

  const singleStickers = useMemo(
    () =>
      allStickers
        .filter((st) => st.date === viewingDate)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [allStickers, viewingDate],
  )

  useEffect(() => {
    return useDiaryStore.persist.onFinishHydration(() =>
      setPersistHydrated(true),
    )
  }, [])

  useEffect(() => {
    if (layout.useDrawer) return
    queueMicrotask(() => {
      setSidebarOpen((open) => (open ? false : open))
    })
  }, [layout.useDrawer])

  useEffect(() => {
    if (!sidebarOpen || !layout.useDrawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layout.useDrawer, sidebarOpen])

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

  const handleSelectDate = useCallback(
    (d: string, source?: 'date' | 'todo') => {
      if (layout.useDrawer) setSidebarOpen(false)
      changeDate(d, source === 'todo' ? 'todo' : 'date')
    },
    [changeDate, layout.useDrawer],
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
      {!layout.useDrawer ? (
        <LeftSidebar
          mode="inline"
          className="shrink-0"
          style={{ width: layout.sidebarWidth }}
          viewingDate={viewingDate}
          stickers={allStickers}
          onSelectDate={handleSelectDate}
        />
      ) : null}

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#e5e2dc]">
        <div
          className="min-h-0 flex-1 overflow-hidden bg-[#e5e2dc] transition-[padding-top] duration-150 ease-out"
          style={{ paddingTop: layout.diaryOffsetTop }}
        >
        {persistHydrated ? (
          <DiarySpread
            layout={layout.spreadMode ? 'spread' : 'single'}
            spreadScale={layout.spreadScale}
            padXPx={layout.padX}
            singlePageWidthPx={layout.singlePageWidthPx}
            activeDate={viewingDate}
            leftDate={leftDate}
            rightDate={rightDate}
            leftStickers={leftStickers}
            rightStickers={rightStickers}
            singleStickers={singleStickers}
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
        </div>
        <div
          className="pointer-events-none absolute bottom-7 z-[20005] transition-[left,right] duration-150 ease-out"
          style={{ left: layout.padX, right: layout.padX }}
        >
          <div
            className="pointer-events-auto mx-auto w-full transition-[max-width] duration-150 ease-out"
            style={{ maxWidth: layout.diaryContentWidthPx }}
          >
            <AIChatDrawer
              onOpenChange={(open) => {
                aiChatOpenRef.current = open
              }}
            />
          </div>
        </div>
      </main>

      {layout.useDrawer && !sidebarOpen ? (
        <button
          type="button"
          className="fixed left-4 top-4 flex items-center gap-2 rounded-full border border-stone-300/70 bg-[#fdfbf7] py-1.5 pl-4 pr-2.5 shadow-lg ring-1 ring-black/5 transition hover:bg-[#fffdf8]"
          style={{ zIndex: Z_NAV_MENU_FAB }}
          onClick={() => setSidebarOpen(true)}
          aria-expanded={false}
          aria-controls="app-sidebar-drawer"
          aria-label="打开导航菜单"
        >
          <img
            src="/papier-icon.png"
            alt=""
            className="h-7 w-7 shrink-0 rounded-md border border-stone-300/50 bg-[#f4efe5] object-cover"
          />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200/60 text-stone-700">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          </span>
        </button>
      ) : null}

      {layout.useDrawer && sidebarOpen ? (
        <>
          <div
            className="fixed inset-0 bg-black/45"
            style={{ zIndex: Z_NAV_MENU_BACKDROP }}
            role="presentation"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
          />
          <div
            id="app-sidebar-drawer"
            className="fixed left-0 top-0 flex h-svh w-[min(300px,88vw)] flex-col border-r border-stone-300/70 bg-[#ece8e2] shadow-2xl"
            style={{ zIndex: Z_NAV_MENU_DRAWER }}
          >
            <LeftSidebar
              mode="drawer"
              viewingDate={viewingDate}
              stickers={allStickers}
              onSelectDate={handleSelectDate}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>
      ) : null}

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
