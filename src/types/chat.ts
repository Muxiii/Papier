/** sticker_date：贴纸应落在哪一天（yyyy-MM-dd），由 AI 结合用户语句与 anchorDate 推算 */
export type ChatCandidate = {
  title: string
  status: 'done' | 'todo' | 'note'
  sticker_date?: string
}

export type ChatMessage =
  | { id: string; role: 'user'; content: string }
  | {
      id: string
      role: 'assistant'
      content: string
      candidates?: ChatCandidate[]
    }
