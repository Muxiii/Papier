const SLIDE_AUDIO_PATH = '/audio/滑动.MP3'

let slideAudio: HTMLAudioElement | null = null

function getSlideAudio() {
  if (slideAudio) return slideAudio
  slideAudio = new Audio(encodeURI(SLIDE_AUDIO_PATH))
  slideAudio.preload = 'auto'
  return slideAudio
}

export function playStickerSlide() {
  const baseAudio = getSlideAudio()
  const playbackAudio = baseAudio.cloneNode(true) as HTMLAudioElement
  playbackAudio.currentTime = 0
  void playbackAudio.play().catch(() => {})
}

