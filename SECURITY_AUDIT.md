# Security Audit Report: FeedbackFlow

**Audit Date:** 2026-02-05
**Auditor:** @auditor-2 (Security Specialist)
**Version Audited:** 0.3.1
**Scope:** Electron IPC Security, Preload Script, File System Access, Security Best Practices

---

## Executive Summary

FeedbackFlow demonstrates **solid security fundamentals** for an Electron application. The codebase correctly implements context isolation, disables Node.js integration in the renderer, and uses an allowlist-based IPC channel approach. However, several medium and low severity issues were identified that should be addressed before a broader release.

**Overall Security Posture: GOOD**

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 3 |

---

## Critical Findings

*None identified.*

---

## High Severity Findings

### Finding: Sandbox Disabled in BrowserWindow Configuration

**Severity:** High
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/index.ts`
**Lines:** 41-46

```typescript
webPreferences: {
  preload: join(__dirname, "../preload/index.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,  // <-- SECURITY CONCERN
},
```

#### Problem
The `sandbox: false` setting disables Chromium's sandbox for the renderer process. While `contextIsolation: true` and `nodeIntegration: false` provide defense-in-depth, a disabled sandbox means that if an attacker exploits a vulnerability in the Chromium renderer (e.g., via a malicious webpage or injected content), they have a larger attack surface and potentially more capabilities.

The sandbox is one of Electron's most important security boundaries. Disabling it removes a critical layer of protection against renderer compromise.

#### Recommended Fix
Enable sandbox mode unless there is a specific technical requirement preventing it:

```typescript
webPreferences: {
  preload: join(__dirname, "../preload/index.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,  // Enable sandbox
},
```

If sandbox cannot be enabled due to preload script requirements, document the specific reason in a code comment.

#### Acceptance Criteria
- [ ] `sandbox` is set to `true` in BrowserWindow webPreferences
- [ ] Application still functions correctly with sandbox enabled
- [ ] If sandbox cannot be enabled, a code comment explains the technical limitation

---

## Medium Severity Findings

### Finding: IPC Handler Lacks Sender Validation

**Severity:** Medium
**Type:** Security
**Effort:** Medium (1-4hr)

#### Current State
**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/ipc.ts`
**Lines:** 79-87, 90-98, 105-113

```typescript
ipcMain.handle('transcription:setConfig', async (_, config) => {
  try {
    transcriptionService.setConfig(config)
    return { success: true }
  } catch (error) {
    // ...
  }
})

ipcMain.handle('clipboard:write', async (_, text: string) => {
  try {
    clipboard.writeText(text)
    return { success: true, data: true }
  } catch (error) {
    // ...
  }
})

ipcMain.handle('recovery:recover', async (_, session: SessionData) => {
  try {
    await sessionController.recoverSession(session)
    return { success: true }
  } catch (error) {
    // ...
  }
})
```

#### Problem
IPC handlers accept the `event` parameter (shown as `_`) but do not validate the sender. In a multi-window application or if a malicious script somehow executes in the renderer context, any sender could invoke these handlers. While this application currently has a single window, validating the sender is a defense-in-depth measure.

Additionally, the `recovery:recover` handler accepts a full `SessionData` object from the renderer without validation, which could allow a compromised renderer to inject malicious data.

#### Recommended Fix
Add sender validation to IPC handlers:

```typescript
function validateSender(event: Electron.IpcMainInvokeEvent): boolean {
  const senderUrl = event.senderFrame?.url || '';
  // Allow only the app's own renderer
  return senderUrl.startsWith('file://') ||
         senderUrl.startsWith(process.env.ELECTRON_RENDERER_URL || '');
}

ipcMain.handle('recovery:recover', async (event, session: SessionData) => {
  if (!validateSender(event)) {
    return { success: false, error: 'Unauthorized sender' };
  }
  // Validate session data structure
  if (!session?.id || typeof session.id !== 'string') {
    return { success: false, error: 'Invalid session data' };
  }
  // ... rest of handler
});
```

#### Acceptance Criteria
- [ ] All IPC handlers that modify state validate the sender
- [ ] `recovery:recover` validates the SessionData structure before processing
- [ ] Handlers return appropriate error responses for invalid senders

---

### Finding: No Input Validation on TranscriptionConfig

**Severity:** Medium
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/ipc.ts`
**Lines:** 79-87

```typescript
ipcMain.handle('transcription:setConfig', async (_, config) => {
  try {
    transcriptionService.setConfig(config)
    return { success: true }
  } catch (error) {
    // ...
  }
})
```

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/TranscriptionService.ts`
**Lines:** 425-427

```typescript
setConfig(config: Partial<TranscriptionConfig>): void {
  this.config = { ...this.config, ...config };
}
```

#### Problem
The `transcription:setConfig` IPC handler accepts any object from the renderer and passes it directly to `setConfig()`. While TypeScript provides compile-time checks, at runtime a compromised renderer could pass arbitrary data. The `whisperModel` value is used directly in file paths and process arguments without validation.

#### Recommended Fix
Add runtime validation in the IPC handler:

```typescript
const VALID_MODELS = ['tiny', 'base', 'small', 'medium'];
const VALID_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];

ipcMain.handle('transcription:setConfig', async (_, config) => {
  try {
    // Validate whisperModel
    if (config.whisperModel && !VALID_MODELS.includes(config.whisperModel)) {
      return { success: false, error: 'Invalid whisper model' };
    }
    // Validate language
    if (config.language && !VALID_LANGUAGES.includes(config.language)) {
      return { success: false, error: 'Invalid language' };
    }
    transcriptionService.setConfig(config);
    return { success: true };
  } catch (error) {
    // ...
  }
});
```

#### Acceptance Criteria
- [ ] `whisperModel` is validated against an allowlist before being set
- [ ] `language` is validated against an allowlist before being set
- [ ] Invalid config values return error responses

---

### Finding: window.open() Used in Renderer Without Validation

**Severity:** Medium
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/renderer/components/DonateButton.tsx`
**Lines:** 49-51

```typescript
const handleClick = () => {
  window.open(KOFI_URL, '_blank')
}
```

#### Problem
While `KOFI_URL` is currently hardcoded and safe, the pattern of using `window.open()` in the renderer bypasses the secure `shell:openExternal` IPC handler that properly validates URLs. This creates an inconsistent security model and could be problematic if the URL source changes in the future.

Note: The main process does have a `setWindowOpenHandler` that redirects to `shell.openExternal`, which mitigates this issue. However, relying on the IPC pattern is more explicit and maintainable.

#### Recommended Fix
Use the IPC handler for opening external URLs:

```typescript
const handleClick = async () => {
  await window.api.invoke('shell:openExternal', KOFI_URL)
}
```

#### Acceptance Criteria
- [ ] All external URL opens go through `shell:openExternal` IPC handler
- [ ] `window.open()` is not used directly in renderer code

---

### Finding: Missing webSecurity Configuration

**Severity:** Medium
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/index.ts`
**Lines:** 41-46

```typescript
webPreferences: {
  preload: join(__dirname, "../preload/index.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
  // webSecurity not explicitly set
},
```

#### Problem
While `webSecurity` defaults to `true`, explicitly setting security-critical configurations makes the security posture clear and prevents accidental changes. The current configuration doesn't explicitly set `webSecurity`, `allowRunningInsecureContent`, or `experimentalFeatures`.

#### Recommended Fix
Explicitly configure all security-relevant BrowserWindow options:

```typescript
webPreferences: {
  preload: join(__dirname, "../preload/index.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
},
```

#### Acceptance Criteria
- [ ] `webSecurity: true` is explicitly set
- [ ] `allowRunningInsecureContent: false` is explicitly set
- [ ] `experimentalFeatures: false` is explicitly set

---

## Low Severity Findings

### Finding: Missing Entitlements File

**Severity:** Low
**Type:** Security
**Effort:** Medium (1-4hr)

#### Current State
**File:** `/Users/eddiesanjuan/projects/feedbackflow/package.json`
**Lines:** 61-62

```json
"entitlements": "build/entitlements.mac.plist",
"entitlementsInherit": "build/entitlements.mac.plist",
```

The referenced `build/entitlements.mac.plist` file does not exist in the repository.

#### Problem
The electron-builder configuration references entitlements files that don't exist. While builds may succeed without them, proper entitlements are important for:
1. macOS hardened runtime compliance
2. Notarization requirements
3. Declaring minimum required permissions

#### Recommended Fix
Create the entitlements file at `build/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.device.audio-input</key>
  <true/>
  <key>com.apple.security.automation.apple-events</key>
  <true/>
</dict>
</plist>
```

#### Acceptance Criteria
- [ ] `build/entitlements.mac.plist` exists with appropriate permissions
- [ ] Entitlements include only minimum required permissions
- [ ] Application builds and runs correctly with entitlements

---

### Finding: Process Spawn Without Shell Option Explicit

**Severity:** Low
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/AudioService.ts`
**Lines:** 135-137

```typescript
this.recordingProcess = spawn("rec", args, {
  stdio: ["pipe", "pipe", "pipe"],
});
```

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/TranscriptionService.ts`
**Lines:** 275-277

```typescript
const whisperProcess = spawn(whisperBinary, args, {
  stdio: ["pipe", "pipe", "pipe"],
});
```

#### Problem
While `shell: false` is the default for `spawn()`, explicitly setting it documents the security intention and prevents accidental changes. Running commands through a shell opens up injection risks.

#### Recommended Fix
Explicitly set `shell: false`:

```typescript
this.recordingProcess = spawn("rec", args, {
  stdio: ["pipe", "pipe", "pipe"],
  shell: false,
});
```

#### Acceptance Criteria
- [ ] All `spawn()` calls explicitly set `shell: false`

---

### Finding: Session ID Used Directly in File Paths

**Severity:** Low
**Type:** Security
**Effort:** Small (<1hr)

#### Current State
**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/ScreenshotService.ts`
**Lines:** 31-33

```typescript
startSession(sessionId: string): void {
  this.sessionDir = join(this.screenshotsDir, sessionId)
  this.ensureDir(this.sessionDir)
}
```

**File:** `/Users/eddiesanjuan/projects/feedbackflow/src/main/services/AudioService.ts`
**Lines:** 62-63

```typescript
const filename = `${sessionId}.${this.config.format}`;
const outputPath = join(this.recordingsDir, filename);
```

#### Problem
Session IDs are generated using `uuid.v4()` which is safe. However, the code doesn't validate that the sessionId is actually a valid UUID before using it in file paths. If sessionId were ever passed from an untrusted source, it could enable path traversal (e.g., `../../../etc/passwd`).

Currently, session IDs are only generated internally, but defense-in-depth suggests validating inputs.

#### Recommended Fix
Add validation that sessionId is a valid UUID:

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

startSession(sessionId: string): void {
  if (!UUID_REGEX.test(sessionId)) {
    throw new Error('Invalid session ID');
  }
  this.sessionDir = join(this.screenshotsDir, sessionId);
  this.ensureDir(this.sessionDir);
}
```

#### Acceptance Criteria
- [ ] Session IDs are validated as UUIDs before use in file paths
- [ ] Invalid session IDs throw an error rather than creating unexpected paths

---

## Positive Observations

The following security practices are correctly implemented:

1. **Context Isolation Enabled** (`contextIsolation: true`) - Prevents renderer from accessing Node.js globals directly.

2. **Node Integration Disabled** (`nodeIntegration: false`) - Renderer cannot use `require()` or access Node.js APIs.

3. **Allowlist-Based IPC Channels** - The preload script uses `Set` objects to enforce allowed channels:
   ```typescript
   const allowedInvokeChannels = new Set([...]);
   const allowedOnChannels = new Set([...]);
   ```

4. **Minimal API Surface** - The preload only exposes `process.versions` from Electron, not full Node.js APIs.

5. **URL Validation for External Links** - The `shell:openExternal` handler validates URLs and only allows http/https protocols.

6. **Window Open Handler** - External navigation is blocked and redirected to system browser.

7. **Hardened Runtime Enabled** - The electron-builder config has `hardenedRuntime: true`.

8. **No Remote Module** - The deprecated `remote` module is not used.

---

## Fleet Feedback

**FRICTION:** The missing entitlements file required checking file system rather than just code review. Build artifacts and configuration files should be present in the repository for complete security audits.

**MISSING_CONTEXT:** Information about the intended deployment model (signed vs unsigned, notarized vs ad-hoc) would help assess the severity of entitlements issues.

**SUGGESTION:** Consider adding a `SECURITY.md` that documents the security model, what permissions the app requires and why, and the threat model the design addresses. This helps both security reviewers and future developers understand security decisions.

---

## Conclusion

FeedbackFlow has a solid security foundation with the correct use of context isolation, disabled node integration, and allowlisted IPC channels. The high-severity finding (disabled sandbox) should be prioritized, followed by the medium-severity input validation issues. The low-severity items are hardening measures that would benefit a production release.

**Verdict: APPROVED WITH NOTES**

The application can proceed to release after addressing the High severity finding. Medium and Low findings are recommended but not blocking for an initial release.
