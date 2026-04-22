/**
 * 连续自适应日记区布局（与 App + DiarySpread 配合）。
 * 变窄顺序：① 主区内日记左右白边 padX → ② 内联侧栏宽度 → ③ 双页改单页后再收 padX → ④ 再窄则抽屉。
 * 双页设计总宽 BOOK_W = 两页各 HALF_PAGE_W + 书脊；最宽时不再放大纸，只增大两侧留白。
 */

export const DIARY_VIEWPORT = {
  /** 单页 / 双页半页设计宽度（px） */
  HALF_PAGE_W: 500,
  SPINE: 24,
  SIDEBAR_MAX: 280,
  SIDEBAR_MIN: 128,
  PAD_MIN: 8,
  /** 单页模式整体等比缩放（包含贴纸） */
  SINGLE_PAGE_SCALE: 0.9,
  DRAWER_APPROACH_RAMP: 100,
  /** 所有内联模式下给日记的基础下移 */
  BASE_DIARY_TOP: 8,
  /** 接近抽屉阈值时，内联主区内日记顶下移，避免与悬浮球重叠 */
  FAB_AVOID_TOP: 58,
  /** 抽屉模式下日记区额外下移（相对内联 FAB_AVOID） */
  DRAWER_DIARY_EXTRA_TOP: 20,
} as const

/** 双页摊开设计总宽（两半边 + 书脊） */
export const BOOK_DESIGN_WIDTH =
  DIARY_VIEWPORT.HALF_PAGE_W * 2 + DIARY_VIEWPORT.SPINE

export type DiaryViewportLayout = {
  useDrawer: boolean
  sidebarWidth: number
  spreadMode: boolean
  /** 保留字段：当前逻辑双页恒为 1 */
  spreadScale: number
  singleScale: number
  singlePageWidthPx: number
  /** 主区内左右对称白边（与日记、AI 对齐） */
  padX: number
  diaryOffsetTop: number
  /** 日记纸内容宽度（双页总宽或单页宽），供 AI 条与纸对齐 */
  diaryContentWidthPx: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** 单页纸宽 = 双页时半页设计宽 */
export function singlePageWidthFromDesign(): number {
  return DIARY_VIEWPORT.HALF_PAGE_W
}

function diaryOffsetRamp(vw: number, minVwInline: number): number {
  const { DRAWER_APPROACH_RAMP, FAB_AVOID_TOP, BASE_DIARY_TOP } = DIARY_VIEWPORT
  const t = clamp(
    0,
    1,
    (vw - minVwInline) / Math.max(1, DRAWER_APPROACH_RAMP),
  )
  return Math.round(BASE_DIARY_TOP + (1 - t) * FAB_AVOID_TOP)
}

export function computeDiaryViewportLayout(vw: number): DiaryViewportLayout {
  const {
    SIDEBAR_MAX,
    SIDEBAR_MIN,
    PAD_MIN,
    DRAWER_DIARY_EXTRA_TOP,
    BASE_DIARY_TOP,
  } = DIARY_VIEWPORT

  const BOOK_W = BOOK_DESIGN_WIDTH
  const singlePaperW = DIARY_VIEWPORT.HALF_PAGE_W
  const minVwInline = SIDEBAR_MIN + singlePaperW + 2 * PAD_MIN

  const drawerFallback = (): DiaryViewportLayout => ({
    useDrawer: true,
    sidebarWidth: 0,
    spreadMode: false,
    spreadScale: 1,
    singleScale: DIARY_VIEWPORT.SINGLE_PAGE_SCALE,
    singlePageWidthPx: singlePaperW,
    padX: PAD_MIN,
    diaryOffsetTop: Math.round(
      BASE_DIARY_TOP + DIARY_VIEWPORT.FAB_AVOID_TOP + DRAWER_DIARY_EXTRA_TOP,
    ),
    diaryContentWidthPx: singlePaperW * DIARY_VIEWPORT.SINGLE_PAGE_SCALE,
  })

  if (vw < minVwInline) {
    return drawerFallback()
  }

  const mainW = (sb: number) => vw - sb

  // —— 双页：先收 pad，再收侧栏（侧栏恒为 SMAX 时 pad 尽量大）——
  let sidebar: number = SIDEBAR_MAX
  let padX = (mainW(sidebar) - BOOK_W) / 2

  if (padX >= PAD_MIN) {
    return {
      useDrawer: false,
      sidebarWidth: Math.round(sidebar),
      spreadMode: true,
      spreadScale: 1,
      singleScale: 1,
      singlePageWidthPx: singlePaperW,
      padX: Math.round(padX * 2) / 2,
      diaryOffsetTop: diaryOffsetRamp(vw, minVwInline),
      diaryContentWidthPx: BOOK_W,
    }
  }

  padX = PAD_MIN
  sidebar = mainW(0) - 2 * PAD_MIN - BOOK_W
  sidebar = clamp(SIDEBAR_MIN, SIDEBAR_MAX, sidebar)

  if (mainW(sidebar) - 2 * PAD_MIN >= BOOK_W - 1e-6) {
    return {
      useDrawer: false,
      sidebarWidth: Math.round(sidebar),
      spreadMode: true,
      spreadScale: 1,
      singleScale: 1,
      singlePageWidthPx: singlePaperW,
      padX: PAD_MIN,
      diaryOffsetTop: diaryOffsetRamp(vw, minVwInline),
      diaryContentWidthPx: BOOK_W,
    }
  }

  // —— 单页：再收 pad（侧栏先 SMAX），不够则收侧栏 ——
  sidebar = SIDEBAR_MAX
  padX = (mainW(sidebar) - singlePaperW) / 2
  if (padX >= PAD_MIN) {
    padX = Math.round(padX * 2) / 2
    return {
      useDrawer: false,
      sidebarWidth: Math.round(sidebar),
      spreadMode: false,
      spreadScale: 1,
      singleScale: DIARY_VIEWPORT.SINGLE_PAGE_SCALE,
      singlePageWidthPx: singlePaperW,
      padX,
      diaryOffsetTop: diaryOffsetRamp(vw, minVwInline),
      diaryContentWidthPx: singlePaperW * DIARY_VIEWPORT.SINGLE_PAGE_SCALE,
    }
  }

  padX = PAD_MIN
  sidebar = mainW(0) - 2 * PAD_MIN - singlePaperW
  sidebar = clamp(SIDEBAR_MIN, SIDEBAR_MAX, sidebar)

  if (mainW(sidebar) - 2 * PAD_MIN + 1e-6 >= singlePaperW) {
    return {
      useDrawer: false,
      sidebarWidth: Math.round(sidebar),
      spreadMode: false,
      spreadScale: 1,
      singleScale: DIARY_VIEWPORT.SINGLE_PAGE_SCALE,
      singlePageWidthPx: singlePaperW,
      padX: PAD_MIN,
      diaryOffsetTop: diaryOffsetRamp(vw, minVwInline),
      diaryContentWidthPx: singlePaperW * DIARY_VIEWPORT.SINGLE_PAGE_SCALE,
    }
  }

  return drawerFallback()
}
