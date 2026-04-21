/** 照片贴纸：白边 + 底部说明行布局常量 */
export const PHOTO_STICKER = {
  /** 图片区域外侧白边（单侧 px，总白边为 2×） */
  BORDER_PX: 4,
  /** 底部说明行高度 */
  CAPTION_H: 28,
  /** 初始展示时图片区域最大宽度 */
  MAX_IMG_W: 240,
  /** 初始展示时图片区域最大高度（避免过高） */
  MAX_IMG_H: 220,
} as const

export function loadImageNaturalSize(
  src: string,
): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/** 根据原图尺寸计算贴纸外框宽高（含白边与说明行） */
export function sizeForPhotoSticker(nw: number, nh: number): { w: number; h: number } {
  const b = PHOTO_STICKER.BORDER_PX * 2
  let imgW = nw
  let imgH = nh
  const scale = Math.min(
    PHOTO_STICKER.MAX_IMG_W / Math.max(1, imgW),
    PHOTO_STICKER.MAX_IMG_H / Math.max(1, imgH),
    1,
  )
  imgW = Math.round(imgW * scale)
  imgH = Math.round(imgH * scale)
  const w = Math.max(80, imgW + b)
  const h = Math.max(80, imgH + b + PHOTO_STICKER.CAPTION_H)
  return { w, h }
}

export function isClipboardImageType(type: string): boolean {
  return /^image\/(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(type)
}
