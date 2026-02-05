# FeedbackFlow Audit (Wave 1)

Scope: Electron (main/preload) + React/TS (renderer) + audio/screenshot/transcription pipeline.

## P0 (Critical: security, data loss, app stability)

1. IPC hardening is bypassable because `electronAPI` is exposed to the renderer

- Evidence: `src/preload/index.ts:57` exposes `contextBridge.exposeInMainWorld("electron", electronAPI)`.
- Risk: depending on what `@electron-toolkit/preload` exposes at runtime, the renderer may gain a generic `ipcRenderer` / privileged surface that bypasses your channel allowlist (`api.invoke`). This negates the main IPC security control.
- Fix:
  - Stop exposing `electronAPI` wholesale; expose only the minimum fields you actually need (you currently only type `window.electron.process.versions` in `src/renderer/types/api.d.ts:50`).
  - Alternatively, expose `electronAPI` only in dev behind a build-time flag, and keep production restricted.
  - Add an automated check/test that `window.electron` does not contain `ipcRenderer` in production.

2. External links use `window.open`, but the main process does not restrict new windows

- Evidence: `src/renderer/components/DonateButton.tsx:50` uses `window.open(KOFI_URL, '_blank')`.
- Risk: Electron will create a new `BrowserWindow` for `window.open` unless you intercept it. That window often ends up with weaker defaults (and it is a common escalation path if any XSS exists).
- Fix:
  - In `src/main/index.ts` (inside `createWindow()`), set `window.webContents.setWindowOpenHandler(...)` to deny all opens and route external URLs through `shell.openExternal`.
  - Replace `window.open` with a safe IPC call (`shell:openExternal`) or a dedicated `api.openExternal(url)` exposed from preload.

3. Session timeouts/force transitions can leave orphaned recording/transcription processes and corrupt session state

- Evidence:
  - `src/main/services/SessionController.ts:117` watchdog forces state transitions by time (`STATE_TIMEOUTS`).
  - `src/main/services/SessionController.ts:132` calls `forceTransition(...)` which only changes state; it does not stop audio, end transcription, or perform the corresponding lifecycle action.
  - `src/main/services/SessionController.ts:193` `withTimeout(...)` resolves a fallback value but does not cancel the underlying operation.
  - `src/main/services/SessionController.ts:238` start uses `withTimeout(() => audioService.startRecording(...), 4000, null)`.
  - `src/main/services/SessionController.ts:73` stop uses `withTimeout(() => audioService.stopRecording(), 2500, null)`.
- Failure modes you can hit in real use:
  - Start times out -> UI enters error, but recording process may still be running in background.
  - Stop times out -> UI proceeds to transcription while audio process is still writing to file.
  - Watchdog moves RECORDING -> STOPPING/PROCESSING/COMPLETE without ever stopping the recorder.
- Fix:
  - Replace “state-only” watchdog transitions with “actionful” recovery (e.g., on RECORDING timeout, call `await stop()`; on STARTING timeout, call a dedicated cleanup that kills `AudioService` and resets state).
  - Make timeouts cancellable. Use `AbortController` patterns across services:
    - `AudioService.startRecording({ signal })` and `stopRecording({ signal })`
    - `TranscriptionService.transcribe({ signal })` that kills spawned whisper process on abort
  - Ensure any timeout path calls cleanup (kill process + set `isRecording=false` + `endSession()` for screenshots).

4. `session:reset` can silently leak/leave a recording process running

- Evidence: `src/main/services/SessionController.ts:333` `reset()` clears state and sets IDLE but does not stop audio or end screenshot session.
- Risk: user hits Reset (or renderer calls it in error states) while recording; audio continues in background, producing files and consuming mic.
- Fix: make `reset()` behave like `cancel()` + state store clear:
  - if recording, stop recorder; always `screenshotService?.endSession()`; then clear state + fresh session.

5. Report filenames can collide and overwrite existing reports (data loss)

- Evidence: `src/main/services/SessionController.ts:331` uses `session-YYYY-MM-DD-HHMM.md` (minute precision) and `writeFileSync` (`src/main/services/SessionController.ts:42`).
- Risk: two sessions within the same minute overwrite the prior report.
- Fix:
  - Include seconds (and/or a short session id) in the filename, or check for existence and append `-2`, `-3`, etc.
  - Prefer atomic write strategy: write temp then rename.

6. Audio start marks “recording” on process spawn, without verifying the recorder stays alive

- Evidence: `src/main/services/AudioService.ts:83` sets `isRecording=true` in `markStarted()`; `src/main/services/AudioService.ts:109` resolves on `once('spawn')`. No “early exit” handling exists.
- Risk: permission denied / device missing can cause the process to spawn and then exit immediately; UI enters RECORDING but nothing is recorded.
- Fix:
  - Add a short “startup grace” check: if process exits within e.g. 300–500ms, treat as failure (reject) and surface stderr.
  - Listen for `close/exit` events during recording and emit a fatal error so `SessionController` can transition to ERROR + cleanup.

7. Screenshot capture requests full-resolution thumbnails; this can spike memory and stall the main process

- Evidence: `src/main/services/ScreenshotService.ts:52` requests `thumbnailSize` at `display.size * scaleFactor`.
- Risk: 4K/5K + retina scale can allocate very large bitmaps in the main process (jank, OOM, beachball).
- Fix:
  - Capture at a capped resolution (e.g. max 1920px wide) and store PNG/JPEG accordingly.
  - Consider doing capture work off the hot path (queue captures; avoid capturing while STOPPING/PROCESSING).

## P1 (Important: UX correctness, resilience, maintainability)

1. Renderer IPC calls lack error handling; UI can get stuck in loading states

- Evidence:
  - `src/renderer/hooks/useSession.ts:11` initial `invoke` is not `catch`ed.
  - `src/renderer/hooks/useSession.ts:30` `start()` sets `isLoading=true` but does not handle thrown/rejected invoke; same pattern in `stop()` (`src/renderer/hooks/useSession.ts:39`).
  - `src/renderer/hooks/useTranscription.ts:12`/`:17` initial `invoke`s are not `catch`ed.
- Fix:
  - Wrap all `invoke` calls in try/catch; on failure set an error state and reset loading.
  - Standardize the IPC return type as `{ ok: true, data } | { ok: false, error }` so the renderer can handle errors consistently.

2. Error UI suggests “Go to Settings”, but App never wires the callback

- Evidence:
  - `src/renderer/components/ErrorView.tsx:99` expects `onOpenSettings` for settings-directed errors.
  - `src/renderer/App.tsx:147` renders `<ErrorView ... onReset={reset} />` without `onOpenSettings`.
- UX impact: model-missing errors tell the user to go to Settings, but the action can’t take them there.
- Fix: pass `onOpenSettings={() => setView('settings')}` when rendering `ErrorView`.

3. Recovery pathway exists in main, but renderer does not handle it

- Evidence:
  - Main emits recovery event: `src/main/index.ts:153` `webContents.send('recovery:found', savedSession)`.
  - No renderer listener found for `recovery:found` (no matches under `src/renderer`).
- UX impact: users who crash/quit mid-recording won’t be prompted to recover; state may remain inconsistent.
- Fix:
  - Add a recovery modal/view that listens to `recovery:found` and offers Recover/Discard.
  - Do not accept arbitrary session objects from the renderer (`src/main/ipc.ts:73`); prefer `recovery:recover` to load from disk by id, or validate shape strictly.

4. IPC handlers accept unvalidated payloads and can be future footguns

- Evidence:
  - `src/main/ipc.ts:54` `transcription:setConfig` takes `config` without validation.
  - `src/main/ipc.ts:73` `recovery:recover` takes a full `SessionData` from renderer.
- Fix:
  - Validate inputs (manual guards or a schema lib) and return structured errors.
  - In general: renderer should request actions; main should own trusted state.

5. Transcription language config conflicts with English-only model files

- Evidence:
  - Model files are `.en.bin`: `src/main/services/TranscriptionService.ts:73`.
  - UI allows non-English language selection: `src/renderer/components/SettingsView.tsx:105`.
- UX impact: selecting non-English may not behave as expected.
- Fix:
  - Either constrain UI to English-only models, or support multilingual model files + correct naming (`ggml-<model>.bin`) and URLs.

6. Model download has no timeout/cancelation and can leave partial state

- Evidence: `src/main/services/TranscriptionService.ts:90` `downloadModel` uses `https.get` without request timeout/abort.
- Fix:
  - Add request timeouts, cancellation (AbortController), and resumable/cleanup behavior.

7. Global shortcuts registration failures are ignored

- Evidence: `src/main/index.ts:102` registers shortcuts without checking the boolean return value.
- UX impact: user expects Cmd+Shift+F/S to work; on conflict it silently doesn’t.
- Fix:
  - Check return; if false, surface a UI warning (and/or tray menu item) and log an actionable message.

8. Permissions are not proactively handled (microphone + screen recording)

- Evidence:
  - `src/main/services/AudioService.ts:232` `checkMicrophonePermission()` always returns true (placeholder).
  - `src/main/services/ScreenshotService.ts:52` uses `desktopCapturer` which can fail/return blank frames on macOS when Screen Recording permission is missing.
- UX impact: failures look like “recording failed”/silent screenshot failure, without clear “go enable permission” guidance.
- Fix:
  - Use `systemPreferences.askForMediaAccess('microphone')` before starting recording and surface a first-run prompt flow.
  - Detect screenshot permission failure patterns (empty thumbnail, known errors) and show a guided message pointing to System Settings.

9. Session error semantics are inconsistent (hard failures reported as COMPLETE)

- Evidence: `src/main/services/SessionController.ts:301` catches transcription errors and still transitions to COMPLETE with "[Transcription failed]".
- UX impact: user sees “Complete!” when the core value (transcription) failed; they may miss that it failed.
- Fix: consider a dedicated state like `complete_with_errors` or keep COMPLETE but surface a prominent warning in `src/renderer/components/CompleteView.tsx:108`.

## P2 (Nice-to-have: polish, consistency, minor perf)

1. `role="application"` can reduce accessibility in screen readers

- Evidence: `src/renderer/App.tsx:156`.
- Fix: remove unless you’re implementing a full custom keyboard interaction model.

2. Duplicate transcription state fetching/listeners across views

- Evidence: `useTranscription()` is called in both `src/renderer/components/IdleView.tsx:11` and `src/renderer/components/SettingsView.tsx:16`.
- Impact: extra IPC calls/listeners on each view mount.
- Fix: hoist transcription state to App-level and pass props down, or keep a singleton store (e.g. Zustand already in deps).

3. Dead/unused state timeout member in SessionController

- Evidence: `src/main/services/SessionController.ts:83` `stateTimeout` exists, `clearStateTimeout()` is called, but nothing ever sets `stateTimeout`.
- Fix: remove it or implement it (prefer implementing actionful timeouts as noted in P0).

4. Screenshot capture is primary-display only

- Evidence: `src/main/services/ScreenshotService.ts:49` always uses `screen.getPrimaryDisplay()`.
- Fix: allow capturing the display containing the focused window / mouse cursor, or provide a selector.

5. Security baseline tightening for Electron

- Evidence: `src/main/index.ts:41` sets `sandbox: false`.
- Fix:
  - Enable `sandbox: true` if feasible.
  - Add `webContents.on('will-navigate', ...)` to block unexpected navigations.
  - Consider tightening CSP further once `window.open` and other surfaces are controlled.

6. Multi-instance behavior not defined

- Evidence: no use of `app.requestSingleInstanceLock()` in `src/main/index.ts`.
- Impact: launching the app twice can create multiple tray icons / conflicting global shortcuts.
- Fix: acquire single-instance lock and focus existing instance on second launch.

---

Suggested next actions (practical order):

1. Lock down renderer surface area: remove/trim `electronAPI` exposure + add `setWindowOpenHandler` + route external URLs via `shell.openExternal`.
2. Fix session lifecycle correctness: make watchdog timeouts actionful + make `reset()`/timeouts perform cleanup + make timeouts cancellable.
3. Fix data loss + correctness: unique report filenames; validate recorder stays alive; cap screenshot resolution.
