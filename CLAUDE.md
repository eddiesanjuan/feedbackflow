# CLAUDE.md - markupr

## Project Overview

markupr is a macOS menu bar app that intelligently captures developer feedback. It records your screen and voice simultaneously, then uses an intelligent post-processing pipeline to correlate transcript timestamps with the screen recording — extracting the right frames at the right moments and stitching everything into a structured, AI-ready Markdown document. The output is purpose-built for AI coding agents: every screenshot placed exactly where it belongs, every issue clearly documented.

**Version:** 0.1.0 (MVP in development)

## Tech Stack

- **Framework:** Electron + React + TypeScript
- **Build:** electron-vite + Vite
- **Transcription:** OpenAI WebSocket API (Nova-2 model)
- **Testing:** Vitest
- **Package:** electron-builder

## Architecture

```
src/
├── main/           # Electron main process
│   ├── index.ts    # Entry point, window management, IPC
│   ├── capture/    # Screen capture via desktopCapturer
│   ├── audio/      # Microphone capture, VAD
│   ├── transcription/  # OpenAI integration
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
2. Continuous screen recording via MediaRecorder (VP9/VP8, up to 4K@30fps)
3. Voice capture + real-time transcription (Deepgram/Whisper/macOS Dictation tiers)
4. Intelligent post-processing: timestamp-correlated frame extraction from screen recording
5. Structured Markdown output with contextually-placed screenshots

## Configuration

Requires `.env.local` with:
```
DEEPGRAM_API_KEY=your_key_here
```

## Development Notes

- Floating window: 400x300, frameless, always-on-top
- Screenshots captured as base64 for embedding in Markdown
- Voice activity detection uses simple amplitude threshold
