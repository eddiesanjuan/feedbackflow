# Cycle 1 Audit Findings

**Date:** 2026-02-05
**Auditor:** Auditor Agent (Claude Opus 4.6)
**Codebase:** FeedbackFlow v0.5.0 (commit 3bb756f claims v0.6.0 fixes)
**Source files:** 28 files, ~2,900 lines of application code

---

## Build Status

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS (clean) |
| `npm run lint` | PASS (clean, no warnings) |
| `npm run build` | PASS (main 59.6KB, preload 1.7KB, renderer 269.8KB) |
| `npm run package:dir` | PASS (with warnings: default icon, no code signing) |

All build checks pass. The previously reported ESLint warning for `wrapHandlerWithArgs` is now resolved.

---

## Prior Fix Verification

### P0 Findings

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| BUILD-01 | Missing `build/` directory | PARTIALLY FIXED | `build/entitlements.mac.plist` exists with correct entitlements. However, `assets/icon.icns` is still missing. Packaging works but uses the default Electron icon. |
| ARCH-01 | AudioService `fatalError` not handled | VERIFIED FIXED | SessionController constructor (line 103-108) registers `onAudioFatalError` listener. Transitions to ERROR state with descriptive message. Listener cleaned up in `destroy()` (line 581). |

### P1 Findings

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| SEC-01 | Unvalidated `shell.openExternal` in `setWindowOpenHandler` | VERIFIED FIXED | `index.ts` lines 63-72 now parse URL and only allow `http:` / `https:` protocols. Invalid URLs caught in try/catch. |
| SEC-02 | Insufficient JSON.parse validation | VERIFIED FIXED | `StateStore.load()` (lines 94-122) validates all SessionData fields with `isValidSessionData()` type guard. `SessionHistory.load()` (lines 30-63) validates array and each element's shape with inline filter. |
| ARCH-02 | Phantom dependencies (electron-store, zustand) | VERIFIED FIXED | Neither appears in `package.json`. Only production dependency is `uuid`. |
| ARCH-03 | Stale audio recordings never cleaned up | STILL OPEN | No cleanup code exists. `recordings/` and `screenshots/` directories still grow unboundedly. See Remaining Prior Findings below. |
| DEP-01 | Electron 28 vulnerabilities | STILL OPEN | Electron 28.3.3 still installed. `npm audit` reports 9 vulnerabilities (5 high, 4 moderate). See Remaining Prior Findings below. |

### Summary

- **P0:** 1 of 2 fully fixed, 1 partially fixed (missing icon)
- **P1:** 3 of 5 fully fixed, 2 still open (ARCH-03, DEP-01)
- All security-critical P0/P1 items (ARCH-01, SEC-01, SEC-02, ARCH-02) are verified fixed.

---

## New Findings

### NEW-01: `recovery:recover` IPC Handler Accepts Untrusted Session Data Without Validation

**Severity:** P2 Medium
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
- `/Users/eddiesanjuan/projects/feedbackflow/src/main/ipc.ts` lines 89-97
- `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/SessionController.ts` lines 559-574

#### Problem
The `recovery:recover` IPC handler passes the `session` object from the renderer directly to `sessionController.recoverSession(session)` without any validation. The `recoverSession` method then assigns `this.session = savedSession` directly, which means:

1. The renderer could send a crafted `audioPath` pointing to any file on the filesystem
2. This path is later passed to `this.transcriptionService.transcribe(this.session.audioPath!)` (line 386)
3. Whisper would attempt to read that file via `-f audioPath`

While `spawn` with array args prevents command injection, and sandbox limits the attack surface to a compromised renderer, the main process should validate data from the renderer before trusting it. The `StateStore.load()` method already has a thorough `isValidSessionData()` type guard that should be reused here.

Contrast with `StateStore.load()` at lines 94-122 which validates every field -- the recovery handler does none of this.

#### Recommended Fix
Validate the session data in the IPC handler before passing it to `recoverSession`:
```typescript
ipcMain.handle('recovery:recover', async (_, session: unknown) => {
  // Reuse or share the same validation as StateStore.isValidSessionData
  if (!isValidSessionData(session)) {
    return { success: false, error: 'Invalid session data' }
  }
  // Additionally validate audioPath is within the expected recordings directory
  if (session.audioPath && !session.audioPath.startsWith(expectedRecordingsDir)) {
    return { success: false, error: 'Invalid audio path' }
  }
  await sessionController.recoverSession(session)
  return { success: true }
})
```

#### Acceptance Criteria
- [ ] `recovery:recover` validates session data structure before processing
- [ ] `audioPath` is validated to be within the expected recordings directory
- [ ] Invalid data returns a structured error response, not a crash

---

### NEW-02: `transcription:setConfig` IPC Handler Accepts Arbitrary Config Without Validation

**Severity:** P2 Medium
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
- `/Users/eddiesanjuan/projects/feedbackflow/src/main/ipc.ts` lines 63-71
- `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/TranscriptionService.ts` lines 463-465

#### Problem
The `transcription:setConfig` handler passes the renderer's `config` object directly to `transcriptionService.setConfig(config)`, which spreads it into the internal config: `this.config = { ...this.config, ...config }`.

The renderer could send arbitrary properties (prototype pollution defense is handled by the spread, but unexpected values are not). The `whisperModel` field is interpolated into a file path at line 84: `ggml-${this.config.whisperModel}.en.bin`. While path traversal via this would be impractical (the resulting file must be a valid whisper model), the main process should validate that `whisperModel` is one of the known values (`tiny`, `base`, `small`, `medium`).

The renderer-side `useTranscription.ts` already has `VALID_WHISPER_MODELS` validation, but defense-in-depth requires server-side (main process) validation too.

#### Recommended Fix
Validate the config in the IPC handler or in `setConfig()`:
```typescript
const VALID_MODELS = new Set(['tiny', 'base', 'small', 'medium'])
const VALID_TIERS = new Set(['whisper_local', 'macos_dictation', 'none'])

setConfig(config: Partial<TranscriptionConfig>): void {
  if (config.whisperModel && !VALID_MODELS.has(config.whisperModel)) {
    throw new Error(`Invalid whisper model: ${config.whisperModel}`)
  }
  if (config.preferredTier && !VALID_TIERS.has(config.preferredTier)) {
    throw new Error(`Invalid preferred tier: ${config.preferredTier}`)
  }
  this.config = { ...this.config, ...config }
}
```

#### Acceptance Criteria
- [ ] `whisperModel` is validated against known model names
- [ ] `preferredTier` is validated against known tier values
- [ ] Invalid values result in an error response, not silent acceptance

---

### NEW-03: Package Version Mismatch -- `package.json` Says 0.5.0, Commit Says v0.6.0

**Severity:** P2 Medium
**Type:** Code Quality / Production Readiness
**Effort:** Small (<1hr)

#### Current State
- `/Users/eddiesanjuan/projects/feedbackflow/package.json` line 3: `"version": "0.5.0"`
- Git commit `3bb756f`: `feat(v0.6.0): Opus 4.6 audit fixes - P0/P1 security & reliability`

#### Problem
The most recent commit claims to be v0.6.0 changes, but `package.json` was never bumped from `0.5.0`. This means:
1. `app.getVersion()` returns `0.5.0` to the Settings view
2. Any electron-builder packaging would produce artifacts labeled `0.5.0`
3. The version shown in the About section is incorrect

#### Recommended Fix
Update `package.json` version to `0.6.0` to match the commit intent.

#### Acceptance Criteria
- [ ] `package.json` version matches the intended release version
- [ ] `app:getVersion` returns the correct version string

---

### NEW-04: Missing `assets/icon.icns` -- Default Electron Icon Used

**Severity:** P2 Medium
**Type:** Production Readiness
**Effort:** Small (<1hr)

#### Current State
- `/Users/eddiesanjuan/projects/feedbackflow/assets/` is an empty directory
- `/Users/eddiesanjuan/projects/feedbackflow/package.json` line 57: `"icon": "assets/icon.icns"`

#### Problem
The BUILD-01 fix created `build/entitlements.mac.plist` but did not create `assets/icon.icns`. Packaging succeeds but produces an app with the default Electron icon. For a user-facing production app, this is a significant brand identity gap. Users will see the generic Electron icon in their Dock, Applications folder, and Spotlight.

#### Recommended Fix
Create a proper macOS icon set. At minimum:
1. Design a 1024x1024 PNG source icon
2. Use `iconutil` to generate the `.icns` file
3. Place at `assets/icon.icns`

#### Acceptance Criteria
- [ ] `assets/icon.icns` exists and is a valid macOS icon set
- [ ] Packaged app displays the FeedbackFlow icon, not the default Electron icon

---

### NEW-05: `TranscriptionState` Interface Duplicated Across Two Components

**Severity:** P3 Low
**Type:** Code Quality / DRY
**Effort:** Small (<1hr)

#### Current State
- `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/IdleView.tsx` lines 5-12
- `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/SettingsView.tsx` lines 13-20

#### Problem
The `TranscriptionState` interface is identically defined in both `IdleView.tsx` and `SettingsView.tsx`. Changes to one must be manually replicated to the other, which is a maintenance burden and consistency risk.

The prior audit (ARCH-07) flagged this exact duplication. The `IPCResponse` duplication was fixed (now shared via `utils/ipc.ts`), but the `TranscriptionState` duplication was not addressed.

#### Recommended Fix
Export the `TranscriptionState` type from `useTranscription.ts` and import it in both views.

#### Acceptance Criteria
- [ ] `TranscriptionState` defined in exactly one location
- [ ] Both `IdleView` and `SettingsView` import from the shared location

---

### NEW-06: Renderer Uses Unsafe `as` Casts on IPC Event Data

**Severity:** P3 Low
**Type:** Code Quality / Type Safety
**Effort:** Small (<1hr)

#### Current State
- `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/App.tsx` line 62: `const saved = data as RecoverySession`
- `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/App.tsx` line 105: `const { index } = data as { index: number }`

#### Problem
While the hooks (`useSession.ts`, `useTranscription.ts`) now properly validate IPC event data with type guards (e.g., `isStateChangeEvent`), `App.tsx` still uses raw `as` casts for `recovery:found` and `screenshot:captured` event data. This is inconsistent with the established validation pattern and could mask runtime type errors.

#### Recommended Fix
Add type guards for these event shapes, consistent with the pattern in `useSession.ts`.

#### Acceptance Criteria
- [ ] `recovery:found` event data is validated before use
- [ ] `screenshot:captured` event data is validated before use
- [ ] No raw `as` casts on IPC event data in `App.tsx`

---

## Remaining Prior Findings

These P1-P3 items from the prior audit were not addressed in v0.6.0 and remain open.

### ARCH-03: Stale Audio Recordings Never Cleaned Up (P1)

**Status:** STILL OPEN
**File(s):** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/AudioService.ts` line 38, `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/ScreenshotService.ts` line 22

Audio recordings in `{userData}/recordings/` and screenshots in `{userData}/screenshots/` are never cleaned up after session completion. Each WAV file at 16kHz mono is approximately 1MB/minute. Over time, this will consume significant disk space.

### DEP-01: Electron 28 Has Known Vulnerabilities (P1)

**Status:** STILL OPEN
**File:** `/Users/eddiesanjuan/projects/feedbackflow/package.json` line 34

`npm audit` reports 9 vulnerabilities:
- **electron <35.7.5** -- ASAR integrity bypass (moderate, GHSA-vmqv-hx8q-j7mg)
- **tar <=7.5.6** -- Arbitrary file overwrite and symlink poisoning (high, 3 CVEs)
- **esbuild <=0.24.2** -- Development server request leak (moderate)

Installed version: Electron 28.3.3 (latest stable is 40.1.0).

### ARCH-08: `cancel()` and `reset()` Double State Transition (P2)

**Status:** PARTIALLY FIXED
**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/SessionController.ts`

The `setState` method now has a guard at line 163 that prevents `idle-to-idle` transitions when there is no error. This prevents the redundant state emission. However, `cancel()` (line 496-513) still calls `this.session = this.createFreshSession()` followed by `this.setState(SessionState.IDLE)` -- the guard prevents the double-emit, so the functional issue is resolved. The code pattern is slightly misleading but not harmful.

### Other P2/P3 Items

| ID | Finding | Status |
|----|---------|--------|
| ARCH-04 | `wrapHandlerWithArgs` unused | VERIFIED FIXED (removed) |
| ARCH-05 | `useTranscription` skips IPC validation | VERIFIED FIXED |
| ARCH-06 | `SettingsView` version fetch uses incomplete type guard | VERIFIED FIXED |
| ARCH-07 | Duplicated `IPCResponse` type | PARTIALLY FIXED (IPCResponse shared, TranscriptionState still duplicated) |
| PERF-01 | `screenshot:getCount` missing IPCResponse wrapper | VERIFIED FIXED |
| UX-01 | CompleteView shows raw markdown | VERIFIED FIXED (now shows `session.transcript`) |
| UX-02 | "Ready" text poor contrast | VERIFIED FIXED (`text-green-600 dark:text-green-400`) |
| PROD-01 | Release workflow uses deprecated action | VERIFIED FIXED (now `softprops/action-gh-release@v2`) |
| ARCH-09 | `checkMicrophonePermission` dead code | VERIFIED FIXED (removed) |
| UX-03 | No Escape key dismissal from main view | STILL OPEN |
| PROD-02 | No auto-update mechanism | STILL OPEN |
| PROD-03 | Logger doesn't persist to file | STILL OPEN |

---

## Production Readiness Assessment

### Verdict: CHANGES NEEDED

FeedbackFlow has made significant progress. The security fundamentals are solid: sandbox enabled, context isolation, IPC allowlisting, URL validation, and JSON parse validation are all in place. The v0.6.0 fixes correctly addressed the most critical findings from the prior audit.

### What is production-ready:
- **Security posture:** Strong for an Electron app. CSP, sandbox, preload allowlisting, shell.openExternal validation all properly implemented.
- **State machine:** Well-designed with watchdog timeouts, operation locks for race conditions, recovery mechanism.
- **Type safety:** Strict TypeScript with runtime type guards on IPC responses.
- **Accessibility:** ARIA labels, roles, live regions, reduced motion support, focus rings.
- **Build pipeline:** CI for lint/typecheck/build, release workflow for packaging.

### What must be addressed before release:
1. **Missing app icon** (NEW-04, P2) -- Cannot ship with default Electron icon.
2. **Version mismatch** (NEW-03, P2) -- Package.json must match release version.
3. **Electron 28 vulnerabilities** (DEP-01, P1) -- 9 known vulnerabilities including high-severity tar issues in electron-builder.
4. **Recording cleanup** (ARCH-03, P1) -- Unbounded disk usage is a real user impact issue.

### What should be addressed soon:
5. **IPC input validation on main process** (NEW-01, NEW-02, P2) -- Defense-in-depth gap where renderer data is trusted by main process.
6. **TranscriptionState duplication** (NEW-05, P3) -- Minor maintainability concern.
7. **Unsafe `as` casts in App.tsx** (NEW-06, P3) -- Inconsistency with validation pattern.

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Security vulnerability via Electron 28 | Medium | ASAR bypass requires local access; tar issues affect build tooling, not runtime |
| Disk space exhaustion | Low-Medium | User impact grows over time; bounded by usage frequency |
| Data loss from audio crash | Low | fatalError handler now properly transitions to ERROR state |
| Renderer compromise via IPC | Low | Sandbox + context isolation limit blast radius; IPC channels are allowlisted |

### Severity Distribution (New + Remaining Open)

| Severity | Count |
|----------|-------|
| P0 Critical | 0 |
| P1 High | 2 (ARCH-03, DEP-01 -- both carryover) |
| P2 Medium | 4 (NEW-01 through NEW-04) |
| P3 Low | 5 (NEW-05, NEW-06, UX-03, PROD-02, PROD-03) |

---

## Positive Observations

1. **Prior audit fixes were thorough.** 5 of 7 P0/P1 items fully fixed, the remaining 2 are acknowledged carryovers (Electron upgrade and cleanup are intentionally larger efforts).
2. **IPC type guards are now consistent.** The shared `utils/ipc.ts` pattern with `isIPCResponse` is properly used across all hooks and the Settings component.
3. **StateStore validation is exemplary.** The `isValidSessionData` method (lines 94-122) validates every field with appropriate type checks -- this is the right pattern.
4. **fatalError handling is correct.** The listener is properly bound in the constructor, checks the current state before transitioning, and is cleaned up in `destroy()`.
5. **Build pipeline is clean.** Zero typecheck errors, zero lint warnings, clean build output.
6. **Accessibility is genuinely well-implemented.** Not just token ARIA attributes, but proper `role="timer"`, `aria-live="polite"` for dynamic content, `aria-busy`, screen reader text for durations, `prefers-reduced-motion` support, and focus management.

---

## Fleet Feedback

**FRICTION:** The version mismatch between `package.json` (0.5.0) and the commit message (v0.6.0) required cross-referencing git history to understand the intended state. The numerous markdown files in the root directory (AUDIT_CLAUDE.md, AUDIT_PASS2.md, AUDIT_WAVE1.md, FINAL_POLISH.md, LAUNCH_LOG.md, LAUNCH_POSTS.md, REMAINING_ISSUES.md, SECURITY_AUDIT.md, WORKFLOW_POLISH.md) create noise. These should be consolidated or moved to `docs/`.

**MISSING_CONTEXT:** No explicit "what was fixed in v0.6.0" document beyond the commit message. The developer changes files (`.claude/runs/feedbackflow-audit/developer-a-changes.md`, `developer-b-changes.md`) document what was attempted but not a clean verification checklist.

**SUGGESTION:** After each audit-fix cycle, the developer should produce a brief "fix verification" document that maps each finding ID to the specific lines changed, making re-audit 2-3x faster. The `package.json` version bump should be part of the fix commit, not a separate step that gets forgotten.
