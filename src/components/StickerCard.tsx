import type { CSSProperties } from 'react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  PHOTO_STICKER,
  sizeForPhotoSticker,
} from '@/lib/photoSticker'
import {
  STICKER_LAYOUT,
  layoutTypeForBox,
  minTodoStickerHeight,
  screenDeltaToLocal,
  stickerRotation,
  stickerSize,
} from '@/lib/stickerLayout'
import { playStickerSlide } from '@/lib/stickerSlideSound'
import type { Sticker } from '@/types/sticker'

type Corner = 'nw' | 'ne' | 'sw' | 'se'

type Props = {
  sticker: Sticker
  selected: boolean
  bounds?: { width: number; height: number }
  onSelect: (id: string) => void
  onMoveEnd: (id: string, position: { x: number; y: number }) => void
  onOpen: (id: string) => void
  onPatch: (id: string, patch: Partial<Sticker>) => void
}

const MOVE_THRESHOLD = 5
const SLIDE_RETRIGGER_IDLE_MS = 180
const SLIDE_MOVE_EPSILON = 2
const NOTE_TITLE_SIZE = 11
const NOTE_TITLE_LINE = 15
const NOTE_BODY_SIZE = 13
const NOTE_BODY_LINE = 18

function computeResize(
  corner: Corner,
  dxl: number,
  dyl: number,
  startPos: { x: number; y: number },
  startW: number,
  startH: number,
  minW: number,
  minH: number,
): { x: number; y: number; w: number; h: number } {
  let newW = startW
  let newH = startH
  let newL = startPos.x
  let newT = startPos.y

  if (corner === 'se') {
    newW = startW + dxl
    newH = startH + dyl
  } else if (corner === 'nw') {
    newW = startW - dxl
    newH = startH - dyl
    newL = startPos.x + dxl
    newT = startPos.y + dyl
  } else if (corner === 'ne') {
    newW = startW + dxl
    newH = startH - dyl
    newT = startPos.y + dyl
  } else if (corner === 'sw') {
    newW = startW - dxl
    newH = startH + dyl
    newL = startPos.x + dxl
  }

  if (newW < minW) {
    const deficit = minW - newW
    newW = minW
    if (corner === 'nw' || corner === 'sw') newL -= deficit
  }
  if (newH < minH) {
    const deficit = minH - newH
    newH = minH
    if (corner === 'nw' || corner === 'ne') newT -= deficit
  }

  return { x: newL, y: newT, w: newW, h: newH }
}

/** 照片贴纸：白边与底部说明行尺寸固定，仅图片区等比例缩放 */
function computePhotoResize(
  corner: Corner,
  dxl: number,
  dyl: number,
  startPos: { x: number; y: number },
  startW: number,
  startH: number,
  naturalW: number,
  naturalH: number,
): { x: number; y: number; w: number; h: number } {
  const nw = Math.max(1, naturalW)
  const nh = Math.max(1, naturalH)
  const b = PHOTO_STICKER.BORDER_PX
  const b2 = b * 2
  const cap = PHOTO_STICKER.CAPTION_H

  /** 与 `sizeForPhotoSticker` 一致，避免总高过小导致说明行与图片区挤压 */
  const minPhotoOuterH = Math.max(80, STICKER_LAYOUT.MIN_H)

  const draft = computeResize(
    corner,
    dxl,
    dyl,
    startPos,
    startW,
    startH,
    STICKER_LAYOUT.MIN_W,
    minPhotoOuterH,
  )

  const innerW = Math.max(1, draft.w - b2)
  const innerH = Math.max(1, draft.h - cap - b2)
  const sFit = Math.min(innerW / nw, innerH / nh)

  const minInnerW = Math.max(1, STICKER_LAYOUT.MIN_W - b2)
  const minInnerH = Math.max(1, minPhotoOuterH - cap - b2)
  const sMin = Math.min(minInnerW / nw, minInnerH / nh)
  const scale = Math.max(sMin, sFit)

  const imgW = Math.max(1, Math.round(nw * scale))
  const imgH = Math.max(1, Math.round(nh * scale))
  const newW = imgW + b2
  const newH = imgH + b2 + cap

  const fixedRight = startPos.x + startW
  const fixedBottom = startPos.y + startH
  const fixedLeft = startPos.x
  const fixedTop = startPos.y

  let newL: number
  let newT: number
  if (corner === 'se') {
    newL = fixedLeft
    newT = fixedTop
  } else if (corner === 'nw') {
    newL = fixedRight - newW
    newT = fixedBottom - newH
  } else if (corner === 'ne') {
    newL = fixedLeft
    newT = fixedBottom - newH
  } else {
    newL = fixedRight - newW
    newT = fixedTop
  }

  return { x: newL, y: newT, w: newW, h: newH }
}

export function StickerCard({
  sticker,
  selected,
  bounds,
  onSelect,
  onMoveEnd,
  onOpen,
  onPatch,
}: Props) {
  const { w: baseW, h: baseH } = stickerSize(sticker)
  const baseRot = stickerRotation(sticker)

  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [liveRect, setLiveRect] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const [liveRot, setLiveRot] = useState<number | null>(null)

  const w = liveRect?.w ?? baseW
  const h = liveRect?.h ?? baseH
  const posX = liveRect?.x ?? sticker.position.x
  const posY = liveRect?.y ?? sticker.position.y
  const rot = liveRot ?? baseRot

  const isPhoto = sticker.type === 'photo'
  const isTodo = sticker.status === 'todo'
  const isNote = sticker.status === 'note'
  const isCancelled = sticker.status === 'cancelled'
  /** 布局测量：仅「已完成」无副标签行；待办 / Fragments 预留副标签高度 */
  const layoutDoneLike = sticker.status === 'done'
  const metrics = useMemo(() => {
    if (isPhoto) {
      return {
        padX: 0,
        padY: 0,
        fontSize: 12,
        lineHeight: 16,
        subSize: 10,
      }
    }
    return layoutTypeForBox(w, h, sticker.title, layoutDoneLike)
  }, [isPhoto, w, h, sticker.title, layoutDoneLike])
  const noteBodyLines = useMemo(() => {
    if (!isNote || isPhoto) return 0
    const available = h - 2 * metrics.padY - NOTE_TITLE_LINE - 4
    return Math.max(1, Math.floor(available / NOTE_BODY_LINE))
  }, [h, isNote, isPhoto, metrics.padY])

  const sizeRef = useRef({ w: baseW, h: baseH })
  const rotRef = useRef(baseRot)
  useLayoutEffect(() => {
    sizeRef.current = { w: baseW, h: baseH }
    rotRef.current = baseRot
  }, [baseW, baseH, baseRot])

  const dragListeners = useRef<{
    move: (e: PointerEvent) => void
    up: (e: PointerEvent) => void
  } | null>(null)

  const positionRef = useRef(sticker.position)
  useLayoutEffect(() => {
    positionRef.current = sticker.position
  }, [sticker.position])

  const onMoveEndRef = useRef(onMoveEnd)
  const onSelectRef = useRef(onSelect)
  const onOpenRef = useRef(onOpen)
  const onPatchRef = useRef(onPatch)
  const stickerIdRef = useRef(sticker.id)

  useEffect(() => {
    onMoveEndRef.current = onMoveEnd
    onSelectRef.current = onSelect
    onOpenRef.current = onOpen
    onPatchRef.current = onPatch
    stickerIdRef.current = sticker.id
  }, [onMoveEnd, onSelect, onOpen, onPatch, sticker.id])

  const onPointerDownBody = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-sticker-handle]')) return
    e.stopPropagation()
    e.preventDefault()
    const startClientX = e.clientX
    const startClientY = e.clientY
    const pointerId = e.pointerId
    const originX = positionRef.current.x
    const originY = positionRef.current.y
    const { w: startW, h: startH } = sizeRef.current
    let hasPlayedSlideSinceIdle = false
    let slideIdleTimer: number | null = null

    const resetSlideGateAfterIdle = () => {
      if (slideIdleTimer !== null) window.clearTimeout(slideIdleTimer)
      slideIdleTimer = window.setTimeout(() => {
        hasPlayedSlideSinceIdle = false
        slideIdleTimer = null
      }, SLIDE_RETRIGGER_IDLE_MS)
    }

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v))
    const clampPosition = (x: number, y: number) => {
      if (!bounds) return { x, y }
      const maxX = Math.max(0, bounds.width - startW)
      const maxY = Math.max(0, bounds.height - startH)
      return {
        x: clamp(x, 0, maxX),
        y: clamp(y, 0, maxY),
      }
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const rawDx = ev.clientX - startClientX
      const rawDy = ev.clientY - startClientY
      const moveDelta = Math.hypot(rawDx, rawDy)
      if (moveDelta >= SLIDE_MOVE_EPSILON && !hasPlayedSlideSinceIdle) {
        playStickerSlide()
        hasPlayedSlideSinceIdle = true
      }
      resetSlideGateAfterIdle()
      const nextX = originX + rawDx
      const nextY = originY + rawDy
      const clamped = clampPosition(nextX, nextY)
      setDrag({
        x: clamped.x - originX,
        y: clamped.y - originY,
      })
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      dragListeners.current = null
      if (slideIdleTimer !== null) {
        window.clearTimeout(slideIdleTimer)
        slideIdleTimer = null
      }

      const dx = ev.clientX - startClientX
      const dy = ev.clientY - startClientY
      setDrag(null)
      setDragging(false)

      const moved = Math.hypot(dx, dy) > MOVE_THRESHOLD
      if (moved) {
        const clamped = clampPosition(originX + dx, originY + dy)
        onMoveEndRef.current(stickerIdRef.current, {
          x: clamped.x,
          y: clamped.y,
        })
      } else {
        onSelectRef.current(stickerIdRef.current)
      }
    }

    setDrag({ x: 0, y: 0 })
    setDragging(true)
    dragListeners.current = { move: onMove, up: onUp }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [bounds])

  const onDoubleClickContent = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-sticker-handle]')) return
    e.stopPropagation()
    onOpenRef.current(stickerIdRef.current)
  }, [])

  const onDoubleClickBorderReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const id = stickerIdRef.current
      if (
        sticker.type === 'photo' &&
        sticker.imageNaturalW &&
        sticker.imageNaturalH
      ) {
        const next = sizeForPhotoSticker(
          sticker.imageNaturalW,
          sticker.imageNaturalH,
        )
        onPatchRef.current(id, {
          size: next,
          rotation: 0,
        })
        return
      }
      onPatchRef.current(id, {
        size: {
          w: STICKER_LAYOUT.DEFAULT_W,
          h: STICKER_LAYOUT.DEFAULT_H,
        },
        rotation: 0,
      })
    },
    [
      sticker.type,
      sticker.imageNaturalW,
      sticker.imageNaturalH,
    ],
  )

  const onPointerDownResize = useCallback(
    (corner: Corner) => (e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)

      const pointerId = e.pointerId
      const startX = e.clientX
      const startY = e.clientY
      const startPos = { ...positionRef.current }
      const { w: startW, h: startH } = sizeRef.current
      const startRot = rotRef.current
      const minW = STICKER_LAYOUT.MIN_W
      const needsSubLabelMinH =
        sticker.status === 'todo' || sticker.status === 'note'
      const isPhotoResize =
        sticker.type === 'photo' &&
        sticker.imageNaturalW &&
        sticker.imageNaturalH

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        const { dxl, dyl } = screenDeltaToLocal(dx, dy, startRot)
        let next: { x: number; y: number; w: number; h: number }
        if (isPhotoResize) {
          next = computePhotoResize(
            corner,
            dxl,
            dyl,
            startPos,
            startW,
            startH,
            sticker.imageNaturalW!,
            sticker.imageNaturalH!,
          )
        } else {
          const draft = computeResize(
            corner,
            dxl,
            dyl,
            startPos,
            startW,
            startH,
            minW,
            STICKER_LAYOUT.MIN_H,
          )
          const minH = needsSubLabelMinH
            ? minTodoStickerHeight(draft.w, draft.h)
            : STICKER_LAYOUT.MIN_H
          next = computeResize(
            corner,
            dxl,
            dyl,
            startPos,
            startW,
            startH,
            minW,
            minH,
          )
        }
        setLiveRect(next)
      }

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        const { dxl, dyl } = screenDeltaToLocal(dx, dy, startRot)
        let next: { x: number; y: number; w: number; h: number }
        if (isPhotoResize) {
          next = computePhotoResize(
            corner,
            dxl,
            dyl,
            startPos,
            startW,
            startH,
            sticker.imageNaturalW!,
            sticker.imageNaturalH!,
          )
        } else {
          const draft = computeResize(
            corner,
            dxl,
            dyl,
            startPos,
            startW,
            startH,
            minW,
            STICKER_LAYOUT.MIN_H,
          )
          const minH = needsSubLabelMinH
            ? minTodoStickerHeight(draft.w, draft.h)
            : STICKER_LAYOUT.MIN_H
          next = computeResize(
            corner,
            dxl,
            dyl,
            startPos,
            startW,
            startH,
            minW,
            minH,
          )
        }
        onPatchRef.current(stickerIdRef.current, {
          position: { x: next.x, y: next.y },
          size: { w: next.w, h: next.h },
        })
        positionRef.current = { x: next.x, y: next.y }
        setLiveRect(null)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [
      sticker.status,
      sticker.type,
      sticker.imageNaturalW,
      sticker.imageNaturalH,
    ],
  )

  const outerRef = useRef<HTMLDivElement>(null)

  const onPointerDownRotate = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const pointerId = e.pointerId
    const el = outerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx)
    const startRot = rotRef.current

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx)
      let deg = startRot + ((a - startAngle) * 180) / Math.PI
      while (deg > 180) deg -= 360
      while (deg < -180) deg += 360
      setLiveRot(deg)
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx)
      let deg = startRot + ((a - startAngle) * 180) / Math.PI
      while (deg > 180) deg -= 360
      while (deg < -180) deg += 360
      onPatchRef.current(stickerIdRef.current, { rotation: deg })
      setLiveRot(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  useEffect(() => {
    return () => {
      const d = dragListeners.current
      if (d) {
        window.removeEventListener('pointermove', d.move)
        window.removeEventListener('pointerup', d.up)
        window.removeEventListener('pointercancel', d.up)
        dragListeners.current = null
      }
    }
  }, [])

  const left = posX + (drag?.x ?? 0)
  const top = posY + (drag?.y ?? 0)

  const hit = STICKER_LAYOUT.HANDLE_HIT_PX
  const squareHandle = 8
  const ext = STICKER_LAYOUT.ROTATE_CORNER_EXTENT_PX
  const rotateZoneSize = ext + 14
  const zBase = 10 + (sticker.zIndex ?? 0)
  const z = dragging || selected ? 10000 : zBase

  const handleCls = 'absolute flex items-center justify-center'

  const rotateCornerStyle = (corner: Corner): CSSProperties => {
    const s: CSSProperties = {
      width: rotateZoneSize,
      height: rotateZoneSize,
      zIndex: 4,
      cursor: 'grab',
      touchAction: 'none',
    }
    if (corner === 'se') {
      s.right = -ext
      s.bottom = -ext
    } else if (corner === 'nw') {
      s.left = -ext
      s.top = -ext
    } else if (corner === 'ne') {
      s.right = -ext
      s.top = -ext
    } else {
      s.left = -ext
      s.bottom = -ext
    }
    return s
  }

  const bh = STICKER_LAYOUT.BORDER_HIT_PX

  return (
    <div
      ref={outerRef}
      data-sticker
      className={[
        'absolute cursor-grab select-none touch-none',
        dragging ? 'cursor-grabbing' : '',
      ].join(' ')}
      style={{
        left,
        top,
        width: w,
        height: h,
        zIndex: z,
        transform: `rotate(${rot}deg)`,
        transformOrigin: 'center center',
      }}
      onPointerDown={onPointerDownBody}
    >
      {selected && (
        <div
          className="pointer-events-none absolute -inset-[2px] z-[12] border-[1.5px] border-[#D3BA92]"
        />
      )}
      <div
        className={[
          'relative box-border h-full w-full overflow-hidden rounded-xl text-left',
          isPhoto
            ? 'border border-stone-300/80 bg-white text-stone-800 shadow-sm'
            : isNote
              ? 'border border-stone-200/80 bg-[repeating-linear-gradient(180deg,#fffefb_0px,#fffefb_18px,#f5f4ef_19px,#fffefb_20px)] text-stone-800 shadow-[1px_2px_0_rgba(0,0,0,0.08)]'
              : isTodo
                ? 'border border-dashed border-amber-400/70 bg-white/55 text-stone-700 shadow-sm backdrop-blur-[2px]'
                : isCancelled
                  ? 'border border-dashed border-stone-300/90 bg-stone-100/80 text-stone-500 shadow-sm'
                : 'border border-amber-200/80 bg-amber-50/95 text-stone-800 shadow-sm',
        ].join(' ')}
      >
        {selected && (
          <>
            <div
              data-sticker-border
              className="absolute left-0 right-0 top-0 z-[11]"
              style={{ height: bh }}
              onDoubleClick={onDoubleClickBorderReset}
            />
            <div
              data-sticker-border
              className="absolute bottom-0 left-0 right-0 z-[11]"
              style={{ height: bh }}
              onDoubleClick={onDoubleClickBorderReset}
            />
            <div
              data-sticker-border
              className="absolute bottom-0 left-0 top-0 z-[11]"
              style={{ width: bh }}
              onDoubleClick={onDoubleClickBorderReset}
            />
            <div
              data-sticker-border
              className="absolute bottom-0 right-0 top-0 z-[11]"
              style={{ width: bh }}
              onDoubleClick={onDoubleClickBorderReset}
            />
          </>
        )}
        {isPhoto && sticker.imageDataUrl ? (
          <div
            data-sticker-content
            className="flex h-full w-full flex-col overflow-hidden"
            onDoubleClick={onDoubleClickContent}
          >
            <div
              className="min-h-0 flex-1 bg-white"
              style={{ padding: PHOTO_STICKER.BORDER_PX }}
            >
              <img
                src={sticker.imageDataUrl}
                alt=""
                className="pointer-events-none h-full w-full object-contain select-none"
                draggable={false}
              />
            </div>
            <div
              className="shrink-0 truncate border-t border-stone-200/80 bg-[#faf9f7] px-2 text-center text-[11px] text-stone-600"
              style={{
                height: PHOTO_STICKER.CAPTION_H,
                lineHeight: `${PHOTO_STICKER.CAPTION_H}px`,
              }}
              title={
                sticker.description.trim()
                  ? sticker.description.trim()
                  : undefined
              }
            >
              {sticker.description.trim() || '\u00a0'}
            </div>
          </div>
        ) : (
          <div
            data-sticker-content
            className="box-border h-full w-full"
            style={{
              paddingLeft: metrics.padX,
              paddingRight: metrics.padX,
              paddingTop: metrics.padY,
              paddingBottom: metrics.padY,
            }}
            onDoubleClick={onDoubleClickContent}
          >
            <p
              className="pointer-events-none font-medium"
              style={{
                fontSize: isNote ? NOTE_TITLE_SIZE : metrics.fontSize,
                lineHeight: isNote
                  ? `${NOTE_TITLE_LINE}px`
                  : `${metrics.lineHeight}px`,
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {sticker.title}
            </p>
            {isNote && sticker.description.trim() ? (
              <p
                className="pointer-events-none mt-1 overflow-hidden text-stone-600"
                style={{
                  fontSize: NOTE_BODY_SIZE,
                  lineHeight: `${NOTE_BODY_LINE}px`,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: noteBodyLines,
                  textOverflow: 'ellipsis',
                }}
              >
                {sticker.description.trim()}
              </p>
            ) : null}
            {isTodo ? (
              <span
                className="pointer-events-none mt-0.5 block font-medium uppercase tracking-wide text-amber-700/80"
                style={{ fontSize: metrics.subSize }}
              >
                待办
              </span>
            ) : isCancelled ? (
              <span
                className="pointer-events-none mt-0.5 block font-medium uppercase tracking-wide text-stone-500"
                style={{ fontSize: metrics.subSize }}
              >
                已取消
              </span>
            ) : null}
          </div>
        )}
      </div>

      {selected && (
        <>
          {(
            [
              ['nw', { left: -hit / 2, top: -hit / 2 }],
              ['ne', { right: -hit / 2, top: -hit / 2 }],
              ['sw', { left: -hit / 2, bottom: -hit / 2 }],
              ['se', { right: -hit / 2, bottom: -hit / 2 }],
            ] as const
          ).map(([corner, pos]) => (
            <div
              key={`r-${corner}`}
              data-sticker-handle="resize"
              className={handleCls}
              style={{
                ...pos,
                width: hit,
                height: hit,
                cursor:
                  corner === 'nw' || corner === 'se'
                    ? 'nwse-resize'
                    : 'nesw-resize',
                zIndex: 13,
                touchAction: 'none',
              }}
              onPointerDown={onPointerDownResize(corner)}
            >
              <span
                className="block border-[1.5px] border-[#D3BA92] bg-white"
                style={{ width: squareHandle, height: squareHandle }}
              />
            </div>
          ))}
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
            <div
              key={`rot-${corner}`}
              data-sticker-handle="rotate"
              className="absolute"
              style={rotateCornerStyle(corner)}
              onPointerDown={onPointerDownRotate}
            />
          ))}
        </>
      )}
    </div>
  )
}
