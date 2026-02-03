# FeedbackFlow

Capture developer feedback with voice narration and intelligent screenshots.
Generate AI-ready Markdown documents in seconds.

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

## Features

- **Voice narration capture** with real-time transcription (Deepgram)
- **Intelligent screenshot timing** on voice pauses
- **Markdown output** optimized for AI coding assistants
- **Clipboard integration** for instant pasting
- **Global hotkey**: `Cmd+Shift+F` (start/stop)

## How It Works

1. Press `Cmd+Shift+F` to start a feedback session
2. Narrate what you see and think out loud
3. Screenshots are captured automatically during voice pauses
4. Press `Cmd+Shift+F` again to stop
5. Markdown document is copied to clipboard, ready to paste into your AI assistant

## Target Users

Developers using AI coding assistants (Claude Code, Cursor, Copilot) who need fast feedback loops for:
- Bug reports
- Feature requests
- Code reviews
- UI/UX feedback

## Architecture

```
feedbackflow/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Main entry point
│   │   ├── capture/       # Screen capture module
│   │   ├── audio/         # Audio capture module
│   │   ├── transcription/ # Deepgram transcription
│   │   ├── output/        # Document generation
│   │   └── settings/      # Settings manager
│   ├── renderer/          # React UI
│   └── preload/           # Electron preload scripts
└── ...
```

## Configuration

Create a `.env.local` file with your Deepgram API key:

```
DEEPGRAM_API_KEY=your_api_key_here
```

## License

MIT
