# FeedbackFlow Launch Posts

## Reddit: r/macapps

**Title:** FeedbackFlow - Menu bar voice capture with local transcription (free, open source)

**Body:**

I built a menu bar app for capturing voice feedback while testing software. Click to record, speak naturally, get transcribed Markdown.

**Why I built it:** I was constantly context-switching between testing an app, opening a notes app, and typing feedback. I wanted something that lives in the menu bar and lets me just talk.

**What makes it different:**
- Transcription runs locally using Whisper.cpp (no API keys, no cloud, audio never leaves your machine)
- Menu bar native - no dock icon, no app window to manage
- Outputs Markdown ready to paste into any AI tool or documentation
- Takes screenshots automatically while you record

**Download:** https://github.com/eddiesanjuan/feedbackflow/releases

MIT licensed, free, open source. Looking for feedback from actual users.

---

## Reddit: r/sideproject

**Title:** I built a voice-to-Markdown menu bar app for developers (open source)

**Body:**

Shipping my first public release: FeedbackFlow

**The problem:** When testing software, I constantly switch between the app I'm testing, a notes app, and my keyboard. By the time I type my thought, I've lost half of it.

**The solution:** A menu bar app where I click once, speak my feedback, and get transcribed Markdown I can paste anywhere.

**The interesting part:** Transcription runs 100% locally using Whisper.cpp. No API keys, no cloud services, your audio never leaves your device. This was important to me because I'm often testing things I can't share with third parties.

**Stack:** Electron, React, TypeScript, Whisper.cpp

**What I learned:** 
- Menu bar apps on macOS are trickier than expected (no dock icon = different lifecycle)
- Local Whisper is surprisingly good and fast on M-series Macs
- Electron gets hate but for this use case it was the right call

**Links:**
- Download: https://github.com/eddiesanjuan/feedbackflow/releases
- Repo: https://github.com/eddiesanjuan/feedbackflow

It's free and MIT licensed. Would love feedback, especially on the UX.

---

## Reddit: r/electronjs

**Title:** Menu bar app with local Whisper transcription - lessons learned

**Body:**

Just released FeedbackFlow, a menu bar voice recorder with local AI transcription. Some things I learned building it:

**Menu bar lifecycle is different:** When you run Electron without a dock icon (`dock.hide()`), the app lifecycle changes. No automatic `activate` event when clicking the tray. You need to manage window visibility more carefully.

**Local Whisper performance:** Using whisper.cpp (not the Python version) on Apple Silicon is shockingly fast. Base model transcribes faster than real-time on M1+. The main overhead is loading the model the first time.

**Screenshot capture:** Used `desktopCapturer` but had to handle Monterey+ screen recording permissions carefully. Users get prompted on first use.

**The app:** Records voice from menu bar, captures screenshots, transcribes locally, outputs Markdown. Designed for developers giving feedback while testing software.

**Links:**
- GitHub: https://github.com/eddiesanjuan/feedbackflow
- Download: https://github.com/eddiesanjuan/feedbackflow/releases

Happy to answer questions about the implementation.

---

## Notes for Eddie

**My posting strategy:**
1. Post to r/macapps first (largest relevant audience)
2. Wait 24-48h to see response
3. Post to r/sideproject with the "story" angle
4. Post to r/electronjs with technical angle

**I can't actually post these** - you need to do it from your Reddit account (or I need access). These are ready to copy/paste.

**Things to adjust:**
- If you want different tone/voice
- If any facts are wrong
- If you want to wait before posting anywhere
