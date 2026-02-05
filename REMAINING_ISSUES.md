# FeedbackFlow Remaining Issues

**Date:** 2026-02-05
**Auditor:** @auditor-1 (Synthesis Agent)
**Version:** 0.3.1 (post-P0 fixes)

## Executive Summary

Cross-referenced 5 audit files against current codebase (v0.3.1). The recent commit `bdfd3dc` addressed most P0 critical issues. This synthesis identifies **28 remaining issues** that were either not fully resolved or are new observations.

| Priority | Count | Status |
|----------|-------|--------|
| P0 (Critical) | 0 | All resolved |
| P1 (High) | 6 | Require attention before production |
| P2 (Medium) | 14 | Should fix soon |
| P3 (Low) | 8 | Polish items |

---

## P0 (Critical) - Security / Crash / Data Loss

**All P0 issues from prior audits have been resolved:**

- [x] IPC hardening - electronAPI exposure trimmed to `process.versions` only
- [x] `setWindowOpenHandler` added to block `window.open`, routes via `shell.openExternal`
- [x] Watchdog timeouts now actionful (call `stop()`/cleanup, not just state change)
- [x] `reset()` now stops recording + ends screenshot session before clearing
- [x] Report filenames include seconds + 4-char ID to prevent collisions
- [x] Recorder early-exit detection with 300ms grace period
- [x] Screenshot resolution capped at 1920px

---

## P1 (High) - Fix Before Production Release

### 1. Watchdog Interval Runs Continuously in IDLE State

**Domain:** Performance
**Effort:** Small (~30 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/SessionController.ts:118-121`

**Current State:**
```typescript
private startWatchdog(): void {
  this.watchdogInterval = setInterval(() => {
    this.checkStateHealth();
  }, 1000);
}
```

**Problem:**
The 1-second interval runs indefinitely even when the app is in IDLE state. This wastes CPU cycles and drains battery on laptops.

**Recommended Fix:**
Start watchdog only when entering non-IDLE states; clear interval when returning to IDLE.

```typescript
private startWatchdog(): void {
  if (this.watchdogInterval) return; // Already running
  this.watchdogInterval = setInterval(() => this.checkStateHealth(), 1000);
}

private stopWatchdog(): void {
  if (this.watchdogInterval) {
    clearInterval(this.watchdogInterval);
    this.watchdogInterval = null;
  }
}

// In setState(): if newState === IDLE, call stopWatchdog()
// In start(): call startWatchdog()
```

**Acceptance Criteria:**
- [ ] Watchdog interval is null when app is in IDLE state
- [ ] Watchdog starts when transitioning out of IDLE
- [ ] Watchdog stops when returning to IDLE

---

### 2. DonateButton Uses `window.open` Instead of Safe IPC

**Domain:** Security
**Effort:** Small (~15 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/DonateButton.tsx:49-51`

**Current State:**
```typescript
const handleClick = () => {
  window.open(KOFI_URL, '_blank')
}
```

**Problem:**
While `setWindowOpenHandler` intercepts this and routes to `shell.openExternal`, relying on the handler interception is fragile. The renderer should explicitly use the safe IPC channel.

**Recommended Fix:**
```typescript
const handleClick = async () => {
  await window.api.invoke('shell:openExternal', KOFI_URL)
}
```

**Acceptance Criteria:**
- [ ] DonateButton uses `shell:openExternal` IPC channel
- [ ] No direct `window.open` calls in renderer code

---

### 3. DonateButton Missing Focus Ring and External Link Indicator

**Domain:** UX / Accessibility
**Effort:** Small (~15 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/DonateButton.tsx:53-66`

**Current State:**
```typescript
<button
  onClick={handleClick}
  className="group flex items-center gap-2 px-3 py-1.5 text-xs text-theme-muted hover:text-pink-400 transition-colors"
>
```

**Problem:**
- No focus ring for keyboard navigation
- No visual indicator that this is an external link (WCAG 2.1 guideline 3.2.5)

**Recommended Fix:**
```typescript
<button
  onClick={handleClick}
  aria-label={`${DONATE_MESSAGES[messageIndex]} (opens in browser)`}
  className="group flex items-center gap-2 px-3 py-1.5 text-xs text-theme-muted hover:text-pink-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ring-offset-theme rounded"
>
  {/* ... heart icon ... */}
  <span>{DONATE_MESSAGES[messageIndex]}</span>
  {/* Add external link indicator */}
  <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
    <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7z"/>
  </svg>
</button>
```

**Acceptance Criteria:**
- [ ] Button has visible focus ring when keyboard-focused
- [ ] External link icon visible to indicate opens in browser
- [ ] Aria-label mentions "(opens in browser)"

---

### 4. Settings Back Button Has Small Tap Target

**Domain:** UX / Accessibility
**Effort:** Small (~10 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/SettingsView.tsx:21-27`

**Current State:**
```typescript
<button
  onClick={onBack}
  aria-label="Go back to main view"
  className="p-1 hover:bg-theme-secondary rounded transition-colors ..."
>
  <ChevronBackIcon className="w-5 h-5 text-theme-tertiary" />
</button>
```

**Problem:**
`p-1` padding creates a tap target of approximately 24x24px. WCAG 2.1 AAA recommends minimum 44x44px touch targets.

**Recommended Fix:**
```typescript
<button
  onClick={onBack}
  aria-label="Go back to main view"
  className="p-2 -ml-1 hover:bg-theme-secondary rounded transition-colors ..."
>
```

**Acceptance Criteria:**
- [ ] Back button tap target is at least 44x44px
- [ ] Visual appearance unchanged (negative margin compensates)

---

### 5. `useTranscription` Duplicated Across Components

**Domain:** Performance
**Effort:** Medium (~1-2 hr)

**Files:**
- `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/IdleView.tsx:11`
- `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/SettingsView.tsx:16`

**Current State:**
Both components independently call `useTranscription()`, which triggers duplicate IPC calls and event listener subscriptions on mount.

**Problem:**
- Extra IPC round-trips for `isModelReady` and `getConfig`
- Duplicate event listeners for `downloadProgress`
- Inconsistent state if one view updates before the other

**Recommended Fix:**
Hoist transcription state to `App.tsx` and pass as props:

```typescript
// App.tsx
const transcription = useTranscription()

// Pass to views
<IdleView transcription={transcription} ... />
<SettingsView transcription={transcription} ... />
```

Or use Zustand (already in dependencies) to create a global transcription store.

**Acceptance Criteria:**
- [ ] Only one set of IPC calls for transcription state
- [ ] Only one event listener for download progress
- [ ] State is consistent across all views

---

### 6. Global Shortcut Registration Failures Are Silently Ignored

**Domain:** UX
**Effort:** Small (~30 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/index.ts:108,129`

**Current State:**
```typescript
globalShortcut.register("CommandOrControl+Shift+F", async () => { ... });
globalShortcut.register("CommandOrControl+Shift+S", async () => { ... });
```

**Problem:**
`globalShortcut.register()` returns `boolean` indicating success. If another app has already registered these shortcuts, registration fails silently and users expect hotkeys to work but they don't.

**Recommended Fix:**
```typescript
const feedbackRegistered = globalShortcut.register("CommandOrControl+Shift+F", ...);
const screenshotRegistered = globalShortcut.register("CommandOrControl+Shift+S", ...);

if (!feedbackRegistered || !screenshotRegistered) {
  logger.warn("Global shortcuts registration failed - may conflict with other apps");
  // Optionally notify renderer to show a subtle warning
  mainWindow?.webContents.send('shortcuts:conflict', {
    feedback: feedbackRegistered,
    screenshot: screenshotRegistered
  });
}
```

**Acceptance Criteria:**
- [ ] Shortcut registration results are checked
- [ ] Warning logged if registration fails
- [ ] (Optional) UI notification if shortcuts conflict

---

## P2 (Medium) - Fix Soon

### 7. Sandbox Disabled in Electron Config

**Domain:** Security
**Effort:** Medium (investigation required)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/index.ts:45`

**Current State:**
```typescript
sandbox: false,
```

**Problem:**
Disabling sandbox reduces Electron's security isolation. While this may be required for audio/screenshot capture, it should be verified.

**Recommended Fix:**
Investigate if `sandbox: true` is compatible with current functionality. If not, document the specific reason sandbox must be disabled.

**Acceptance Criteria:**
- [ ] Documented why sandbox is disabled, or enabled if possible

---

### 8. Recovery Listener Not Implemented in Renderer

**Domain:** UX
**Effort:** Medium (~1-2 hr)

**Files:**
- Main emits: `/Users/eddiesanjuan/projects/feedbackflow/src/main/index.ts:159`
- No listener in: `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/App.tsx`

**Current State:**
Main process sends `recovery:found` event but renderer has no handler for it.

**Problem:**
Users who crash/quit mid-recording are never prompted to recover their session.

**Recommended Fix:**
Add recovery modal/dialog in App.tsx:

```typescript
useEffect(() => {
  const unsubRecovery = window.api.on('recovery:found', (savedSession) => {
    setRecoverySession(savedSession)
    setShowRecoveryModal(true)
  })
  return () => unsubRecovery()
}, [])
```

**Acceptance Criteria:**
- [ ] Recovery modal appears when interrupted session detected
- [ ] User can choose to recover or discard
- [ ] Recovered session resumes processing

---

### 9. Transcription Language Config Conflicts with English-Only Models

**Domain:** UX
**Effort:** Medium (~1 hr)

**Files:**
- Model files: `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/TranscriptionService.ts:40-57`
- UI allows non-English: `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/SettingsView.tsx:98-114`

**Current State:**
- Downloaded models are English-only (`.en.bin`)
- UI offers 9 language options including Japanese, Korean, Chinese

**Problem:**
Selecting non-English language won't work properly with English-only models.

**Recommended Fix:**
Option A: Constrain UI to English only
Option B: Download multilingual models (`ggml-base.bin` without `.en`) when non-English selected

**Acceptance Criteria:**
- [ ] Language selection matches available model capabilities
- [ ] Clear indication if multilingual transcription is not supported

---

### 10. Model Download Lacks Checksum Validation

**Domain:** Security
**Effort:** Medium (~1-2 hr)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/TranscriptionService.ts:94-214`

**Current State:**
Model is downloaded over HTTPS but integrity is only verified by file size.

**Problem:**
HTTPS provides transport security but not integrity verification of the file content itself.

**Recommended Fix:**
Add SHA256 checksum verification after download completes:

```typescript
const WHISPER_MODELS = {
  base: {
    url: '...',
    size: 142_000_000,
    sha256: 'expected_hash_here'
  }
}

// After download completes, verify hash
const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')
if (fileHash !== modelInfo.sha256) {
  throw new Error('Model checksum mismatch')
}
```

**Acceptance Criteria:**
- [ ] Downloaded model verified against known checksum
- [ ] User notified if verification fails

---

### 11. MacSpinner Creates Array on Every Render

**Domain:** Performance
**Effort:** Small (~15 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/icons.tsx:39-45`

**Current State:**
```typescript
export const MacSpinner = ({ className }: IconProps) => (
  <div className={`macos-spinner ${className || ''}`} aria-hidden="true">
    {[...Array(12)].map((_, i) => (
      <div key={i} className="macos-spinner-segment" />
    ))}
  </div>
)
```

**Problem:**
`[...Array(12)]` creates a new array on every render.

**Recommended Fix:**
```typescript
const SPINNER_SEGMENTS = Array.from({ length: 12 }, (_, i) => i)

export const MacSpinner = ({ className }: IconProps) => (
  <div className={`macos-spinner ${className || ''}`} aria-hidden="true">
    {SPINNER_SEGMENTS.map((i) => (
      <div key={i} className="macos-spinner-segment" />
    ))}
  </div>
)
```

**Acceptance Criteria:**
- [ ] Segment array is static, not created on each render

---

### 12. Synchronous File Writes in Main Process

**Domain:** Performance
**Effort:** Medium (~1 hr)

**Files:**
- `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/SessionController.ts:403`
- `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/StateStore.ts:56`
- `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/ScreenshotService.ts:91`

**Current State:**
Multiple `writeFileSync` calls that block the main process event loop.

**Problem:**
Synchronous file I/O can cause UI jank, especially for large screenshots or markdown reports.

**Recommended Fix:**
Use async `fs.promises.writeFile` for non-critical writes. Keep sync writes only in `destroy()` for exit safety.

**Acceptance Criteria:**
- [ ] Report saving uses async write
- [ ] Screenshot saving uses async write
- [ ] Only `destroy()` uses sync write

---

### 13. Popover Arrow Border Layering Issue

**Domain:** UX
**Effort:** Small (~15 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/index.css:108-118`

**Current State:**
```css
.popover-arrow::before {
  content: '';
  position: absolute;
  top: 1px;
  left: -8px;
  ...
  border-bottom: 8px solid var(--bg-arrow-border);
}
```

**Problem:**
The arrow border pseudo-element renders behind the arrow fill, making the border barely visible.

**Recommended Fix:**
```css
.popover-arrow::before {
  top: -1px;  /* Position border above the fill */
  z-index: -1;
}
```

**Acceptance Criteria:**
- [ ] Arrow border is visible in both light and dark modes

---

### 14. No Visual Feedback When Download Button Clicked

**Domain:** UX
**Effort:** Small (~30 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/IdleView.tsx:31-37`

**Current State:**
Download button has no disabled state or loading indicator while download starts.

**Problem:**
User can click multiple times before `isDownloading` becomes true.

**Recommended Fix:**
Add local loading state:
```typescript
const [isStartingDownload, setIsStartingDownload] = useState(false)

const handleDownload = async () => {
  setIsStartingDownload(true)
  await downloadModel()
  setIsStartingDownload(false)
}

<button
  onClick={handleDownload}
  disabled={isStartingDownload || isDownloading}
>
  {isStartingDownload ? <MacSpinner /> : null}
  Download Model
</button>
```

**Acceptance Criteria:**
- [ ] Button shows loading state immediately on click
- [ ] Button is disabled during download initiation

---

### 15. CompleteView Transcript Lacks Min/Max Height

**Domain:** UX
**Effort:** Small (~15 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/CompleteView.tsx:100-111`

**Current State:**
```typescript
<div className="h-full bg-theme-tertiary rounded p-3 overflow-y-auto">
```

**Problem:**
With very short transcripts, the box collapses; with very long ones, the entire view becomes scrollable instead of just the transcript area.

**Recommended Fix:**
```typescript
<div className="min-h-[100px] max-h-[200px] bg-theme-tertiary rounded p-3 overflow-y-auto">
```

**Acceptance Criteria:**
- [ ] Transcript area has minimum height for short content
- [ ] Transcript area has maximum height with internal scroll

---

### 16. Hardcoded Version String in SettingsView

**Domain:** Code Quality
**Effort:** Small (~15 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/SettingsView.tsx:121`

**Current State:**
```typescript
<p>FeedbackFlow v0.3.0</p>
```

**Problem:**
Version is hardcoded and will get out of sync with `package.json`.

**Recommended Fix:**
Import version from package.json or expose via IPC:
```typescript
const version = await window.api.invoke('app:getVersion')
```

**Acceptance Criteria:**
- [ ] Version displayed matches package.json automatically

---

### 17. `role="application"` May Reduce Screen Reader Accessibility

**Domain:** Accessibility
**Effort:** Small (~5 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/App.tsx:163`

**Current State:**
```typescript
<div role="application" aria-label="FeedbackFlow">
```

**Problem:**
`role="application"` disables most screen reader shortcuts, which is only appropriate for fully custom keyboard interaction models like games or IDEs.

**Recommended Fix:**
Remove the role or use `role="main"`:
```typescript
<div role="main" aria-label="FeedbackFlow">
```

**Acceptance Criteria:**
- [ ] Screen reader shortcuts work normally in the app

---

### 18. ffmpeg Audio Input Hardcoded to `:0`

**Domain:** UX
**Effort:** Medium (~2 hr)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/AudioService.ts:218`

**Current State:**
```typescript
"-i",
":0",
```

**Problem:**
Uses first audio input device, which may not be the user's preferred microphone if they have multiple audio devices.

**Recommended Fix:**
Add audio device selection in Settings, or detect default input device dynamically.

**Acceptance Criteria:**
- [ ] User can select preferred audio input, or
- [ ] App uses system default input device

---

### 19. Multi-Instance Behavior Not Defined

**Domain:** UX
**Effort:** Small (~30 min)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/index.ts`

**Current State:**
No single-instance lock implemented.

**Problem:**
Launching the app twice creates multiple tray icons and conflicting global shortcuts.

**Recommended Fix:**
```typescript
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })
}
```

**Acceptance Criteria:**
- [ ] Only one instance of the app can run
- [ ] Second launch focuses existing instance

---

### 20. Screenshot Capture is Primary Display Only

**Domain:** UX
**Effort:** Medium (~2 hr)

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/ScreenshotService.ts:49`

**Current State:**
```typescript
const primaryDisplay = screen.getPrimaryDisplay()
```

**Problem:**
Always captures primary display. Users with multiple monitors cannot capture their secondary display.

**Recommended Fix:**
Capture the display containing the focused window or mouse cursor:
```typescript
const cursorPoint = screen.getCursorScreenPoint()
const display = screen.getDisplayNearestPoint(cursorPoint)
```

**Acceptance Criteria:**
- [ ] Screenshot captures display where cursor is located

---

## P3 (Low) - Polish Items

### 21. Unused `stateTimeout` Member in SessionController

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/SessionController.ts:83`

`stateTimeout` is declared and `clearStateTimeout()` is called, but nothing ever sets `stateTimeout`. Remove dead code.

---

### 22. Error Icon Uses Warning Triangle Instead of Error Circle

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/ErrorView.tsx:114-120`

The error icon is a warning triangle. For better semantic clarity, use an error circle (x-circle) icon.

---

### 23. Keyboard Shortcuts Use HTML Entities

**Files:** `IdleView.tsx:84`, `RecordingView.tsx:96`

`&#8984;&#8679;` renders correctly but could use Unicode directly (`⌘⇧`) for better readability in code.

---

### 24. View Transition Animation May Feel Abrupt

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/index.css:314`

`0.15s` duration may feel jarring. Consider `0.2s` or `0.25s` for smoother transitions.

---

### 25. Console Errors Not Persisted

**Domain:** Debugging

Error logging goes to console only. Consider integrating a log persistence solution for debugging production issues.

---

### 26. `preferredTier` Config Not Enforced

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/TranscriptionService.ts`

The `preferredTier` configuration option exists but Whisper is always attempted if model exists. Either enforce the preference or remove the option.

---

### 27. Non-null Assertion on DOM Element

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/main.tsx:7`

```typescript
document.getElementById('root')!
```

The `!` assertion could mask a real error. Add a null check with meaningful error message.

---

### 28. Inconsistent Button Styling Classes

**Domain:** Code Quality

Some buttons use `btn-macos btn-macos-primary`, others use inline Tailwind classes. Consolidate to consistent pattern.

---

## Verification Summary

### Issues Fixed in v0.3.1 (Verified)

| Issue | Source Audit | Verified Fixed |
|-------|--------------|----------------|
| `electronAPI` wholesale exposure | AUDIT_WAVE1.md #1 | Yes - only `process.versions` exposed |
| `window.open` unrestricted | AUDIT_WAVE1.md #2 | Yes - `setWindowOpenHandler` added |
| Watchdog state-only transitions | AUDIT_WAVE1.md #3 | Yes - `cleanupCurrentState()` added |
| `reset()` leaks processes | AUDIT_WAVE1.md #4 | Yes - stops audio + ends screenshot |
| Report filename collisions | AUDIT_WAVE1.md #5 | Yes - seconds + 4-char ID |
| Recorder early-exit undetected | AUDIT_WAVE1.md #6 | Yes - 300ms grace period |
| Screenshot OOM on 4K | AUDIT_WAVE1.md #7 | Yes - capped at 1920px |
| Missing Error Boundary | AUDIT_CLAUDE.md #1 | Yes - `ErrorBoundary.tsx` added |
| Race condition in start/stop | AUDIT_CLAUDE.md #2 | Yes - `operationLock` added |
| Unsafe IPC type casting | AUDIT_CLAUDE.md #3 | Yes - type guards added |
| Unhandled IPC rejections | AUDIT_CLAUDE.md #4 | Yes - `wrapHandler` added |
| IPC listener dependencies | AUDIT_CLAUDE.md #7 | Yes - `stateRef` pattern used |
| Recording timer re-renders | AUDIT_CLAUDE.md #6 | Yes - `RecordingTimer` memo'd |

---

## Fleet Feedback

**FRICTION:** The five audit files had overlapping but differently-formatted findings. Synthesis required manual cross-referencing.

**MISSING_CONTEXT:** Would have been helpful to have:
- A list of which audit findings were addressed in each commit
- A CHANGELOG tracking issue resolutions

**SUGGESTION:** Future audits should reference a shared issue tracker. When @developer fixes an issue, they should update the tracker with commit hash.

---

*Generated by @auditor-1 (Synthesis Agent) - Claude Opus 4.5*
