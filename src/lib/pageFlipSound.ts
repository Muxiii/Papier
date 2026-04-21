const FLIP_AUDIO_PATHS = {
  1: '/单页翻页音效.MP3',
  2: '/翻2次音效.MP3',
  3: '/翻3次音效.MP3',
} as const

const audioCache: Partial<Record<1 | 2 | 3, HTMLAudioElement>> = {}

function getAudioForCount(count: 1 | 2 | 3): HTMLAudioElement {
  const cached = audioCache[count]
  if (cached) return cached
  const audio = new Audio(encodeURI(FLIP_AUDIO_PATHS[count]))
  audio.preload = 'auto'
  audioCache[count] = audio
  return audio
}

function burstCount(stepCount: number) {
  if (stepCount <= 1) return 1
  if (stepCount <= 4) return 2
  return 3
}

export function playPageFlip(stepCount = 1) {
  const count = burstCount(Math.max(1, stepCount)) as 1 | 2 | 3
  const baseAudio = getAudioForCount(count)
  /**
   * 不复用同一个播放实例，避免连续点击时出现
   * "The play() request was interrupted" 导致的偶发静音。
   */
  const playbackAudio = baseAudio.cloneNode(true) as HTMLAudioElement
  playbackAudio.currentTime = 0
  void playbackAudio.play().catch(() => {})
}

