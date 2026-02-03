# CLAUDE.md - FeedbackFlow

## Project Overview

FeedbackFlow is a standalone Electron desktop app that captures developer feedback through voice narration and intelligent screenshots, generating AI-ready Markdown documents.

**Version:** 0.1.0 (MVP in development)

## Tech Stack

- **Framework:** Electron + React + TypeScript
- **Build:** electron-vite + Vite
- **Transcription:** Deepgram WebSocket API (Nova-2 model)
- **Testing:** Vitest
- **Package:** electron-builder

## Architecture

```
src/
├── main/           # Electron main process
│   ├── index.ts    # Entry point, window management, IPC
│   ├── capture/    # Screen capture via desktopCapturer
│   ├── audio/      # Microphone capture, VAD
│   ├── transcription/  # Deepgram integration
│   ├── output/     # Markdown generation
│   └── settings/   # Persistent settings
├── renderer/       # React UI
│   ├── App.tsx     # Main component
│   └── components/ # UI components
├── preload/        # Context bridge (secure IPC)
└── shared/         # Types shared between processes
```

## Commands

```bash
npm run dev        # Development mode with hot reload
npm run build      # Build for production
npm run package    # Package for distribution
npm test           # Run tests
npm run lint       # Lint code
npm run typecheck  # TypeScript check
```

## IPC Communication

All main/renderer communication goes through the preload script. See `src/shared/types.ts` for IPC channel names.

## MVP Scope

1. Global hotkey (Cmd+Shift+F) to start/stop
2. Voice capture via browser MediaRecorder
3. Real-time transcription via Deepgram
4. Screenshot on voice pause (1.5s threshold)
5. Markdown output to clipboard

## Configuration

Requires `.env.local` with:
```
DEEPGRAM_API_KEY=your_key_here
```

## Development Notes

- Floating window: 400x300, frameless, always-on-top
- Screenshots captured as base64 for embedding in Markdown
- Voice activity detection uses simple amplitude threshold
