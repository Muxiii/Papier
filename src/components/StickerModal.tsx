import { useState } from 'react'

import { formatStickerDate, isStickerContentEditable } from '@/lib/date'
import type { Sticker } from '@/types/sticker'

type Props = {
  sticker: Sticker
  onClose: () => void
  onPatchSticker: (id: string, patch: Partial<Sticker>) => void
  onDelete: (id: string) => void
  onSaveEdit: (
    id: string,
    patch: { title: string; description: string },
  ) => void
}

/** 由父级 `key={modalId}` 挂载，打开不同贴纸时重置表单初值 */
export function StickerModal({
  sticker,
  onClose,
  onPatchSticker,
  onDelete,
  onSaveEdit,
}: Props) {
  const [draftTitle, setDraftTitle] = useState(() => sticker.title)
  const [draftDesc, setDraftDesc] = useState(() => sticker.description)

  const isDone = sticker.status === 'done'
  const isTodo = sticker.status === 'todo'
  const isNote = sticker.status === 'note'
  const canEdit = isStickerContentEditable(sticker.date)

  const handleSaveEdit = () => {
    const title = draftTitle.trim()
    if (!title) return
    onSaveEdit(sticker.id, { title, description: draftDesc })
    onClose()
  }

  const statusLabel = isNote ? 'Fragments' : isDone ? '已完成' : '待办'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-[#fdfbf7] p-5 shadow-xl ring-1 ring-stone-200/80"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {canEdit ? (
          <>
            <p className="text-xs font-medium text-stone-500">
              {statusLabel} · 可编辑
            </p>
            <label className="mt-2 block text-sm text-stone-700">
              标题
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base font-semibold text-stone-900"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />
            </label>
            <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
              <span aria-hidden>📅</span>
              {formatStickerDate(sticker.date)}
            </p>
            <label className="mt-3 block text-sm text-stone-700">
              {isNote ? '内容' : '简介'}
              <textarea
                className="mt-1 min-h-[100px] w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800"
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder={isNote ? '记录的文字…' : '可选'}
              />
            </label>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
              onClick={handleSaveEdit}
            >
              保存修改
            </button>
          </>
        ) : (
          <>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
              <span aria-hidden>{isNote ? '🗒' : isDone ? '✅' : '🔒'}</span>
              {sticker.title}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
              <span aria-hidden>📅</span>
              {formatStickerDate(sticker.date)}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              昨日及以前的贴纸不可编辑标题与简介
            </p>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
              <span className="mr-1" aria-hidden>
                📝
              </span>
              {sticker.description.trim() || '（暂无描述）'}
            </div>
          </>
        )}

        {isDone ? (
          <>
            <button
              type="button"
              className="mt-5 w-full rounded-lg border border-stone-300 bg-white py-2 text-sm text-stone-700 transition hover:bg-stone-50"
              onClick={() => onPatchSticker(sticker.id, { status: 'todo' })}
            >
              标记为未完成
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-red-200 bg-white py-2 text-sm text-red-600 transition hover:bg-red-50"
              onClick={() => onDelete(sticker.id)}
            >
              删除贴纸
            </button>
          </>
        ) : isTodo ? (
          <div className="mt-5 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-xl bg-[#DEBD8C] py-2.5 text-sm font-medium text-white transition hover:opacity-95"
                onClick={() => onPatchSticker(sticker.id, { status: 'done' })}
              >
                已完成
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                onClick={onClose}
              >
                取消待办
              </button>
            </div>
            <button
              type="button"
              className="w-full rounded-lg border border-red-200 bg-white py-2 text-sm text-red-600 transition hover:bg-red-50"
              onClick={() => onDelete(sticker.id)}
            >
              删除贴纸
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-lg border border-stone-300 bg-white py-2 text-sm text-stone-700 transition hover:bg-stone-50"
              onClick={() => onPatchSticker(sticker.id, { status: 'todo' })}
            >
              转为待办
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-red-200 bg-white py-2 text-sm text-red-600 transition hover:bg-red-50"
              onClick={() => onDelete(sticker.id)}
            >
              删除贴纸
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
