# FeedbackFlow Audit Pass 2

Date: 2026-02-05

## Scope

- Second-pass review of previous audit changes
- Additional bug/edge case hunt (error handling, UX flow, security, performance, types)

## Review of Prior Audit Changes

- Screenshot hotkey moved to Cmd+Shift+S: correct and avoids macOS capture conflict.
- Added whisper-cpp requirement messaging (README + UI): correct and user-facing guidance is helpful.
- Transcription timeout cleanup: correct; avoids lingering timers.
- StateStore destroy uses sync flush: correct for ensuring data persistence on quit.
- Processing/Idle UI copy tweaks: correct and improves clarity.

## Fixes Applied in Pass 2

- Audio recording start race and fallback handling: start now resolves on process spawn and avoids double-resolve when rec is missing; stop cleanup de-duplicates exit/timeout paths.
- StateStore persistence loop: flush now clears pending state and interval to avoid continuous background writes after a save.
- Whisper model download robustness: download now uses a temp file, cleans up on errors, handles redirects, and only finalizes on successful rename; size check prevents partial files being treated as valid.
- Whisper output handling: if stdout is empty with `-otxt`, the service now reads the generated `.txt` output file.
- Whisper binary discovery: PATH-based lookup restored to support non-Homebrew installs.
- IPC hardening: preload now whitelists allowed IPC channels and blocks unknown ones; BrowserWindow explicitly sets `contextIsolation: true` and `nodeIntegration: false`.
- Settings UX: changing the Whisper model now re-checks readiness so the UI doesn’t incorrectly show “Ready.”
- SessionController force-transition: oldState is now preserved when resetting to IDLE to keep event payloads accurate.

## Remaining Notes / Recommendations

- The `preferredTier` config is still not enforced (Whisper is always attempted if a model exists). Consider honoring it or removing the option.
- Whisper model download lacks checksum validation; HTTPS is used, but integrity checks would further harden supply-chain security.
- Generated markdown embeds absolute screenshot paths; acceptable for local use, but consider relative paths or export flow if sharing externally.

## Files Touched

- src/main/index.ts
- src/main/services/AudioService.ts
- src/main/services/SessionController.ts
- src/main/services/StateStore.ts
- src/main/services/TranscriptionService.ts
- src/preload/index.ts
- src/renderer/hooks/useTranscription.ts
