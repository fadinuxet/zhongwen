<div align="center">

# 学中文 · Chinese Study

**Turn the Chinese you meet in the wild into the curriculum that teaches you Chinese.**

A personal, offline‑first learning PWA. Capture real Chinese — a reel, a sign, a menu, a
message — and it becomes a flashcard, a quiz, a pronunciation rep, a reading you can finally
parse, and a measure of how much of *your* world you can now read.

[**▶ Live app**](https://zhongwen-production.up.railway.app) · React 19 + TypeScript + Vite · 100% on‑device · installable

</div>

---

## The idea

Most apps hand you a fixed syllabus. The best learners do the opposite: they collect the
language they actually run into and revisit it. This app is built around that loop —

> **Capture → enrich → review → it resurfaces at the right time → you read it in the wild → repeat.**

Everything stays **on your device** (IndexedDB). It works **offline**. It installs to your home
screen. There's no account, no server, no tracking.

---

## What makes it different

Plenty of apps do flashcards and quizzes. These features exist because the app holds something
no one else has: **a personal, frequency‑weighted corpus of the Chinese *you* encounter.**

| | Feature | Why it's unique |
|---|---|---|
| 🌿 | **Seen‑in‑the‑wild reviews** | Re‑capturing a word you're learning counts as a real review — seeing 上 on a sign *is* a repetition, so it strengthens the card and pushes back its due date. The capture pipeline feeds FSRS. |
| 📖 | **Sentences you can read** | Your captured phrases stay locked until you know every character in them, then unlock as comprehensible input — an i+1 graded reader generated from your own content. |
| 📊 | **% of your world readable** | A progress meter weighted by how often each word appears in *your* captures: "You can read 73% of the Chinese in your feed." Tied to reality, not card counts. |
| 🎯 | **Next‑best‑word optimizer** | Ranks the words you haven't learned by how many locked sentences each would unlock × how often you see them — the shortest path to reading your own world, with a one‑tap focused review. |
| 🧠 | **Memory dashboard + confusion radar** | Visualizes your whole deck's retrievability (from FSRS) decaying in real time, surfaces what's fading, and logs the exact tones and words *you* keep mixing up. |

---

## Feature tour

The app is five tabs: **Today · Library · Add · Practice · Settings.**

### Today
Due‑today count and one‑tap review, daily‑goal ring, streak, the **% of your world** you can
read, your **best words to learn next**, and a link into your **memory** dashboard.

### Library — your deck, two ways
- **Cards** — a responsive grid of tap‑to‑flip flashcards (illustration · hanzi · pinyin →
  meaning · example), with **Reveal all** for a self‑quiz sweep and **Shuffle**.
- **List** — compact rows.
- Both share live **search** (hanzi / pinyin / English), **category** filter, and **sort**
  (most‑seen / A–Z / due). Tap any card for the detail sheet: audio, example sentence,
  **character component breakdown**, source screenshots, suspend / reset.

### Add — capture from real life
A shared **review‑before‑save** tray sits under every method (edit meanings, drop junk; it
dedupes against your deck and records re‑encounters as wild reviews).
- **Type** — English → ranked Chinese matches, or paste Chinese → auto‑segmented into words
  (offline CC‑CEDICT + pinyin).
- **Screenshot** — drop an image; on‑device OCR reads the Chinese into words.
- **Camera → Read text** — point at a sign/menu; OCR'd words come back **colored by what you
  know** (green = known, red = new), tap to add or hear.
- **Camera → Objects** — point at things; on‑device detection labels ~80 everyday objects in
  Chinese.

### Practice — every skill, not just recognition
| Mode | Skill | How |
|---|---|---|
| **Quiz** | recall | Multiple choice · typing (tone/case‑lenient) · listening, both directions |
| **Pronunciation** | speaking | Say the word; speech recognition checks how close you got |
| **Shadowing** | fluency | Hear a sentence, repeat it, get a character‑match score |
| **Tone trainer** | listening | Hear a syllable → identify the tone, with visual pitch contours |
| **Sentences you can read** | reading | Your unlocked phrases, as comprehensible input |

### Every card is enriched
A colorful **illustration**, accurate **pinyin**, a generated **example sentence**, and a
**"built from"** character‑component breakdown with auto‑mnemonics (好 = 女 woman + 子 child).

---

## How it's built

| Concern | Choice |
|---|---|
| Framework | **React 19 + TypeScript + Vite 6** |
| Styling | **Tailwind CSS v4** |
| Storage | **IndexedDB** via Dexie — everything stays on device (`src/db/db.ts`) |
| Scheduling | **FSRS** via `ts-fsrs` — modern spaced repetition (`src/lib/fsrs.ts`, `queue.ts`) |
| Pinyin | `pinyin-pro` — offline, tone‑marked |
| Dictionary | Compacted **CC‑CEDICT** (~114k entries) — segmentation + glosses, lazy‑loaded |
| Audio | **Web Speech API** — synthesis (zh‑CN) and recognition |
| OCR | `tesseract.js` (`chi_sim`) — dynamically imported |
| Object detection | `@tensorflow-models/coco-ssd` on TF.js — dynamically imported |
| Illustrations | **OpenMoji** — 148 hand‑drawn SVGs, mapped by meaning |
| Components | **makemeahanzi** decomposition (9.5k characters) |
| Installable | `vite-plugin-pwa` — offline service worker + manifest |

**On‑device & offline by design.** The 630‑card starter deck, dictionary, illustrations, and
component data are all bundled or lazy‑loaded and Service‑Worker‑cached. Only the OCR/detection
models (first use) and speech recognition need the network — everything else works on a plane.

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 — develop
npm run build      # type-check + production build → dist/
npm run preview    # serve the production build locally
```

Open in a browser, then **Add to Home Screen** (mobile) or install from the address bar
(desktop) to run it like a native app.

---

## Deployment

Deployed on **Railway** as a static SPA — `npm run build` then `serve -s dist` (the `-s` gives
client‑side‑routing fallback so deep links don't 404). `npm start` runs that locally too.

```bash
railway up         # build + deploy from the CLI
```

---

## Project structure

```
src/
├─ pages/                 Today · Library · Capture · Practice · Settings · Stats · Review
│  ├─ capture/            Type · Screenshot · Camera (objects) · CameraText (read)
│  └─ practice/           Quiz lives at top level; Pronounce · Tones · Shadow · Reading
├─ components/            FlipCard · CardSheet · WordArt · DraftTray · Layout · Icons
├─ lib/
│  ├─ fsrs · queue        spaced repetition + the daily queue
│  ├─ dict · reading      CC-CEDICT, segmentation, readability + "% of your world"
│  ├─ optimizer           next-best-word leverage ranking
│  ├─ memory              FSRS retrievability, heatmap, confusion radar
│  ├─ speech · speechRecognition · shadow · tones · quiz
│  ├─ enrich · wordArt · decomp     example sentences, OpenMoji, components
│  └─ capture · seed · settings
├─ db/db.ts               Dexie schema (cards · reviews · confusions · meta)
└─ data/seed.json         the 630-card starter deck
public/
├─ cedict.json            compacted CC-CEDICT
├─ decomp.json            character decompositions
└─ openmoji/              illustration SVGs
```

---

## Data & credits

This project bundles a few wonderful open datasets — please keep their attribution:

- **[CC‑CEDICT](https://cc-cedict.org/)** — Chinese↔English dictionary · CC BY‑SA
- **[OpenMoji](https://openmoji.org)** — the illustrations · CC BY‑SA 4.0
- **[Make Me a Hanzi](https://github.com/skishore/makemeahanzi)** — character decompositions · LGPL / Arphic
- **[ts‑fsrs](https://github.com/open-spaced-repetition/ts-fsrs)** · **[pinyin‑pro](https://github.com/zh-lx/pinyin-pro)** · **[Tesseract.js](https://tesseract.projectnaptha.com/)** · **[TensorFlow.js](https://www.tensorflow.org/js)**

The 630‑card starter deck was built from a personal collection of screenshots — OCR‑extracted,
enriched with pinyin/English, and deduplicated.

---

<div align="center">

*A personal project. Your data never leaves your device.*

</div>
