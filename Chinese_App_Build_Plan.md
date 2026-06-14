# 学中文 — Build Plan for a Personal Chinese Learning App

**For:** Fadi  ·  **Prepared:** 13 June 2026
**Goal:** A web app (phone + computer) that turns Chinese text *you encounter in the wild* into study cards — by typing it, pasting it, uploading a screenshot that gets read automatically, or snapping a photo — and then teaches it back to you with flashcards, quizzes, search, and audio.

This document is written so you can hand it straight to Claude (or any developer) and have the app built phase by phase. A ready-to-use kickoff prompt is at the end.

---

## 1. The core idea

You already learn the way the best learners do: you collect real Chinese as you meet it (Facebook reels, YouTube, WhatsApp) and revisit it. The folder of 192 screenshots proves it. The problem is that screenshots are a graveyard — you can't review, search, or quiz them.

This app fixes that. It is built around one loop:

> **Capture → the app reads & enriches it → you review → it becomes a study card → it resurfaces at the right time.**

The "genius" is in the *enrich* step. Instead of dumb text scraping, a screenshot is read by a vision model that returns a clean, ready-to-study card: Chinese characters, pinyin with tone marks, English meaning, and an example — and it ignores the likes, comments, and app chrome. That is exactly the pipeline already used to build your starter deck (see §9).

**Languages:** Chinese ⇄ English, both directions (Chinese→English *and* English→Chinese), as you asked.

---

## 2. What you can do (feature set)

**Capture (4 ways in)**

1. **Type it** — enter a word or sentence; the app auto-fills pinyin and a dictionary gloss offline (no internet needed).
2. **Paste text** — paste Chinese from anywhere; the app segments it into words and makes a card per word or one card for the phrase.
3. **Upload a screenshot** — drop in an image; it's read automatically into one or more draft cards for you to confirm. This is the primary flow for your existing habit.
4. **Take a photo** — on the phone, use the camera to snap a sign, menu, or book page; same pipeline as upload.

Every captured item lands in a **review-before-save** screen so you stay in control of what enters your deck.

**Study (4 modes — all the ones you chose)**

- **Flashcards with spaced repetition** — the core. Cards resurface right before you'd forget them, using a modern SRS algorithm (FSRS). Grade each card Again / Hard / Good / Easy.
- **Quizzes** — multiple-choice and type-the-answer, in both directions (see hanzi → choose/type English; see English → choose/type hanzi; hear audio → identify).
- **Browse & search library** — every card in one searchable list; filter by category/HSK level/frequency, sort, tag, mark as known/learning.
- **Audio / pronunciation** — tap any card to hear it spoken (zh-CN), with an option to slow it down.

**Helpful extras (cheap to add, high value)**

- **Frequency-aware priority** — the starter data records how often each item appeared across your screenshots; the app can surface high-frequency items first.
- **Daily goal & streak**, simple stats (cards due, reviewed, accuracy).
- **Export / import** — CSV and Anki-compatible export so you're never locked in.

---

## 3. Screens (information architecture)

```
Home / Today
 ├─ "Due today" count → Start review
 ├─ Quick-capture button (＋)  → Capture sheet (type | paste | upload | photo)
 └─ Streak + daily goal

Capture sheet
 └─ choose input → Review draft cards → Save to deck

Review (flashcards)
 └─ card front/back, audio, grade buttons (Again/Hard/Good/Easy)

Quiz
 └─ pick mode & direction → questions → score summary

Library
 └─ search bar, filters (category, HSK, frequency, status), card list → card detail/edit

Card detail
 └─ hanzi, pinyin, English, examples, audio, source image thumbnail, tags, SRS stats

Settings
 └─ extraction method (on-device vs smart API + key), voice, daily goal,
    export/import, theme, data reset
```

Keep navigation to a bottom tab bar on phone (Today · Library · Capture · Quiz · Settings) and a sidebar on desktop.

---

## 4. Recommended tech stack

Chosen for: works on phone + computer from one codebase, installable, **works offline**, keeps your data **on your device** by default, and is cheap/free to host.

| Layer | Choice | Why |
|---|---|---|
| App type | **PWA** (installable web app) | One build runs on iPhone, Android, and desktop; add-to-home-screen; offline. No app store needed. |
| Framework | **React + TypeScript** via **Vite** | Fast, standard, easy for Claude to scaffold and extend. |
| Styling | **Tailwind CSS** | Quick, consistent, mobile-first. |
| Local database | **IndexedDB via Dexie.js** | Stores all cards/reviews on-device; private and offline. |
| Spaced repetition | **ts-fsrs** (FSRS algorithm) | Modern, open-source, better scheduling than classic SM-2. |
| Pinyin (offline) | **pinyin-pro** | Generate tone-marked pinyin from any hanzi locally. |
| Dictionary (offline) | **CC-CEDICT** (bundled) + a word segmenter | Auto-fill English glosses and split sentences into words with no API. Open license. |
| Audio | **Web Speech API** (`SpeechSynthesis`, zh-CN) | Built into browsers, free, offline on many devices. Optional cloud TTS later for nicer voices. |
| Screenshot reading | **Vision LLM API** (primary) + **Tesseract.js** (offline fallback) | Smart extract returns structured cards; Tesseract is a free offline backup. See §5. |
| Hosting | **Vercel / Netlify / Cloudflare Pages** (free tier) | Static deploy; push to deploy. |
| Optional sync | **Supabase** (later) | Only if you want the same deck on multiple devices. Off by default. |

**Cost:** $0 to build, host, and run the core app. The only paid pieces are *optional*: the vision API for smart screenshot reading (a few cents per image, pay-as-you-go) and premium TTS. Everything else — storage, flashcards, quizzes, offline pinyin/dictionary, browser audio — is free.

---

## 5. The capture pipeline (the heart of the app)

```
            ┌──────────── INPUT ────────────┐
   type     paste            upload          photo (camera)
     │        │                │               │
     ▼        ▼                ▼               ▼
  text ──► segment        image ──────────► image
     │     (CC-CEDICT)        │               │
     │        │               └──► EXTRACT ◄──┘
     │        │                    (vision API → structured cards,
     │        │                     or Tesseract.js offline)
     ▼        ▼                         │
   auto pinyin + gloss  ◄───────────────┘
   (pinyin-pro + CC-CEDICT)
                     │
                     ▼
            ┌──────────────────┐
            │  REVIEW DRAFTS   │  edit hanzi / pinyin / English,
            │  (you confirm)   │  split or merge, pick category, drop junk
            └──────────────────┘
                     │ Save
                     ▼
               Card(s) in deck  →  enters SRS schedule
```

**Two extraction modes, user-selectable in Settings:**

- **Smart (recommended): Vision LLM.** Send the image to a vision model with an instruction like *"Extract only Chinese-learning content as cards: hanzi, pinyin (tone marks), English; ignore UI, likes, comments, watermarks; one card per vocabulary row."* It returns clean JSON ready for the review screen. Handles messy reels, multi-row tables, and adds pinyin/English even when the image doesn't show them. (This is the exact method used to build your 630-card starter deck.)
- **Offline fallback: Tesseract.js (`chi_sim`).** Free, no network, but rougher on stylized images and gives raw text only — the app then runs pinyin-pro + CC-CEDICT to fill pinyin and glosses.

**Always keep the human-in-the-loop review screen.** It is what keeps the deck clean and is much cheaper than trying to make extraction perfect.

---

## 6. Data model

```ts
Card {
  id: string
  hanzi: string            // 你好
  pinyin: string           // nǐ hǎo
  english: string          // hello
  examples?: { hanzi: string; pinyin: string; english: string }[]
  category?: string        // "HSK1", "food", "phrases", ...
  hskLevel?: number
  tags?: string[]
  source: "manual" | "paste" | "screenshot" | "photo" | "seed"
  sourceImage?: string     // filename/thumbnail if captured from an image
  frequency?: number       // seen-count from the starter dataset
  createdAt: number
  updatedAt: number
}

SrsState {                 // one per card (FSRS)
  cardId: string
  due: number              // next review timestamp
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: "new" | "learning" | "review" | "relearning"
  lastReview?: number
}

ReviewLog { id; cardId; rating: 1|2|3|4; reviewedAt; elapsedMs }

Deck/Collection { id; name; cardIds[] }   // optional grouping
Settings { extractionMode; apiKey?; voice; dailyGoal; theme; direction }
```

This maps 1:1 to the starter dataset columns: `hanzi, pinyin, english, category, frequency, source_files` → `Card`.

---

## 7. Spaced repetition & quizzes

- **SRS:** use **FSRS** (via `ts-fsrs`). Four-button grading (Again/Hard/Good/Easy). New cards/day and max reviews/day are configurable. Show a "due today" queue on Home.
- **Quiz generation** (built from existing cards, no extra data):
  - *Multiple choice* — hanzi → 4 English options (and reverse); distractors drawn from same category for difficulty.
  - *Typing* — type the English, or type the pinyin (tone-insensitive matching as an option).
  - *Listening* — play audio → choose/type the word.
  - *Direction toggle* — Chinese→English and English→Chinese.
- Quiz results can feed the SRS (a wrong answer schedules the card sooner).

---

## 8. Build phases (ship something usable fast)

**Phase 0 — Setup (½ day).** Vite + React + TS, Tailwind, routing, Dexie schema, PWA manifest + service worker.

**Phase 1 — MVP, usable on day one (2–3 days).**
Import the **630-card starter deck** (§9) → **Browse/search** → **Flashcards with FSRS** → **audio** via Web Speech. *At the end of this phase you can already study everything from your screenshots.*

**Phase 2 — Capture (3–4 days).**
Manual add + paste (pinyin-pro + CC-CEDICT auto-fill) → **screenshot upload → smart extract → review → save** → camera capture on phone. Settings for extraction mode + API key.

**Phase 3 — Quizzes & motivation (2–3 days).**
All quiz modes, both directions; daily goal, streak, basic stats; tags and decks.

**Phase 4 — Polish (ongoing).**
Offline hardening, CSV/Anki export & import, optional Supabase sync, optional premium TTS, themes.

---

## 9. The starter dataset (already built for you)

Your 192 screenshots are already OCR-extracted, enriched, and deduplicated into a ready-to-import deck:

- **630 unique cards** (from 834 raw extractions; duplicates from repeated video frames and overlapping reference grids were merged).
- **192/192 images accounted for; 13 correctly skipped** (a selfie, ads, and tech/dev diagrams that contained no Chinese).
- Each card has **hanzi, pinyin (tone marks), English, category, frequency, and the source screenshot(s).**
- Biggest categories: phrases (118), individual characters (91), verbs (78), HSK1 (77), food (34), time (19), adverbs (18), greetings (16), grammar (16), opposites (14).

**Files provided:**

- `Chinese_Study_Deck.xlsx` — human-friendly, for you to browse/correct (README, Vocabulary, By Category, Skipped Images).
- `chinese_vocab_dataset.csv` — flat table.
- `chinese_vocab_dataset.json` — **the app seed**; import on first launch to populate the deck.

> Tip: skim the XLSX once and fix any OCR slips you spot before importing — a 5-minute pass on 630 rows gives you a pristine deck.

---

## 10. Non-functional requirements

- **Privacy-first:** all cards and review history live on your device (IndexedDB). Nothing is uploaded unless you turn on smart extraction (sends only the image you choose) or optional sync.
- **Offline:** browse, review, quiz, type-capture, pinyin, dictionary, and browser audio all work with no connection. Only smart screenshot extraction needs internet.
- **Mobile-first, installable:** add to home screen; full-screen; camera access via the browser.
- **Resilient:** export your data anytime; import to restore.

---

## 11. Open decisions (sensible defaults already chosen)

1. **Smart vs offline extraction** — default to smart (vision API) with offline Tesseract fallback. *Decision needed only if you'd prefer zero paid APIs, in which case ship offline-only first.*
2. **Multi-device sync** — off by default (local-only). Add Supabase later only if you want phone+laptop to share one deck.
3. **Traditional characters** — a few of your screenshots were traditional. Default to simplified, with an optional toggle to show both.
4. **Premium TTS** — start with free browser voices; add cloud TTS only if the voice quality bothers you.

None of these block building. They're switches, not forks.

---

## 12. Hand-off: how to have Claude build it

Build **phase by phase**, testing each before the next. Suggested kickoff prompt:

> *"Build Phase 1 of the Chinese learning PWA described in `Chinese_App_Build_Plan.md`. Stack: Vite + React + TypeScript + Tailwind, Dexie for IndexedDB, ts-fsrs for spaced repetition. On first launch, import `chinese_vocab_dataset.json` as the starter deck. Deliver three working screens — Today (due count + start review), Library (search + filter by category/frequency), and Flashcard Review (front/back, zh-CN audio via Web Speech, Again/Hard/Good/Easy grading wired to FSRS). Make it a mobile-first installable PWA. Then stop so I can test before Phase 2 (the capture pipeline)."*

Then, for Phase 2:

> *"Add the capture pipeline from §5: manual/paste entry with pinyin-pro + CC-CEDICT auto-fill, and screenshot upload + camera that sends the image to a vision API and returns draft cards into a review-before-save screen. Put the API key and extraction-mode toggle in Settings."*

Proceed through Phases 3–4 the same way.

---

*Deliverables in this folder: this plan, plus `Chinese_Study_Deck.xlsx`, `chinese_vocab_dataset.csv`, and `chinese_vocab_dataset.json` (the app seed).*
