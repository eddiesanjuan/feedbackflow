# FeedbackFlow Mission Brief

**Objective:** Build an Apple-quality menu bar app for developer feedback capture.

## Core Philosophy
- **Feels like Apple made it** - Light, clean, snappy
- **Zero friction** - Works out of box, no API keys required
- **One purpose** - Voice → Screenshots → Markdown → AI

## MVP Features (Ship This)
1. Menu bar icon (not dock app)
2. Click to start/stop recording
3. Global hotkey for screenshots during recording
4. Local Whisper transcription (offline, no API needed)
5. Generate Markdown report with embedded screenshot links
6. One-click copy to clipboard
7. Donate button with rotating funny messages

## Quality Bar
- No stuck states
- Graceful error handling
- Crash recovery
- First-time UX that just works
- Native macOS feel (SF Symbols, system colors)

## Tech Stack (Locked)
- Electron 35+ with electron-vite
- React 18 + TypeScript
- Tailwind CSS
- Local Whisper via whisper-node
- No backend, runs 100% locally

## Non-Goals (v1)
- Windows/Linux support
- Cloud transcription
- Screen recording (future)
- Multiple export formats

## Success Criteria
Someone downloads, runs, records feedback, gets Markdown, pastes to Claude. Under 2 minutes, zero config.
