import { useEffect, useMemo, useState } from 'react'

import {
  computeDiaryViewportLayout,
  type DiaryViewportLayout,
} from '@/lib/diaryViewportLayout'

export function useDiaryViewportLayout(): DiaryViewportLayout {
  const [vw, setVw] = useState(
    () =>
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as unknown as { innerWidth?: number }).innerWidth ===
        'number'
        ? (globalThis as unknown as Window).innerWidth
        : 1200,
  )

  useEffect(() => {
    const read = () => setVw(window.innerWidth)
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  return useMemo(() => computeDiaryViewportLayout(vw), [vw])
}
