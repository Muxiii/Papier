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
  STICKER_LAYOUT,
  layoutTypeForBox,
  minTodoStickerHeight,
  screenDeltaToLocal,
  stickerRotation,
  stickerSize,
} from '@/lib/stickerLayout'
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

  const done = sticker.status === 'done'
  const metrics = useMemo(
    () => layoutTypeForBox(w, h, sticker.title, done),
    [w, h, sticker.title, done],
  )

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
      const nextX = originX + (ev.clientX - startClientX)
      const nextY = originY + (ev.clientY - startClientY)
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

  const onDoubleClickBorderReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onPatchRef.current(stickerIdRef.current, {
      size: {
        w: STICKER_LAYOUT.DEFAULT_W,
        h: STICKER_LAYOUT.DEFAULT_H,
      },
      rotation: 0,
    })
  }, [])

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

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        const { dxl, dyl } = screenDeltaToLocal(dx, dy, startRot)
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
        const minH = done
          ? STICKER_LAYOUT.MIN_H
          : minTodoStickerHeight(draft.w, draft.h)
        const next = computeResize(
          corner,
          dxl,
          dyl,
          startPos,
          startW,
          startH,
          minW,
          minH,
        )
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
        const minH = done
          ? STICKER_LAYOUT.MIN_H
          : minTodoStickerHeight(draft.w, draft.h)
        const next = computeResize(
          corner,
          dxl,
          dyl,
          startPos,
          startW,
          startH,
          minW,
          minH,
        )
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
    [done],
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
  const z = dragging || selected ? 25 : 10

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
          'relative box-border h-full w-full overflow-hidden rounded-xl text-left shadow-sm',
          done
            ? 'border border-amber-200/80 bg-amber-50/95 text-stone-800'
            : 'border border-dashed border-amber-400/70 bg-white/55 text-stone-700 backdrop-blur-[2px]',
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
              fontSize: metrics.fontSize,
              lineHeight: `${metrics.lineHeight}px`,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          >
            {sticker.title}
          </p>
          {!done && (
            <span
              className="pointer-events-none mt-0.5 block font-medium uppercase tracking-wide text-amber-700/80"
              style={{ fontSize: metrics.subSize }}
            >
              待办
            </span>
          )}
        </div>
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
