# FeedbackFlow v0.7.1 -- Fresh-Eyes Comprehensive Audit Report

**Date:** 2026-02-05
**Auditor:** Claude Opus 4.6 (Fresh-Eyes Audit)
**Codebase:** 28 source files, ~2,900 lines of application code
**Version:** 0.7.1 (package.json)
**Commit:** 3bb756f on main

---

## Build Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS (clean) |
| `npm run lint` | PASS (0 errors, **2 warnings**) |
| `npm run build` | PASS (main 60.6KB, preload 1.7KB, renderer 270KB) |

### Lint Warnings (NEW since last audit)

1. `src/main/ipc.ts:3` -- `SessionData` imported but never used
2. `src/main/services/SessionController.ts:7` -- `unlink` imported but never used

Both are dead imports introduced by recent refactoring. The prior audit had zero lint warnings.

---

## Prior Finding Verification

### Previously P0 Critical

| ID | Finding | Status |
|----|---------|--------|
| BUILD-01 | Missing `build/` directory | **FIXED** -- `build/entitlements.mac.plist` exists with correct entitlements |
| ARCH-01 | AudioService `fatalError` not handled | **FIXED** -- SessionController constructor (line 103-108) registers listener, cleaned up in `destroy()` (line 581) |

### Previously P1 High

| ID | Finding | Status |
|----|---------|--------|
| SEC-01 | Unvalidated `shell.openExternal` in `setWindowOpenHandler` | **FIXED** -- `index.ts:63-72` validates protocol (http/https only) |
| SEC-02 | Insufficient JSON.parse validation | **FIXED** -- `StateStore.load()` uses `isValidSessionData()`, `SessionHistory.load()` validates array + element shapes |
| ARCH-02 | Phantom dependencies (electron-store, zustand) | **FIXED** -- Only `uuid` in production dependencies |
| ARCH-03 | Stale recordings never cleaned up | **STILL OPEN** -- No cleanup code exists |
| DEP-01 | Electron 28 vulnerabilities | **STILL OPEN** -- Still on `^28.2.0` |

### Previously P2 Medium

| ID | Finding | Status |
|----|---------|--------|
| NEW-01 (Cycle1) | `recovery:recover` IPC validation | **FIXED** -- `ipc.ts:91-113` validates with `isValidSessionData()` + audioPath directory check |
| NEW-02 (Cycle1) | `transcription:setConfig` validation | **FIXED** -- `TranscriptionService.ts:463-474` validates model + tier against allowlists |
| NEW-03 (Cycle1) | Version mismatch | **FIXED** -- package.json now says 0.7.1 |
| NEW-04 (Cycle1) | Missing app icon | **PARTIALLY FIXED** -- `assets/icon.iconset/` exists with source PNGs but `.icns` file not compiled |
| NEW-05 (Cycle1) | TranscriptionState duplicated | **FIXED** -- Both IdleView and SettingsView import from `useTranscription.ts` |
| NEW-06 (Cycle1) | Unsafe `as` casts in App.tsx | **PARTIALLY FIXED** -- Property existence checks added but `as` casts remain after validation |
| ARCH-04 | `wrapHandlerWithArgs` unused | **FIXED** (removed, but introduced new unused `SessionData` import) |
| ARCH-05 | `useTranscription` skips IPC validation | **FIXED** |
| ARCH-06 | SettingsView version fetch type guard | **FIXED** |
| ARCH-07 | Duplicated IPCResponse type | **FIXED** -- Shared via `utils/ipc.ts` |
| ARCH-08 | cancel/reset double state transition | **FIXED** -- Guard at line 163 prevents redundant transitions |
| UX-01 | CompleteView shows raw markdown | **FIXED** -- Now shows `session.transcript` |
| UX-02 | "Ready" text poor contrast | **FIXED** -- `text-green-600 dark:text-green-400` |

### Summary of Prior Fix Status

- **All P0 findings:** Fixed
- **All security P1 findings:** Fixed
- **2 carryover P1s remain:** ARCH-03 (recording cleanup) and DEP-01 (Electron 28)
- **All P2/P3 from prior audits:** Fixed or partially fixed
- **Security posture is strong** -- all security-critical items addressed

---

## New Findings

### SEC-03: Missing `will-navigate` Event Handler -- Navigation Hijack Risk

**Severity:** P1 High
**Type:** Security (Defense-in-Depth)
**Effort:** Small (<1hr)

#### Current State
- `src/main/index.ts:31-82` -- BrowserWindow creation with `setWindowOpenHandler` but no navigation handler

#### Problem
The BrowserWindow has no `will-navigate` or `did-navigate` event handler. The [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation) explicitly recommends preventing all navigation in Electron apps that don't need it.

While the window has `webSecurity: true`, `sandbox: true`, and a CSP, a compromised renderer could trigger navigation via `window.location`, `meta refresh`, or anchor clicks that bypass `setWindowOpenHandler` (which only intercepts `window.open()`). Navigation to a `data:` or `blob:` URL could execute code outside the CSP.

The `setWindowOpenHandler` correctly blocks `window.open()` calls, but `window.location.href = 'file:///...'` would be unblocked.

#### Recommended Fix
Add a `will-navigate` handler that blocks all navigation:

```typescript
window.webContents.on('will-navigate', (event, url) => {
  // Block all navigation - this app is a single-page app
  // that should never navigate away from its loaded content
  event.preventDefault()
  logger.warn('Blocked navigation attempt to:', url)
})
```

#### Acceptance Criteria
- [ ] `will-navigate` event handler exists on the BrowserWindow
- [ ] All navigation attempts are blocked and logged
- [ ] The renderer still loads correctly on initial load

---

### SEC-04: `screenshot:capture` IPC Handler Has No Error Wrapping

**Severity:** P2 Medium
**Type:** Security / Reliability
**Effort:** Small (<1hr)

#### Current State
- `src/main/ipc.ts:126-141`

#### Problem
The `screenshot:capture` handler calls `screenshotService.capture()` without try/catch. While `ScreenshotService.capture()` has its own internal try/catch that returns `null` on error, if the method throws before entering the try block (e.g., property access on destroyed service), the IPC handler will throw an unhandled rejection to the renderer.

Every other handler either uses `wrapHandler()` or has explicit try/catch. This is the only handler that lacks both.

```typescript
// Current: no error boundary
ipcMain.handle('screenshot:capture', async () => {
  // ...
  const screenshot = await screenshotService.capture()  // Could throw
  // ...
})
```

#### Recommended Fix
Wrap the handler body in try/catch:

```typescript
ipcMain.handle('screenshot:capture', async () => {
  try {
    if (!screenshotService) {
      return { success: false, error: 'Screenshot service not available' }
    }
    // ... rest of handler
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
})
```

#### Acceptance Criteria
- [ ] `screenshot:capture` handler catches all errors and returns structured IPCResponse
- [ ] No IPC handler can throw unhandled rejections to the renderer

---

### ARCH-10: `forceTransition` Has No Reentrancy Guard -- Watchdog Race Condition

**Severity:** P2 Medium
**Type:** Architecture / Reliability
**Effort:** Small (<1hr)

#### Current State
- `src/main/services/SessionController.ts:142-157` (checkStateHealth)
- `src/main/services/SessionController.ts:198-222` (forceTransition)

#### Problem
The watchdog runs every 1 second via `setInterval`. `checkStateHealth` calls `void this.forceTransition(...)` as fire-and-forget. `forceTransition` is async and calls `cleanupCurrentState` which may `await audioService.stopRecording()`.

If `cleanupCurrentState` takes more than 1 second, the next watchdog tick will see the **same state** (because `setState` hasn't been called yet), determine it's still timed out, and call `forceTransition` again. This can cause:

1. `audioService.stopRecording()` called multiple times concurrently
2. Double state transitions
3. Potential resource cleanup issues

The `operationLock` on `start()` and `stop()` doesn't protect `forceTransition`.

#### Trace
```
T=0:    Watchdog fires, state=RECORDING (timed out after 30min)
        → forceTransition(STOPPING) called
        → cleanupCurrentState(RECORDING) → awaits audioService.stopRecording()
T=1s:   Watchdog fires again, state still RECORDING (forceTransition hasn't called setState yet)
        → forceTransition(STOPPING) called AGAIN
        → cleanupCurrentState(RECORDING) → audioService.stopRecording() called again
```

#### Recommended Fix
Add a reentrancy guard:

```typescript
private isForceTransitioning = false;

private async forceTransition(state: SessionState, reason: string): Promise<void> {
  if (this.isForceTransitioning) return;
  this.isForceTransitioning = true;
  try {
    // ... existing logic
  } finally {
    this.isForceTransitioning = false;
  }
}
```

#### Acceptance Criteria
- [ ] `forceTransition` cannot be called concurrently
- [ ] Watchdog cannot trigger multiple overlapping transitions
- [ ] The guard is released even if the transition throws

---

### LINT-01: Dead Imports Introduced by Recent Refactoring

**Severity:** P2 Medium
**Type:** Code Quality
**Effort:** Small (<15min)

#### Current State
1. `src/main/ipc.ts:3` -- `SessionData` imported but never used (was used by removed `wrapHandlerWithArgs`)
2. `src/main/services/SessionController.ts:7` -- `unlink` imported from `fs/promises` but never used

#### Problem
These unused imports were introduced by the v0.6.0/v0.7.0 refactoring. They produce ESLint warnings that muddy the CI signal. The prior audit cycle had zero lint warnings -- this is a regression.

#### Recommended Fix
Remove both unused imports.

#### Acceptance Criteria
- [ ] `npm run lint` produces zero warnings
- [ ] No unused imports in the codebase

---

### ICON-01: App Icon Source Exists But `.icns` Not Compiled

**Severity:** P2 Medium
**Type:** Production Readiness
**Effort:** Small (<15min)

#### Current State
- `assets/icon.iconset/` exists with 10 source PNG files at various resolutions
- `assets/generate_icon.py` exists as a generation script
- `assets/icon.icns` does NOT exist
- `package.json:55` references `"icon": "assets/icon.icns"`

#### Problem
The icon source images were created but the final `.icns` file was never compiled from the iconset. Packaging with `npm run package` will use the default Electron icon. The Python script exists to generate the images, but the macOS `iconutil` step was never run.

#### Recommended Fix
```bash
cd assets && iconutil -c icns icon.iconset
```
This compiles `icon.iconset/` into `icon.icns`. Add this as a pre-package script or document it.

#### Acceptance Criteria
- [ ] `assets/icon.icns` exists and is a valid macOS icon file
- [ ] Packaged app displays the FeedbackFlow icon

---

### ARCH-11: Model Download Redirect Following Has No Depth Limit

**Severity:** P3 Low
**Type:** Architecture / Robustness
**Effort:** Small (<30min)

#### Current State
- `src/main/services/TranscriptionService.ts:175-186` (handleResponse)
- `src/main/services/TranscriptionService.ts:219-224` (makeRequest)

#### Problem
The `handleResponse` function follows HTTP redirects recursively via `makeRequest(redirectUrl)`. There is no limit on redirect depth. A malicious or misconfigured CDN could cause an infinite redirect loop, consuming memory and CPU until the process crashes.

While the model URLs are hardcoded to `huggingface.co` (low risk of redirect loops), defense-in-depth suggests adding a limit.

#### Recommended Fix
Add a `maxRedirects` counter:

```typescript
const makeRequest = (url: string, redirectCount = 0) => {
  if (redirectCount > 5) {
    finalize(false)
    return
  }
  const request = get(url, (response) => handleResponse(response, redirectCount))
  // ...
}
```

#### Acceptance Criteria
- [ ] Model download follows at most 5 redirects
- [ ] Redirect loop results in download failure, not crash

---

### ENT-01: Camera Entitlement May Be Unnecessary

**Severity:** P3 Low
**Type:** Security / Least Privilege
**Effort:** Small (<15min)

#### Current State
- `build/entitlements.mac.plist` includes `com.apple.security.device.camera`

#### Problem
The app uses `desktopCapturer.getSources()` for screenshots, which requires **screen recording** permission, not camera access. The camera entitlement requests a broader permission than needed. On macOS, users will see a camera access prompt that may confuse them or reduce trust.

However, if future plans include camera-based features, this entitlement may be intentionally forward-looking. Flagging for awareness.

#### Recommended Fix
Evaluate whether `com.apple.security.device.camera` is needed. If screenshots use only `desktopCapturer`, it can be removed. Add `com.apple.security.screen-recording` if not implied by existing entitlements.

#### Acceptance Criteria
- [ ] Only necessary entitlements are declared
- [ ] No unnecessary system permission prompts shown to users

---

## Carryover Findings (Still Open)

### ARCH-03: Stale Audio Recordings Never Cleaned Up (P1)

**Status:** STILL OPEN (3rd consecutive audit)
**Impact:** Disk space grows unboundedly -- each WAV is ~1MB/minute at 16kHz mono

Audio recordings in `{userData}/recordings/` and screenshots in `{userData}/screenshots/` are never deleted after session completion. The transcript is already extracted and embedded in the markdown report, so the WAV file serves no purpose post-processing.

**Recommendation:** Delete the WAV file in `processRecording()` after successful transcription. Retain screenshot directories since they're referenced by the markdown report via absolute path.

### DEP-01: Electron 28 Has Known Vulnerabilities (P1)

**Status:** STILL OPEN (3rd consecutive audit)
**npm audit output:**

| Package | Severity | Advisory |
|---------|----------|----------|
| electron <35.7.5 | Moderate | ASAR integrity bypass (GHSA-vmqv-hx8q-j7mg) |
| app-builder-lib / tar | High | Arbitrary file overwrite + symlink poisoning (3 CVEs) |
| dmg-builder | High | Via app-builder-lib |
| electron-builder | High | Via app-builder-lib + dmg-builder |

**Installed:** Electron 28.3.3, **Latest:** 40.1.0
**Fix:** Upgrade electron to `^35.7.5+`, electron-builder to `^26.7.0`

---

## Severity Distribution (All Open)

| Severity | Count | New | Carryover |
|----------|-------|-----|-----------|
| P0 Critical | 0 | 0 | 0 |
| P1 High | 3 | 1 (SEC-03) | 2 (ARCH-03, DEP-01) |
| P2 Medium | 4 | 4 (SEC-04, ARCH-10, LINT-01, ICON-01) | 0 |
| P3 Low | 2 | 2 (ARCH-11, ENT-01) | 0 |
| **Total** | **9** | **7** | **2** |

---

## Security Posture Assessment

### What is well-implemented:

1. **Context isolation + sandbox:** Both enabled (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`)
2. **IPC channel allowlisting:** Preload explicitly whitelists 17 invoke channels and 6 listener channels
3. **CSP:** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` -- properly restrictive
4. **URL validation:** Both `shell:openExternal` IPC handler and `setWindowOpenHandler` validate protocols
5. **Input validation:** `isValidSessionData()` validates all fields. `setConfig()` validates against allowlists. `recovery:recover` validates audioPath against expected directory.
6. **Structured IPC responses:** Consistent `{ success, data?, error? }` pattern with `wrapHandler`
7. **Single instance lock:** Prevents multiple app instances
8. **Hardened runtime:** Entitlements enable `hardenedRuntime: true`

### What needs attention:

1. **Missing `will-navigate` handler** (SEC-03) -- Single most significant remaining security gap
2. **Electron 28 vulnerabilities** (DEP-01) -- ASAR integrity bypass + tar issues
3. **`screenshot:capture` error handling** (SEC-04) -- Minor but breaks the consistent pattern

### Risk Assessment

| Risk | Level | Notes |
|------|-------|-------|
| Navigation hijack via compromised renderer | Low-Medium | No `will-navigate` handler, but CSP + sandbox limit blast radius |
| ASAR integrity bypass (Electron 28) | Low | Requires local filesystem access to modify ASAR |
| Disk space exhaustion | Low-Medium | Grows with usage; user impact over months |
| Recording process crash → silent death | Low | fatalError handler now properly transitions to ERROR |
| IPC data injection | Very Low | All critical paths validated server-side |

---

## Architecture Quality Assessment

### Strengths

1. **State machine design** is excellent -- clear states, timeout watchdog, operation locks, recovery mechanism
2. **Error handling** is consistent -- structured IPCResponse, type guards, try/catch boundaries
3. **Accessibility** is above average -- proper ARIA roles, live regions, reduced motion support, focus management
4. **Separation of concerns** is clean -- services are independently testable, IPC layer is a thin adapter
5. **Type safety** is thorough -- strict TypeScript, runtime validation at trust boundaries

### Areas for Improvement

1. **No automated tests** -- Zero test files exist. The state machine and IPC handlers are highly testable
2. **No integration test for IPC channel contract** -- Changes to main handlers could break renderer without compile-time detection
3. **Event emitter usage lacks type safety** -- `SessionController.emit('stateChange', ...)` is untyped; consider typed EventEmitter
4. **Service lifecycle is manual** -- Services are created as top-level variables, destroyed in `before-quit`. A service container pattern would be more maintainable

---

## Production Readiness Verdict

### NEAR-READY -- Minor Changes Required

FeedbackFlow has significantly improved across 4 audit cycles. All P0 security issues are resolved. The codebase demonstrates mature patterns for IPC security, state management, and accessibility.

**Must-fix before release:**
1. **SEC-03** -- Add `will-navigate` handler (15 minutes of work, significant security value)
2. **ICON-01** -- Compile `.icns` from existing iconset (1 command)
3. **LINT-01** -- Remove dead imports (2 line deletions)

**Should-fix before release:**
4. **ARCH-03** -- Recording cleanup (prevents long-term disk bloat)
5. **DEP-01** -- Electron upgrade (addresses known CVEs)

**Can defer:**
6. Everything else (P2/P3)

---

## Positive Observations

1. **Dramatic improvement arc.** From 21 findings (2 P0, 5 P1) in the v0.5.0 audit to 9 findings (0 P0, 3 P1 with 2 carryovers) now. The team has systematically addressed every critical and high-severity security finding.

2. **IPC validation is now exemplary.** The `isValidSessionData()` type guard, audioPath directory validation, and config allowlist validation in `setConfig()` demonstrate proper defense-in-depth. This is the correct pattern for Electron apps.

3. **Prior audit findings were correctly implemented.** All `VERIFIED FIXED` items hold up under re-examination. The fixes are not superficial -- they demonstrate understanding of the underlying security principles.

4. **Code quality is professional.** Clean TypeScript, consistent patterns, proper error handling, thoughtful UX (auto-copy report path, recovery modal, contextual error messages).

5. **Accessibility is genuine.** Not just decorative ARIA attributes -- the app has proper `role="timer"`, screen reader duration formatting, `aria-live="polite"` for dynamic updates, `prefers-reduced-motion` with functional fallbacks, and keyboard focus management.

---

## Prioritized Implementation Plan

### Wave 1 -- Quick Wins (30 minutes total)

| # | ID | Task | Effort |
|---|-----|------|--------|
| 1 | SEC-03 | Add `will-navigate` handler to block all navigation | 10 min |
| 2 | LINT-01 | Remove unused `SessionData` and `unlink` imports | 5 min |
| 3 | ICON-01 | Run `iconutil -c icns icon.iconset` in assets/ | 5 min |
| 4 | SEC-04 | Wrap `screenshot:capture` handler in try/catch | 10 min |

### Wave 2 -- Reliability (1-2 hours)

| # | ID | Task | Effort |
|---|-----|------|--------|
| 5 | ARCH-10 | Add reentrancy guard to `forceTransition` | 30 min |
| 6 | ARCH-03 | Delete WAV files after successful transcription | 1 hr |

### Wave 3 -- Dependency Upgrade (4+ hours, schedule separately)

| # | ID | Task | Effort |
|---|-----|------|--------|
| 7 | DEP-01 | Upgrade Electron to ^35.7.5+, electron-builder to ^26.7.0 | 4+ hr |

### Wave 4 -- Backlog

| # | ID | Task | Effort |
|---|-----|------|--------|
| 8 | ARCH-11 | Add redirect depth limit to model download | 15 min |
| 9 | ENT-01 | Evaluate camera entitlement necessity | 15 min |

---

*Audit complete. 28 source files reviewed. 7 new findings + 2 carryover findings identified. No P0 critical issues remain.*
