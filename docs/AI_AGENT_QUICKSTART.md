# AI Agent Quickstart

This repo includes a one-command setup path for coding agents.

## Command

From repo root:

```bash
./setup markupr
```

This command:
- validates Node.js version (18+)
- installs dependencies if missing
- runs `npm run typecheck`

## Fast Variants

```bash
./setup markupr --skip-install
./setup markupr --skip-checks
```

## First Run Test Loop

After setup:

```bash
npm run dev
./scripts/one-click-clean-test.sh --skip-checks
```

## BYOK Requirements (Open Source Mode)

For full report quality in this repo version:
- OpenAI API key (transcription)
- Anthropic API key (analysis)

Keys are configured in-app under `Settings > Advanced`.
