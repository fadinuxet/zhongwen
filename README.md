# 学中文 · Chinese Study (PWA)

A personal, offline-first Chinese learning app. Phase 1 turns your 630-card
starter deck into a spaced-repetition study tool that runs on phone and desktop.

## Run it

```bash
npm install      # already done
npm run dev      # http://localhost:5173  — develop
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

Open in a browser, then **Add to Home Screen** (mobile) or install from the
address bar (desktop) to use it like a native app, fully offline.

## What's in Phase 1

- **Today** — due-today count, "Start review", daily-goal progress, streak, deck stats.
- **Library** — two views via a Cards/List toggle:
  - **Cards** (default): a responsive grid of tap-to-flip flashcards (hanzi → pinyin/English),
    with **Reveal all** for a self-quiz sweep and **Shuffle**; category-colored dots and a
    frequency meter on each card.
  - **List**: compact rows. Both views share search (hanzi / pinyin / English), category
    filter, and sort (frequency / A–Z / due). Tap any card for full details, audio, suspend, reset.
- **Review** — flashcards scheduled by **FSRS** (`ts-fsrs`): flip, hear the hanzi
  (Web Speech, zh-CN), grade Again / Hard / Good / Easy with live interval previews.
  Keyboard: `space` flips, `1–4` grades.
- **Add (Capture)** — three ways to grow your deck, all free & offline, then a shared
  review-before-save tray (edit meanings, drop junk, dedupes against your deck):
  - **Type** — type English → ranked Chinese matches; or paste Chinese → auto-split into words.
  - **Screenshot** — pick an image; on-device OCR (Tesseract.js) reads the Chinese into words.
  - **Camera** — point at objects; on-device detection (TensorFlow.js COCO-SSD, ~80 classes)
    labels them in Chinese; tap to add.
- **Quiz** — self-test across the deck: **Multiple choice**, **Typing** (lenient,
  tone/case-insensitive checking), and **Listening** (hear it → choose). Direction
  toggle (汉字→English / English→汉字 or pinyin), scope by category, 10/20/30 questions,
  score + missed-word recap. (`src/lib/quiz.ts`)
- **Settings** — review direction (hanzi-first or English-first), new-cards/day,
  daily goal, voice + speed, deck export (JSON), reset & re-seed.

Each card also shows an auto-derived **illustration** (colorful
[OpenMoji](https://openmoji.org) drawings, CC BY-SA 4.0, mapped by meaning/category
in `src/data/artMap.json` → `src/lib/wordArt.ts`, bundled under `public/openmoji/`),
**pinyin**, and a generated **example sentence** (`src/lib/enrich.ts`). The drawings
also appear in the Quiz (shown only when they won't give away the answer).

## How it's built

| Concern        | Choice |
|----------------|--------|
| Framework      | React 19 + TypeScript + Vite 6 |
| Styling        | Tailwind CSS v4 |
| Local storage  | IndexedDB via Dexie (`src/db/db.ts`) — all data stays on device |
| Scheduling     | FSRS via `ts-fsrs` (`src/lib/fsrs.ts`, `src/lib/queue.ts`) |
| Audio          | Web Speech API (`src/lib/speech.ts`) |
| Pinyin         | `pinyin-pro` (offline, tone-marked) |
| Dictionary     | Compacted **CC-CEDICT** at `public/cedict.json` (~114k entries, 6 MB), lazy-loaded + SW-cached (`src/lib/dict.ts`) |
| OCR            | `tesseract.js` (`chi_sim`), dynamically imported on first use |
| Object detect  | `@tensorflow-models/coco-ssd` on `@tensorflow/tfjs`, dynamically imported |
| Installable    | `vite-plugin-pwa` (offline service worker + manifest) |

The starter deck is bundled at `src/data/seed.json` (copied from
`chinese_vocab_dataset.json`) and imported into IndexedDB on first launch. The
OCR and object-detection models download from a CDN on first use, then cache.

## Next (per Chinese_App_Build_Plan.md)

- **Phase 4 — Polish:** Anki/CSV import, optional sync, premium TTS, themes,
  streak/daily-goal tie-ins, optionally feed quiz results into FSRS.
- **Optional AI upgrade:** a vision-LLM toggle for arbitrary-object detection and
  clean extraction from messy screenshots (your own API key) — the free/offline
  paths above stay the default.
