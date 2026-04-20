export type Sticker = {
  id: string
  title: string
  date: string
  description: string
  status: 'done' | 'todo'
  position: { x: number; y: number }
  type: 'text'
}
