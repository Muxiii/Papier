export type Sticker = {
  id: string
  title: string
  date: string
  description: string
  status: 'done' | 'todo'
  position: { x: number; y: number }
  type: 'text'
  /** 像素宽高；旧存档无此字段时由 stickerLayout 取默认 */
  size?: { w: number; h: number }
  /** 顺时针旋转角度（度） */
  rotation?: number
}
