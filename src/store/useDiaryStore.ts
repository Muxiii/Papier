import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ChatMessage } from '@/types/chat'
import type { Sticker } from '@/types/sticker'

import { todayISO } from '@/lib/date'
import { STICKER_LAYOUT } from '@/lib/stickerLayout'

type DiaryState = {
  viewingDate: string
  stickers: Sticker[]
  chatMessages: ChatMessage[]
  setViewingDate: (d: string) => void
  setChatMessages: (
    update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  addSticker: (
    partial: Omit<Sticker, 'id' | 'position' | 'type'> & {
      position?: { x: number; y: number }
    },
  ) => string
  updateSticker: (id: string, patch: Partial<Sticker>) => void
  removeSticker: (id: string) => void
  getStickersForDate: (date: string) => Sticker[]
  getDayMarks: () => Map<string, { todo: boolean; done: boolean }>
}

function newId(): string {
  return crypto.randomUUID()
}

export const useDiaryStore = create<DiaryState>()(
  persist(
    (set, get) => ({
      viewingDate: todayISO(),
      stickers: [],
      chatMessages: [],
      setViewingDate: (d) => set({ viewingDate: d }),
      setChatMessages: (update) =>
        set((state) => ({
          chatMessages:
            typeof update === 'function'
              ? update(state.chatMessages)
              : update,
        })),
      addSticker: (partial) => {
        const { stickers } = get()
        const sameDay = stickers.filter((s) => s.date === partial.date)
        const idx = sameDay.length
        const topZ = stickers.reduce(
          (max, s) => Math.max(max, s.zIndex ?? 0),
          0,
        )
        const position = partial.position ?? {
          x: 32 + (idx % 4) * 36,
          y: 28 + Math.floor(idx / 4) * 112,
        }
        const sticker: Sticker = {
          id: newId(),
          title: partial.title,
          date: partial.date,
          description: partial.description ?? '',
          status: partial.status,
          position,
          type: 'text',
          size: {
            w: STICKER_LAYOUT.DEFAULT_W,
            h: STICKER_LAYOUT.DEFAULT_H,
          },
          rotation: 0,
          zIndex: topZ + 1,
        }
        set({ stickers: [...stickers, sticker] })
        return sticker.id
      },
      updateSticker: (id, patch) =>
        set({
          stickers: get().stickers.map((s) =>
            s.id === id ? { ...s, ...patch } : s,
          ),
        }),
      removeSticker: (id) =>
        set({ stickers: get().stickers.filter((s) => s.id !== id) }),
      getStickersForDate: (date) =>
        get()
          .stickers.filter((s) => s.date === date)
          .sort((a, b) => a.id.localeCompare(b.id)),
      getDayMarks: () => {
        const m = new Map<string, { todo: boolean; done: boolean }>()
        for (const s of get().stickers) {
          const cur = m.get(s.date) ?? { todo: false, done: false }
          if (s.status === 'todo') cur.todo = true
          if (s.status === 'done') cur.done = true
          m.set(s.date, cur)
        }
        return m
      },
    }),
    {
      name: 'sticker-diary-v1',
      partialize: (s) => ({
        viewingDate: s.viewingDate,
        stickers: s.stickers,
        chatMessages: s.chatMessages,
      }),
    },
  ),
)
