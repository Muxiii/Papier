export type Sticker = {
  id: string
  title: string
  date: string
  description: string
  status: 'done' | 'todo' | 'note'
  position: { x: number; y: number }
  /** 缺省或 `text` 表示文字贴纸；`photo` 为粘贴图片 */
  type?: 'text' | 'photo'
  /** 照片贴纸：base64 data URL */
  imageDataUrl?: string
  /** 照片原图像素，用于双击边框重置尺寸 */
  imageNaturalW?: number
  imageNaturalH?: number
  /** 像素宽高；旧存档无此字段时由 stickerLayout 取默认 */
  size?: { w: number; h: number }
  /** 顺时针旋转角度（度） */
  rotation?: number
  /** 堆叠层级：值越大越靠上 */
  zIndex?: number
}
