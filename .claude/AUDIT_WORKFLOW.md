# FeedbackFlow Audit Workflow

## The Loop

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Code    │────▶│   OpenCode      │────▶│   Manual Test   │
│  (Build/Fix)    │     │   (Audit)       │     │   (Verify)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       │                       │
        │                       │                       │
        └───────────────────────┴───────────────────────┘
                        (iterate until clean)
```

## Commands

### Claude Code (Max subscription, NOT API)
```bash
cd /Users/eddiesanjuan/Projects/feedbackflow
unset ANTHROPIC_API_KEY && claude --dangerously-skip-permissions
```

### OpenCode + GPT 5.2 (for auditing)
```bash
cd /Users/eddiesanjuan/Projects/feedbackflow
opencode
# Then use GPT 5.2 for code review
```

## Audit Checklist

### Core Functionality
- [ ] App launches without errors
- [ ] Menu bar icon appears
- [ ] Click opens popover
- [ ] Recording starts/stops cleanly
- [ ] Audio is captured correctly
- [ ] Whisper transcription works
- [ ] Screenshots capture during recording
- [ ] Markdown output is generated
- [ ] Copy to clipboard works
- [ ] App recovers from crashes

### Code Quality
- [ ] TypeScript compiles with no errors
- [ ] No unhandled promises
- [ ] Proper error handling throughout
- [ ] IPC channels are secure
- [ ] No memory leaks in recording loop
- [ ] Clean separation of concerns
- [ ] Consistent code style

### UX Quality
- [ ] Responsive UI (no lag)
- [ ] Clear visual feedback for all states
- [ ] Error messages are helpful
- [ ] First-time experience is smooth
- [ ] Keyboard shortcuts work
- [ ] Accessibility basics

## Current Status

**Last Audit:** Not yet audited properly
**Issues Found:** TBD
**Next Action:** Run full audit cycle

## Notes

- Claude Code uses Eddie's Max subscription (must unset ANTHROPIC_API_KEY)
- OpenCode can use GPT 5.2 for high-reasoning audits
- Conrad orchestrates, agents execute
