import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import type { Sticker } from '@/types/sticker'

type Props = {
  sticker: Sticker
  onMoveEnd: (id: string, position: { x: number; y: number }) => void
  onOpen: (id: string) => void
}

const MOVE_THRESHOLD = 5

export function StickerCard({ sticker, onMoveEnd, onOpen }: Props) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const session = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    originX: number
    originY: number
  } | null>(null)
  const dragListeners = useRef<{
    move: (e: PointerEvent) => void
    up: (e: PointerEvent) => void
  } | null>(null)

  /** 避免 onPointerDown 依赖 position 导致回调频繁替换；松手后应用新坐标 */
  const positionRef = useRef(sticker.position)

  useLayoutEffect(() => {
    positionRef.current = sticker.position
  }, [sticker.position])

  const onMoveEndRef = useRef(onMoveEnd)
  const onOpenRef = useRef(onOpen)
  const stickerIdRef = useRef(sticker.id)

  useEffect(() => {
    onMoveEndRef.current = onMoveEnd
    onOpenRef.current = onOpen
    stickerIdRef.current = sticker.id
  }, [onMoveEnd, onOpen, sticker.id])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const startClientX = e.clientX
    const startClientY = e.clientY
    const pointerId = e.pointerId
    const originX = positionRef.current.x
    const originY = positionRef.current.y

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      setDrag({
        x: ev.clientX - startClientX,
        y: ev.clientY - startClientY,
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
      session.current = null
      setDrag(null)
      setDragging(false)

      const moved = Math.hypot(dx, dy) > MOVE_THRESHOLD
      if (moved) {
        onMoveEndRef.current(stickerIdRef.current, {
          x: originX + dx,
          y: originY + dy,
        })
      } else {
        onOpenRef.current(stickerIdRef.current)
      }
    }

    session.current = {
      pointerId,
      startClientX,
      startClientY,
      originX,
      originY,
    }
    setDrag({ x: 0, y: 0 })
    setDragging(true)
    dragListeners.current = { move: onMove, up: onUp }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  useEffect(() => {
    return () => {
      session.current = null
      const d = dragListeners.current
      if (d) {
        window.removeEventListener('pointermove', d.move)
        window.removeEventListener('pointerup', d.up)
        window.removeEventListener('pointercancel', d.up)
        dragListeners.current = null
      }
    }
  }, [])

  const left = sticker.position.x + (drag?.x ?? 0)
  const top = sticker.position.y + (drag?.y ?? 0)

  const done = sticker.status === 'done'

  return (
    <div
      data-sticker
      className={[
        'absolute max-w-[min(100%,220px)] cursor-grab select-none rounded-xl px-3 py-2 text-left shadow-sm active:cursor-grabbing',
        dragging ? 'z-20 cursor-grabbing' : 'z-10',
        done
          ? 'border border-amber-200/80 bg-amber-50/95 text-stone-800'
          : 'border border-dashed border-amber-400/70 bg-white/55 text-stone-700 backdrop-blur-[2px]',
      ].join(' ')}
      style={{ left, top, touchAction: 'none' }}
      onPointerDown={onPointerDown}
    >
      <p className="pointer-events-none text-sm font-medium leading-snug">
        {sticker.title}
      </p>
      {!done && (
        <span className="pointer-events-none mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-amber-700/80">
          待办
        </span>
      )}
    </div>
  )
}
