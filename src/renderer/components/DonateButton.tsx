import { useState, useEffect } from 'react'

const DONATE_MESSAGES = [
  'Buy Eddie a Coffee',
  'Buy Eddie Legos',
  'Buy Eddie Golf Balls',
  'Buy Eddie Tacos',
  'Buy Eddie a Plant',
  'Buy Eddie Socks',
  "Fund Eddie's Caffeine Addiction",
  'Support Open Source Chaos',
  'Keep Eddie Coding',
  'Taco Tuesday Sponsor'
]

const KOFI_URL = 'https://ko-fi.com/eddiesanjuan'

function getStoredMessageIndex(): number {
  try {
    const stored = localStorage.getItem('donateMessageIndex')
    if (stored !== null) {
      return parseInt(stored, 10)
    }
  } catch {
    // Ignore localStorage errors
  }
  return 0
}

function setStoredMessageIndex(index: number): void {
  try {
    localStorage.setItem('donateMessageIndex', String(index))
  } catch {
    // Ignore localStorage errors
  }
}

export function DonateButton() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    // Rotate message on each mount (app launch)
    const currentIndex = getStoredMessageIndex()
    const nextIndex = (currentIndex + 1) % DONATE_MESSAGES.length
    setStoredMessageIndex(nextIndex)
    setMessageIndex(nextIndex)
  }, [])

  const handleClick = async () => {
    await window.api.invoke('shell:openExternal', KOFI_URL)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`${DONATE_MESSAGES[messageIndex]} (opens in browser)`}
      className="group flex items-center gap-2 px-3 py-1.5 text-xs text-theme-muted hover:text-pink-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ring-offset-theme rounded"
    >
      <svg
        className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      <span>{DONATE_MESSAGES[messageIndex]}</span>
      <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7z"/>
      </svg>
    </button>
  )
}
