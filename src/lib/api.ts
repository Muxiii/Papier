import type { ChatCandidate } from '@/types/chat'

export type { ChatCandidate }

export type ChatContext = {
  /** App 当前查看日：用户说「今天」「这天」及相对「明天」等以此日为叙事基准推算 */
  anchorDate: string
  /** 设备本地「真实今天」，用于与 anchor 不一致时的消歧（一般与 anchor 相同） */
  clientToday: string
}

export type ChatResponse = {
  reply: string
  candidates: ChatCandidate[]
}

export async function postChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context: ChatContext,
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  })
  const data = (await res.json()) as { error?: string } & Partial<ChatResponse>
  if (!res.ok) {
    throw new Error(data.error ?? '请求失败')
  }
  return {
    reply: data.reply ?? '',
    candidates: data.candidates ?? [],
  }
}
