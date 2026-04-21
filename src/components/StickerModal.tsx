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

  const isPhoto = sticker.type === 'photo'
  const isDone = sticker.status === 'done'
  const isTodo = sticker.status === 'todo'
  const isNote = sticker.status === 'note'
  const canEdit = isStickerContentEditable(sticker.date)

  const handleSaveEdit = () => {
    if (isPhoto) {
      onSaveEdit(sticker.id, { title: '', description: draftDesc })
      onClose()
      return
    }
    const title = draftTitle.trim()
    if (!title) return
    onSaveEdit(sticker.id, { title, description: draftDesc })
    onClose()
  }

  const handleDeleteWithConfirm = () => {
    const ok = window.confirm('确认删除这张贴纸吗？删除后无法恢复。')
    if (!ok) return
    onDelete(sticker.id)
  }

  const statusLabel = isPhoto
    ? '照片'
    : isNote
      ? 'Fragments'
      : isDone
        ? '已完成'
        : '待办'

  return (
    <div
      className="fixed inset-0 z-[21000] flex items-end justify-center bg-black/35 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-[#fdfbf7] p-5 shadow-xl ring-1 ring-stone-200/80"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-stone-500">
            {canEdit
              ? `${statusLabel} · 可编辑 · ${formatStickerDate(sticker.date)}`
              : `${statusLabel} · ${formatStickerDate(sticker.date)}`}
          </p>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-600"
            aria-label="删除贴纸"
            title="删除贴纸"
            onClick={handleDeleteWithConfirm}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
              <path d="M10 10v7" />
              <path d="M14 10v7" />
            </svg>
          </button>
        </div>
        {isPhoto && sticker.imageDataUrl ? (
          canEdit ? (
            <>
              <div className="mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white p-2">
                <img
                  src={sticker.imageDataUrl}
                  alt=""
                  className="max-h-[220px] w-full object-contain"
                  draggable={false}
                />
              </div>
              <label className="mt-3 block text-sm text-stone-700">
                <textarea
                  className="mt-1 min-h-[100px] w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800"
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="简介"
                  aria-label="照片说明"
                />
              </label>
              <button
                type="button"
                className="mt-4 w-full rounded-lg bg-[#DEBD8C] py-2.5 text-sm font-medium text-white transition hover:opacity-95"
                onClick={handleSaveEdit}
              >
                保存修改
              </button>
            </>
          ) : (
            <>
              <div className="mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white p-2">
                <img
                  src={sticker.imageDataUrl}
                  alt=""
                  className="max-h-[220px] w-full object-contain"
                  draggable={false}
                />
              </div>
              <p className="mt-1 text-xs text-stone-500">
                昨日及以前的贴纸不可编辑说明文字
              </p>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                {sticker.description.trim() || '（暂无说明）'}
              </div>
            </>
          )
        ) : canEdit ? (
          <>
            <label className="mt-2 block text-sm text-stone-700">
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-base font-semibold text-stone-900"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="标题"
                aria-label="标题"
              />
            </label>
            <label className="mt-3 block text-sm text-stone-700">
              <textarea
                className="mt-1 min-h-[100px] w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-800"
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="简介"
                aria-label={isNote ? '内容' : '简介'}
              />
            </label>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-[#DEBD8C] py-2.5 text-sm font-medium text-white transition hover:opacity-95"
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

        {!isPhoto && isDone ? (
          <>
            <button
              type="button"
              className="mt-2 w-full py-1 text-center text-xs text-stone-500 underline-offset-2 transition hover:text-stone-700 hover:underline"
              onClick={() => onPatchSticker(sticker.id, { status: 'todo' })}
            >
              标记为未完成
            </button>
          </>
        ) : !isPhoto && isTodo ? (
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
          </div>
        ) : !isPhoto && isNote ? (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-lg border border-stone-300 bg-white py-2 text-sm text-stone-700 transition hover:bg-stone-50"
              onClick={() => onPatchSticker(sticker.id, { status: 'todo' })}
            >
              转为待办
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
