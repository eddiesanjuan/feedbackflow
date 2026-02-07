# markupr Agent Notes

## One-Liner Setup

When asked to "setup markupr", run:

```bash
./setup markupr
```

## Quick Test Loop

```bash
npm run dev
./scripts/one-click-clean-test.sh --skip-checks
```

## Product Defaults (Current)

- Capture screen + microphone during session
- Generate transcription after stop
- Open source mode is BYOK:
  - OpenAI key for transcription
  - Anthropic key for analysis
