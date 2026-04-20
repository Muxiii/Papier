import type { Sticker } from '@/types/sticker'

/** 贴纸布局常量：缩放点热区、最小尺寸、默认尺寸、内边距 */
export const STICKER_LAYOUT = {
  /** 四角缩放点可点热区（正方形边长，px） */
  HANDLE_HIT_PX: 18,
  /** 缩放点可见圆点直径（px） */
  HANDLE_VISUAL_PX: 8,
  /** 贴纸最小宽度（px） */
  MIN_W: 80,
  /** 贴纸最小高度（px） */
  MIN_H: 40,
  /** 新建贴纸默认宽高（px） */
  DEFAULT_W: 220,
  DEFAULT_H: 72,
  /**
   * 角外侧旋转感应区：从角点向外延伸约该尺寸（px），
   * 区域主要在贴纸外，缩放点叠在其上时优先缩放（z-index）。
   */
  ROTATE_CORNER_EXTENT_PX: 28,
  /** 选中时「边框」双击重置热区厚度（px） */
  BORDER_HIT_PX: 14,
  FONT_MIN: 8,
  FONT_MAX: 20,
} as const

let measureCanvas: HTMLCanvasElement | null = null

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  return measureCanvas.getContext('2d')
}

function fontSpec(sizePx: number): string {
  return `500 ${sizePx}px ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"`
}

function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' })
    return Array.from(seg.segment(text), (s) => s.segment)
  }
  return [...text]
}

/** 按宽度折行，返回行数与内容高度（不含额外 margin） */
function wrappedTitleMetrics(
  ctx: CanvasRenderingContext2D,
  title: string,
  maxW: number,
  lineHeight: number,
): { lines: number; height: number } {
  const parts = graphemes(title)
  const lines: string[] = []
  let line = ''
  for (const p of parts) {
    const test = line + p
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = p
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  if (lines.length === 0) lines.push('')
  return {
    lines: lines.length,
    height: lines.length * lineHeight,
  }
}

function textFitsBox(
  innerW: number,
  innerH: number,
  title: string,
  done: boolean,
  fontSize: number,
): boolean {
  if (innerW <= 1 || innerH <= 1) return false
  const ctx = getMeasureCtx()
  if (!ctx) return true
  ctx.font = fontSpec(fontSize)
  const lineHeight = Math.round(fontSize * 1.35)
  const { height: titleH } = wrappedTitleMetrics(ctx, title, innerW, lineHeight)
  const subSize = Math.max(8, Math.round(fontSize * 0.64))
  const subLineHeight = Math.round(subSize * 1.35)
  const todoBlock = done ? 0 : subLineHeight + 2
  return titleH + todoBlock <= innerH
}

/** 旧数据无 size 时的默认 */
export function stickerSize(s: Sticker): { w: number; h: number } {
  return {
    w: s.size?.w ?? STICKER_LAYOUT.DEFAULT_W,
    h: s.size?.h ?? STICKER_LAYOUT.DEFAULT_H,
  }
}

export function stickerRotation(s: Sticker): number {
  return s.rotation ?? 0
}

/**
 * 内边距由 min(width, height) 决定，并在上一版基础上再放大 1 倍。
 * - padX ≈ 24% * minSide（夹在 26~96）
 * - padY ≈ 17.6% * minSide（夹在 16~70）
 */
export function layoutPaddingForBox(width: number, height: number) {
  const side = Math.max(STICKER_LAYOUT.MIN_H, Math.min(width, height))
  const padX = Math.round(Math.max(26, Math.min(96, side * 0.24)))
  const padY = Math.round(Math.max(16, Math.min(70, side * 0.176)))
  return { padX, padY }
}

export function todoRequiredInnerHeight(fontSize: number) {
  const titleLine = Math.round(fontSize * 1.35)
  const subSize = Math.max(6, Math.round(fontSize * 0.64))
  const subLine = Math.round(subSize * 1.35)
  return titleLine + subLine + 2
}

/** 待办贴纸在给定宽高下，为保证“待办”不截断所需最小高度 */
export function minTodoStickerHeight(width: number, height: number) {
  const { padY } = layoutPaddingForBox(width, height)
  const minInner = todoRequiredInnerHeight(STICKER_LAYOUT.FONT_MIN)
  return Math.max(STICKER_LAYOUT.MIN_H, minInner + padY * 2)
}

/**
 * 字号：在 [FONT_MIN, FONT_MAX] 内取**最大**仍能在当前内盒中排下的字号。
 * 宽贴纸但字只占一窄条时，不会仅因贴纸变宽而缩小字号；只有横向/纵向空间不够时才缩小。
 */
export function layoutTypeForBox(
  width: number,
  height: number,
  title: string,
  done: boolean,
): { padX: number; padY: number; fontSize: number; subSize: number; lineHeight: number } {
  const { padX, padY } = layoutPaddingForBox(width, height)
  const innerW = Math.max(0, width - 2 * padX)
  const innerH = Math.max(0, height - 2 * padY)

  let lo: number = STICKER_LAYOUT.FONT_MIN
  let hi: number = STICKER_LAYOUT.FONT_MAX
  let best: number = STICKER_LAYOUT.FONT_MIN
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (textFitsBox(innerW, innerH, title, done, mid)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  const fontSize = best
  const subSize = Math.max(6, Math.round(fontSize * 0.64))
  const lineHeight = Math.round(fontSize * 1.35)
  return { padX, padY, fontSize, subSize, lineHeight }
}

/** 屏幕位移 → 贴纸局部坐标位移（CSS rotate(deg) 顺时针为正） */
export function screenDeltaToLocal(
  dx: number,
  dy: number,
  rotationDegCW: number,
): { dxl: number; dyl: number } {
  const r = (rotationDegCW * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { dxl: dx * c + dy * s, dyl: -dx * s + dy * c }
}
