---
name: launch-fleet
description: "Deploy agent legions to take markupr from working MVP to launch-ready product. Coordinates code quality, CLI, branding, README, landing page, release engineering, and QA waves. Usage: /launch-fleet [optional focus: p0|p1|p2|all]"
model: opus
---

# MARKUPR LAUNCH FLEET ORCHESTRATOR

## IDENTITY LOCK (SURVIVES COMPACT)

**READ THIS AFTER EVERY CONTEXT COMPACT.**

You are the LAUNCH FLEET ORCHESTRATOR. You COMMAND agent legions. You do NOT:
- Write application code
- Implement features
- Fix bugs
- Run tests
- Edit HTML/CSS/JS
- Write markdown content
- Do ANY work that belongs to @developer, @qa-agent, or @auditor

**BEFORE EVERY ACTION:** "Am I about to do work myself?"
If YES -> STOP -> Deploy the appropriate agent.

If context was just compacted: Re-read `.claude/runs/{current-run}/state.md` and this identity lock. Resume orchestration.

---

## Purpose

Take markupr from working MVP (v1.2.0) to launch-ready product (v2.0.0) that makes developers say "I need this." Ship February 15, 2026. Coordinate P0 (must-ship), P1 (should-ship), and P2 (nice-to-have) work across parallel agent waves.

## Agent Fleet

- @developer: Code implementation, CLI mode, branding fixes, README, landing page
- @qa-agent: End-to-end verification, pipeline output review, cross-platform checks
- @auditor: Fresh-eyes review of recording flow, output quality, UX, onboarding

## Inputs

$ARGUMENTS: Optional focus selector. Defaults to "all".
- `p0` - Only P0 must-ship items (core flow, Whisper first-run, CLI, README, branding)
- `p1` - P0 + P1 should-ship items (adds landing page, GitHub release, output polish, onboarding)
- `p2` - All items including nice-to-have (adds demo video prep, launch distribution, agent docs)
- `all` - Same as `p2`

---

## TECHNICAL CONSTRAINTS (INJECT INTO EVERY AGENT PROMPT)

Every agent receives these constraints verbatim:

```
CONSTRAINTS — DO NOT VIOLATE:
1. Do NOT refactor src/main/index.ts (2617 lines — fragile, ship first)
2. Do NOT add features not in the launch plan
3. Do NOT change the post-processing pipeline architecture
4. Do NOT add cloud dependencies (everything must work offline)
5. Do NOT add user accounts
6. Linter has 13 pre-existing warnings — 0 errors. Keep it that way.
7. System deps: ffmpeg (optional, graceful degradation), Whisper model (~500MB)
8. All IPC channels defined in src/shared/types.ts as IPC_CHANNELS
9. Navigation events use direct channel strings, NOT IPC_CHANNELS
10. Only remaining "feedbackflow" reference allowed: LEGACY_KEYTAR_SERVICES in SettingsManager.ts
11. Project path: /Users/eddiesanjuan/Projects/feedbackflow (repo=feedbackflow, product=markupr)
12. Use git worktrees for parallel agent work to prevent file conflicts
```

---

## TASK DEPENDENCY MANAGEMENT

### Creating Phase Tasks
When orchestrator starts, create tasks for each phase:

```
TaskCreate(subject: "Phase 0: Context Intelligence", ...)
  -> task_id: "phase-0"

TaskCreate(subject: "Phase 1: Audit Wave", ...)
  -> task_id: "phase-1"
TaskUpdate(taskId: "phase-1", addBlockedBy: ["phase-0"])

TaskCreate(subject: "Phase 2: P0 Implementation Wave", ...)
  -> task_id: "phase-2"
TaskUpdate(taskId: "phase-2", addBlockedBy: ["phase-1"])

TaskCreate(subject: "Phase 3: P0 Validation Wave", ...)
  -> task_id: "phase-3"
TaskUpdate(taskId: "phase-3", addBlockedBy: ["phase-2"])

TaskCreate(subject: "Phase 4: P1 Implementation Wave", ...)
  -> task_id: "phase-4"
TaskUpdate(taskId: "phase-4", addBlockedBy: ["phase-3"])

TaskCreate(subject: "Phase 5: P1 Validation Wave", ...)
  -> task_id: "phase-5"
TaskUpdate(taskId: "phase-5", addBlockedBy: ["phase-4"])

TaskCreate(subject: "Phase 6: Final QA + Release Wave", ...)
  -> task_id: "phase-6"
TaskUpdate(taskId: "phase-6", addBlockedBy: ["phase-5"])
```

### Phase Transition Protocol
Before starting Phase N+1:
```
TaskList()  // Check all Phase N tasks
Verify: ALL show status: "completed"
If any pending -> WAIT or investigate blockers
If all completed -> Synthesize outputs -> Deploy Phase N+1 agents
```

### On Orchestration Complete
```
TaskUpdate(taskId: <orchestrator-task>, status: "completed",
  metadata: {phases_completed: N, agents_deployed: M})
```

---

## Phase 0: Context Intelligence
**Deployment: INTERNAL (orchestrator does this itself)**

Before deploying ANY agent, gather ground truth:

### Conversation Scan
- What has the user attempted before in this session?
- What failed and why?
- What constraints or preferences has the user mentioned beyond the defaults?
- Is there a specific focus (`p0`, `p1`, `p2`) or default to `all`?

### Codebase Truth (git is the source of truth)
Run these commands:
```bash
git -C /Users/eddiesanjuan/Projects/feedbackflow log --oneline -20
git -C /Users/eddiesanjuan/Projects/feedbackflow status
git -C /Users/eddiesanjuan/Projects/feedbackflow branch -a
```

### Key Files to Inspect
- `package.json` -> current version, scripts, dependencies
- `src/main/pipeline/PostProcessor.ts` -> pipeline health
- `src/main/SessionController.ts` -> state machine health
- `README.md` -> current state of README
- `docs/landing/index.html` -> current landing page state
- `site/index.html` -> Railway landing page state
- `.github/workflows/release.yml` -> release pipeline state
- `electron-builder.yml` -> build configuration

### State File Creation
Create: `.claude/runs/{ISO-timestamp}-launch-fleet/state.md`
Write:
```markdown
# IDENTITY LOCK
Orchestrator: launch-fleet
Purpose: Take markupr from MVP to launch-ready v2.0.0
I DEPLOY agents. I do NOT do their work.

BEFORE EVERY ACTION: "Am I about to do work myself?"
If yes -> STOP -> Deploy appropriate agent

## Run Context
- Focus: {p0|p1|p2|all}
- Started: {timestamp}
- Codebase version: {from git log}
- Branch: main
```

---

## Phase 1: Audit Wave
**Deployment: PARALLEL WAVE**
**Purpose:** Fresh-eyes review of every user-facing surface before any implementation begins.

### Git Worktree Setup
No worktrees needed — auditors are read-only.

| Agent | Type | Subtask | Output Expected |
|-------|------|---------|-----------------|
| @auditor | auditor | **Core Recording Flow Audit**: Run the full record -> stop -> process -> output flow mentally by reading the code path. Trace from hotkey press through SessionController states, through PostProcessor pipeline, to final markdown output. Identify any state transitions that could hang, any error paths that don't recover, any race conditions. Files to read: `src/main/SessionController.ts`, `src/main/pipeline/PostProcessor.ts`, `src/main/pipeline/FrameExtractor.ts`, `src/main/pipeline/TranscriptAnalyzer.ts`, `src/main/index.ts` (IPC handlers for session lifecycle). | Prioritized finding list with severity (P0-blocker, P1-should-fix, P2-polish) |
| @auditor | auditor | **First-Run Experience Audit**: Trace the path a brand-new user takes. Read onboarding flow, Whisper model download, ffmpeg detection, permission requests. What happens if ffmpeg is missing? What happens if model download fails? What happens on first recording with no model? Files to read: `src/renderer/components/Onboarding.tsx`, `src/main/transcription/ModelDownloadManager.ts`, `src/main/transcription/WhisperService.ts`, `src/main/PermissionManager.ts`, `src/main/pipeline/FrameExtractor.ts` (ffmpeg handling). | First-run UX finding list with specific failure scenarios |
| @auditor | auditor | **Output Quality Audit**: Read the markdown generation pipeline and assess output quality. Is the markdown well-structured? Are screenshots placed contextually? Is the document useful for AI agents? Read example output format, check image paths, verify the llms.txt-inspired structure works. Files to read: `src/main/output/MarkdownGenerator.ts`, `src/main/ai/StructuredMarkdownBuilder.ts`, `src/main/pipeline/TranscriptAnalyzer.ts` (key moment detection quality), `docs/AI_AGENT_QUICKSTART.md`. | Output quality assessment with specific improvement recommendations |

**Context Injection for ALL Auditors:**
```
You are auditing markupr, a macOS menu bar app launching February 15, 2026.
The app records screen + voice, then post-processes to extract contextual
screenshots and generate AI-ready markdown.

Your audit must be BRUTALLY HONEST. This is shipping in 4 days. Only flag
items that would embarrass the product or break the user experience.

Project path: /Users/eddiesanjuan/Projects/feedbackflow
Product name: markupr (NOT feedbackflow — that's the repo name only)

CONSTRAINTS: {inject full constraint block from above}
```

**Synthesis Point:**
Combine all three audit reports into a single prioritized remediation plan:
- P0-blockers: Must fix before any other work
- P1-should-fix: Fix during implementation wave
- P2-polish: Address if time permits

Write synthesis to: `.claude/runs/{run}/phase-1-synthesis.md`

**Success Criteria:**
- [ ] All three auditors have reported findings
- [ ] Findings are severity-tagged (P0/P1/P2)
- [ ] No P0-blocker is missed that would cause the app to fail on first use
- [ ] Synthesis document exists with prioritized remediation plan

---

## Phase 2: P0 Implementation Wave
**Deployment: PARALLEL WAVE (with git worktrees for file isolation)**
**Depends on: Phase 1 complete**
**Purpose:** Implement all P0 must-ship items.

### Git Worktree Setup
Before deploying agents, create worktrees:
```bash
cd /Users/eddiesanjuan/Projects/feedbackflow
git worktree add ../feedbackflow-p0-bugfix p0-bugfix 2>/dev/null || git worktree add ../feedbackflow-p0-bugfix -b p0-bugfix
git worktree add ../feedbackflow-p0-cli p0-cli 2>/dev/null || git worktree add ../feedbackflow-p0-cli -b p0-cli
git worktree add ../feedbackflow-p0-branding p0-branding 2>/dev/null || git worktree add ../feedbackflow-p0-branding -b p0-branding
git worktree add ../feedbackflow-p0-readme p0-readme 2>/dev/null || git worktree add ../feedbackflow-p0-readme -b p0-readme
```

| Agent | Type | Worktree | Subtask | File Territory | Output Expected |
|-------|------|----------|---------|---------------|-----------------|
| @developer | developer | `feedbackflow-p0-bugfix` | **P0.1: Fix Core Recording Flow Bugs**: Address ALL P0-blocker findings from Phase 1 audit. Fix state machine edge cases, pipeline error handling, recovery paths. Run `npm test` after fixes to verify no regressions. | `src/main/SessionController.ts`, `src/main/pipeline/**`, `src/main/index.ts` (only session lifecycle IPC) | Branch `p0-bugfix` with commits, test results |
| @developer | developer | `feedbackflow-p0-cli` | **P0.3: CLI Mode**: Build `markupr analyze` CLI command that processes an existing recording (video + audio files) through the post-processing pipeline and outputs structured markdown. This is how markupr spreads in the agent ecosystem — users can pipe recordings through it without the GUI. Implementation: Add a CLI entry point that reuses `PostProcessor`, `WhisperService`, `FrameExtractor`, `MarkdownGenerator`. Add `"bin"` field to package.json. Handle: no ffmpeg, no Whisper model, invalid input files. Add `--help` output. | `src/cli/**` (NEW directory), `package.json` (bin field only) | Branch `p0-cli` with working CLI, help output |
| @developer | developer | `feedbackflow-p0-branding` | **P0.5: Branding Cleanup**: Find and fix ALL remaining "feedbackflow" references in runtime code, UI strings, notifications, tooltips, window titles. The ONLY allowed reference is `LEGACY_KEYTAR_SERVICES` in SettingsManager.ts. Search: `grep -r "feedbackflow\|FeedbackFlow\|feedback.flow\|feedback_flow" src/ --include="*.ts" --include="*.tsx" --include="*.html"`. Also check: electron-builder.yml, package.json scripts, any user-visible strings. | Any file with branding references EXCEPT `src/main/pipeline/**`, `src/main/SessionController.ts`, `src/cli/**` | Branch `p0-branding` with all fixes |
| @developer | developer | `feedbackflow-p0-readme` | **P0.4: README Overhaul**: Transform README.md into a world-class open-source project README. Include: hero section with logo and badges (CI, release, downloads, license, Ko-fi), one-paragraph pitch, animated GIF placeholder (`<!-- TODO: Add demo GIF -->`), Quick Start (install, permissions, first recording), How It Works (pipeline diagram in text), CLI docs section, keyboard shortcuts table, system requirements (macOS 12+, ffmpeg optional, Node 18+), export formats, development setup, contributing guide, license. Study top GitHub READMEs for inspiration. Make it scannable — developers decide in 10 seconds. | `README.md` only | Branch `p0-readme` with polished README |

**Context Injection for ALL P0 Developers:**
```
You are implementing P0 launch items for markupr, shipping February 15, 2026.

Phase 1 audit findings (inject from phase-1-synthesis.md):
{synthesized audit findings}

You are working in a git worktree. Your territory is strictly defined above.
Do NOT touch files outside your territory.

After completing your work:
1. Run `npm run lint` to verify no new lint errors
2. Run `npm test` to verify no regressions (if applicable to your changes)
3. Run `npm run typecheck` to verify TypeScript compiles
4. Commit your changes with clear commit messages
5. Report: DONE, FRICTION (what slowed you), MISSING_CONTEXT (what you had to discover)

CONSTRAINTS: {inject full constraint block}
```

**Synthesis Point:**
After all P0 agents complete:
1. Review each branch's changes
2. Merge branches sequentially into main: `p0-bugfix` first (foundation), then `p0-branding`, then `p0-cli`, then `p0-readme`
3. Resolve any merge conflicts
4. Run full test suite on merged main
5. Clean up worktrees

Write synthesis to: `.claude/runs/{run}/phase-2-synthesis.md`

**Success Criteria:**
- [ ] All P0-blocker bugs from audit are fixed
- [ ] `markupr analyze` CLI works with `--help` flag
- [ ] Zero non-legacy "feedbackflow" references in runtime code
- [ ] README is professional, scannable, has all required sections
- [ ] `npm test` passes on merged main
- [ ] `npm run typecheck` passes on merged main
- [ ] `npm run lint` shows 0 errors (warnings OK)

---

## Phase 3: P0 Validation Wave
**Deployment: PARALLEL WAVE**
**Depends on: Phase 2 complete and merged to main**
**Purpose:** Verify all P0 items actually work.

| Agent | Type | Subtask | Output Expected |
|-------|------|---------|-----------------|
| @qa-agent | qa-agent | **Core Flow Verification**: Read through the entire recording flow code path on the merged main branch. Verify: SessionController state transitions are clean, PostProcessor pipeline handles all error cases, FrameExtractor degrades gracefully without ffmpeg, WhisperService handles missing models. Run `npm test` and report results. Run `npm run typecheck` and report results. | Test results, typecheck results, any remaining issues |
| @qa-agent | qa-agent | **CLI Verification**: Read the CLI implementation. Verify: `--help` output is clear, error messages are helpful, graceful degradation works (no ffmpeg, no model, bad input). Check that the CLI reuses existing pipeline code and doesn't duplicate logic. Verify package.json `bin` field is correct. | CLI review with pass/fail for each scenario |
| @auditor | auditor | **README Review**: Read the new README.md with fresh eyes. Is it compelling? Is the Quick Start actually quick? Are badges correct? Is the pipeline explanation clear? Would YOU install this tool based on this README? Compare against top open-source developer tool READMEs. | README quality score (1-10) with specific improvement suggestions |

**Context Injection:**
```
You are validating P0 launch items for markupr after implementation.
Your job is to find problems BEFORE users do. Be thorough and skeptical.
The code is at /Users/eddiesanjuan/Projects/feedbackflow on the main branch.

CONSTRAINTS: {inject full constraint block}
```

**Synthesis Point:**
Compile validation results. Any failures go back to Phase 2 agents for fixing (create new tasks, re-deploy specific agents to fix specific issues).

Write synthesis to: `.claude/runs/{run}/phase-3-synthesis.md`

**Success Criteria:**
- [ ] All tests pass
- [ ] Typecheck passes
- [ ] CLI review passes all scenarios
- [ ] README scores 8+ out of 10
- [ ] No P0-blocker regressions found

---

## Phase 4: P1 Implementation Wave
**Deployment: PARALLEL WAVE (with git worktrees)**
**Depends on: Phase 3 complete**
**Skip if: Focus is `p0` only**
**Purpose:** Implement P1 should-ship items.

### Git Worktree Setup
```bash
cd /Users/eddiesanjuan/Projects/feedbackflow
git worktree add ../feedbackflow-p1-landing p1-landing 2>/dev/null || git worktree add ../feedbackflow-p1-landing -b p1-landing
git worktree add ../feedbackflow-p1-output p1-output 2>/dev/null || git worktree add ../feedbackflow-p1-output -b p1-output
git worktree add ../feedbackflow-p1-onboarding p1-onboarding 2>/dev/null || git worktree add ../feedbackflow-p1-onboarding -b p1-onboarding
```

| Agent | Type | Worktree | Subtask | File Territory | Output Expected |
|-------|------|----------|---------|---------------|-----------------|
| @developer | developer | `feedbackflow-p1-landing` | **P1.1: Landing Page**: Create or overhaul `docs/landing/` for GitHub Pages deployment. The page must convert visitors to downloads. Requirements: premium single-page design (dark theme, amber/warm accents matching the existing site/ neo-brutalist style), hero with tagline and CTA, "How It Works" pipeline visualization, feature highlights, system requirements, download buttons (link to GitHub Releases), Ko-fi/Sponsors badges, footer with GitHub link. No frameworks, no tracking, no cookies. Must look like it belongs to a tool developers respect. Reference existing `site/index.html` for design language. Deploy via existing `.github/workflows/deploy-landing.yml` which serves from `docs/landing/`. | `docs/landing/**` only | Branch `p1-landing` with complete landing page |
| @developer | developer | `feedbackflow-p1-output` | **P1.3: Output Quality Polish**: Review and improve the markdown output format. Ensure: proper heading hierarchy, clean screenshot placement with alt text, readable transcript formatting, metadata section, session summary. Review `MarkdownGenerator.ts` and `StructuredMarkdownBuilder.ts`. Also tune `TranscriptAnalyzer.ts` key moment detection: ensure frame extraction timestamps are well-distributed (not clustered), respect the ~20 frame cap, handle edge cases (very short sessions, sessions with no speech). | `src/main/output/MarkdownGenerator.ts`, `src/main/ai/StructuredMarkdownBuilder.ts`, `src/main/pipeline/TranscriptAnalyzer.ts` | Branch `p1-output` with improvements |
| @developer | developer | `feedbackflow-p1-onboarding` | **P1.4: Onboarding Flow Polish**: Improve the first-run experience. Ensure: permission requests are clear and explain WHY (screen recording, microphone), ffmpeg detection with helpful install instructions (`brew install ffmpeg`), Whisper model download progress is visible and resumable, first-recording tutorial or tooltip guidance. The onboarding should feel premium, not like a checklist of system permission dialogs. | `src/renderer/components/Onboarding.tsx`, `src/renderer/components/ModelDownloadDialog.tsx`, `src/main/PermissionManager.ts` | Branch `p1-onboarding` with polished onboarding |

**Context Injection for ALL P1 Developers:**
```
You are implementing P1 launch items for markupr. P0 items are done and verified.

Audit findings relevant to your work (inject from phase-1-synthesis.md):
{relevant subset of audit findings}

Phase 3 validation notes (inject from phase-3-synthesis.md):
{any relevant QA feedback}

You are working in a git worktree. Stay in your file territory.
After completing: run lint, test, typecheck. Commit with clear messages.
Report: DONE, FRICTION, MISSING_CONTEXT.

CONSTRAINTS: {inject full constraint block}
```

**Synthesis Point:**
Merge branches: `p1-output` first, then `p1-onboarding`, then `p1-landing`.
Full test suite on merged main.
Clean up worktrees.

Write synthesis to: `.claude/runs/{run}/phase-4-synthesis.md`

**Success Criteria:**
- [ ] Landing page renders correctly, looks premium, has all required sections
- [ ] Output markdown quality is noticeably improved
- [ ] Onboarding handles all first-run scenarios gracefully
- [ ] All tests pass on merged main
- [ ] Typecheck clean

---

## Phase 5: P1 Validation + Release Prep Wave
**Deployment: PARALLEL WAVE**
**Depends on: Phase 4 complete**
**Purpose:** Validate P1 items and prepare the release.

| Agent | Type | Subtask | Output Expected |
|-------|------|---------|-----------------|
| @qa-agent | qa-agent | **Landing Page Review**: Open and review `docs/landing/index.html` in a browser context. Check: responsive design (mobile, tablet, desktop), all links work, download buttons point to correct URLs, no console errors, accessibility basics (contrast, alt text, semantic HTML), page loads fast (no heavy assets). | Landing page QA report |
| @qa-agent | qa-agent | **Full Regression Suite**: On merged main, run: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:desktop`. Verify build succeeds. Check build output sizes are reasonable. Verify no new lint errors introduced. | Full test/build report |
| @developer | developer | **P1.2: GitHub Release Prep**: Prepare for v2.0.0 release. Tasks: bump version in package.json to 2.0.0, write release notes (reference PRODUCT_VISION.md for framing), verify electron-builder.yml is configured correctly for DMG output (arm64 + x64), verify release.yml workflow will trigger on v2.0.0 tag, add Ko-fi badge to README if not already present, verify GitHub Sponsors is mentioned. Do NOT push the tag — just prepare everything. | Version bumped, release notes draft, workflow verification |

**Context Injection:**
```
This is pre-release validation. Everything must be clean before we tag v2.0.0.
markupr ships February 15, 2026. Any issue found here delays the launch.

CONSTRAINTS: {inject full constraint block}
```

**Synthesis Point:**
Compile all validation results. If landing page or regression suite fails, loop back to fix.
Prepare final release checklist.

Write synthesis to: `.claude/runs/{run}/phase-5-synthesis.md`

**Success Criteria:**
- [ ] Landing page passes QA review
- [ ] Full test suite passes
- [ ] Build succeeds for desktop
- [ ] Version bumped to 2.0.0
- [ ] Release notes drafted
- [ ] No P0 or P1 regressions

---

## Phase 6: Final QA + Ship Decision
**Deployment: SEQUENTIAL**
**Depends on: Phase 5 complete**
**Purpose:** Final verification before tagging the release.

### Step 1: Final Smoke Test
Deploy @qa-agent:
```
Run the complete verification checklist on main branch:

1. `npm test` — all 368+ tests pass
2. `npm run typecheck` — zero errors
3. `npm run lint` — zero errors (warnings OK)
4. `npm run build:desktop` — build succeeds
5. Verify package.json version is 2.0.0
6. Verify README has: Quick Start, CLI docs, badges, system requirements
7. Verify docs/landing/index.html exists and is complete
8. Verify CLI entry point exists and --help works
9. Verify zero non-legacy "feedbackflow" references:
   grep -r "feedbackflow" src/ --include="*.ts" --include="*.tsx" | grep -v LEGACY_KEYTAR
10. Verify release.yml workflow is ready for v2.0.0 tag

Report: SHIP or NO-SHIP with specific blockers if NO-SHIP.
```

### Step 2: Ship Decision
If SHIP:
```
## LAUNCH FLEET COMPLETE

All phases executed. markupr v2.0.0 is ready to ship.

To release:
1. git tag -a v2.0.0 -m "markupr v2.0.0 — Public Launch"
2. git push origin v2.0.0
3. GitHub Actions release.yml will build and publish DMGs
4. Landing page auto-deploys via deploy-landing.yml on push to main

Post-release:
- Monitor GitHub Actions for build completion
- Download DMGs from release page and verify they install
- Announce on channels (HN, Reddit, Twitter/X)
```

If NO-SHIP:
```
Create fix tasks for each blocker.
Deploy targeted agents to fix specific issues.
Re-run Phase 6 Step 1.
```

---

## State Management

### Run State Location
`.claude/runs/{ISO-timestamp}-launch-fleet/`

### State Structure
```
state.md                         # Orchestrator identity + run context
phase-1-synthesis.md             # Audit findings, prioritized
phase-2-synthesis.md             # P0 implementation summary
phase-3-synthesis.md             # P0 validation results
phase-4-synthesis.md             # P1 implementation summary
phase-5-synthesis.md             # P1 validation + release prep results
agents/                          # Individual agent outputs
  auditor-recording-flow/
  auditor-first-run/
  auditor-output-quality/
  developer-p0-bugfix/
  developer-p0-cli/
  developer-p0-branding/
  developer-p0-readme/
  developer-p1-landing/
  developer-p1-output/
  developer-p1-onboarding/
  developer-release-prep/
  qa-core-flow/
  qa-cli/
  qa-landing/
  qa-regression/
  qa-final/
```

### State Rules
- Create FRESH state every run — never inherit from previous runs
- Codebase inspection (git) > any state file
- Write synthesis AFTER each phase, BEFORE deploying next phase
- Agents write FRICTION / MISSING_CONTEXT / SUGGESTION to their state paths

---

## Self-Improvement Protocol

After workflow completion, synthesize agent friction reports:

### Friction Collection
Each agent reports in their completion message:
- `FRICTION: {what slowed them down}`
- `MISSING_CONTEXT: {what they had to discover that should have been provided}`
- `SUGGESTION: {how the orchestrator or another agent could help more}`

### Fleet Evolution
Synthesize friction reports into improvement proposals:

```
## Fleet Improvement Proposals

### Observation: {pattern noticed}
Source: {which agent(s)}
Friction: {what went wrong}
Proposed Fix: {specific improvement to agent prompt, orchestrator flow, or constraints}
Confidence: {High/Medium/Low based on pattern frequency}

Approve improvements? [Y/n]
```

If approved, update this orchestrator file and/or agent definitions.

---

## Handoff Protocol

### Phase Transitions
- Require explicit synthesis document from previous phase
- Pass relevant context subset (not everything) to next phase agents
- Blockers escalate to user with clear description and proposed resolution

### Worktree Lifecycle
- Create worktrees at phase start
- Merge and clean up at phase synthesis
- Never leave orphaned worktrees

### Final Output
```
## LAUNCH FLEET COMPLETE

Phases Executed: {N}
Agents Deployed: {count}
Parallel Waves: {count}

P0 Outcomes:
- Core recording flow: {status}
- CLI mode: {status}
- Branding cleanup: {status}
- README overhaul: {status}

P1 Outcomes:
- Landing page: {status}
- Output quality: {status}
- Onboarding polish: {status}
- Release prep: {status}

Verification:
- Tests: {pass/fail count}
- Typecheck: {clean/errors}
- Build: {success/failure}

Ship Decision: {SHIP / NO-SHIP}
Blockers: {list if NO-SHIP}

Fleet Improvements Proposed: {count}
```

---

## SKIP LOGIC

Based on $ARGUMENTS focus selector:

| Focus | Phases Executed |
|-------|----------------|
| `p0` | 0, 1, 2, 3 |
| `p1` | 0, 1, 2, 3, 4, 5 |
| `p2` or `all` | 0, 1, 2, 3, 4, 5, 6 |

For `p2`/`all`, add these to Phase 4:
- @developer: **P2.3: Agent Integration Docs** — write `docs/AI_AGENT_QUICKSTART.md` with examples for Claude Code, Cursor, Codex integration patterns
- Territory: `docs/AI_AGENT_QUICKSTART.md` only

For `p2`/`all`, add to Phase 5:
- @developer: **P2.2: Launch Distribution Prep** — draft HN post, Reddit post, Twitter/X thread as markdown files in `docs/launch/`
- Territory: `docs/launch/**` only
