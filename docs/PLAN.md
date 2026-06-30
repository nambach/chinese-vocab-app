# Chinese Vocabulary Practice App — Implementation Plan

A mobile-first frontend web app for practicing Chinese vocabulary. All data is
persisted locally on the device via `localStorage`. No backend.

---

## 1. Goals & Scope

- Mobile-first, simple UI. Practice screens should feel **large and game-like**.
- Fully local: every catalog and word is stored in `localStorage`.
- Users create multiple **catalogs** ("Bộ sưu tập"), each holding a set of words.
- Each **word** has: **Hanzi**, **Pinyin**, **Vietnamese meaning**.
- Practice a catalog by walking through its words with multiple translation
  directions and configurable modes.
- Convenient word entry: a large, one-word-at-a-time "guided add" flow that
  mirrors the practice UI, plus a list view to manage (edit/delete/reorder) words.
- Import a catalog from a simple `.txt` file; export a catalog back to `.txt`.

### Out of scope (explicitly dropped)
- No in-app Hanzi conversion / smart Hanzi input. When an answer is Hanzi, the
  user types it with their **own OS Chinese (Pinyin) keyboard** into a plain field.
- No bundled pinyin→Hanzi dictionary.

---

## 2. Smart Input — Feasibility Notes

### a) Typing Hanzi
- A web app **cannot** install or invoke a system IME. Instead we render a plain
  text field tuned for IME use (`lang="zh"`, autocorrect/autocapitalize off).
- The user relies on their **device's Chinese Pinyin keyboard** to produce Hanzi.
  Works on iOS and Android with zero extra code.

### b) Typing Pinyin tones as numbers (`ni3` → `nǐ`, `hao3` → `hǎo`) — **the one smart feature**
- Fully feasible as a small pure function. Tone-placement rules:
  - If the syllable contains `a` or `e`, the mark goes there.
  - In `ou`, the mark goes on `o`.
  - Otherwise the mark goes on the last vowel.
  - Numbers `1–4` → tone marks; `5`/`0` → neutral (no mark).
- Conversion runs live as the user types, toggleable on/off.

---

## 3. Tech Stack

- **React + TypeScript + Vite** — fast dev, small mobile build.
- **PWA** — installable to home screen, offline-capable, app-like feel.
- **Tailwind CSS** — mobile-first styling, large touch targets.
- **localStorage** — persistence (small footprint, well within limits).
- Minimal view-state switch for navigation (or `react-router` if URLs are wanted).

---

## 4. Data Model (persisted in `localStorage`)

```ts
type Word = {
  id: string;
  hanzi: string;
  pinyin: string;     // canonical, stored WITH tone marks (e.g. "nǐ hǎo")
  meaning: string;    // Vietnamese
};

type Catalog = {      // "Bộ sưu tập"
  id: string;
  name: string;
  words: Word[];      // order controls "sequential" practice
  createdAt: number;
  updatedAt: number;
};

type Settings = {
  toneNumberInput: boolean;   // enable ni3 -> nǐ helper
  // extensible: future flags live here
};

type AppState = {
  version: number;            // schema version for migrations
  catalogs: Catalog[];
  settings: Settings;
};
```

- Stored under a single key, e.g. `cn-vocab:v1`.
- `version` field enables forward-compatible migrations.

---

## 5. Extensible Practice Engine (key architecture)

Two orthogonal, composable axes so new options drop in without rewrites.

### Translation direction (`QuizDirection`)
A registry where each direction declares its prompt field, answer field, and
answer checker:
- `hanzi → pinyin`
- `pinyin → hanzi`
- `hanzi → vn`
- `pinyin → vn`
- (easily extended, e.g. `vn → hanzi`)

All answers are **typed**: pinyin/VN via the normal keyboard, Hanzi via the OS
Chinese keyboard.

### Session modifiers (plugin-style, composable)
- **Ordering strategy** (`OrderStrategy`): `sequential` | `random`.
- **Timing strategy** (`TimerStrategy`): `untimed` | `timed-per-word` | `timed-session`.
- **Future (designed-for, not built now):** spaced repetition, "wrong-answers-only",
  multiple choice, audio prompts.

### Session object
`PracticeSession({ catalog, direction, orderStrategy, timerStrategy })` exposes:
`next()`, `submit(answer)`, `score`, `progress`. New modes = new strategy
implementations registered in a map; UI core unchanged.

### Answer checking
- Normalize before compare: trim, lowercase, collapse spaces.
- **Pinyin:** accept tone-mark form **and** tone-number form (convert input to
  canonical first).
- **Hanzi:** direct compare after normalization.
- **VN:** lenient; accept multiple meanings separated by `/` or `,`.

---

## 6. Screens (mobile-first, large & game-like)

1. **Home** — list of catalogs as cards; create new; import; per-catalog menu
   (practice / manage words / export / delete).
2. **Catalog screen** — entry points to **+ Thêm từ** (guided add) and the
   **manage list**, plus a "Practice" button.
3. **Guided add ("Thêm từ")** — large one-word-at-a-time card:
   - Stacked fields: **Hanzi** (OS keyboard), **Pinyin** (tone-number smart input),
     **Nghĩa tiếng Việt**.
   - Buttons: **Lưu & tiếp** (save + clear for next), **Xong**. Live added-count.
4. **Manage list** — scrollable list (Hanzi · pinyin · meaning); per-word edit
   (opens big card prefilled), delete (confirm), drag-to-reorder; search/filter.
5. **Practice setup** — pick direction + ordering + timing via big toggle buttons.
6. **Practice play** — one big centered card: large prompt, large input, progress
   bar/timer, immediate ✓/✗ feedback with correct answer, **Next**.
7. **Results** — score, time, list of missed words, "retry wrong only" (hook for
   future mode).

The **big-card form** (`WordCard`) is shared by guided add and edit.

---

## 7. TXT Import / Export Format

Human-writable so casual users can build catalogs by hand.

```
# Catalog name (optional, first line starting with #)
你好 | nǐ hǎo | xin chào
谢谢 | xiè xiè | cảm ơn
学习 | xué xí | học tập
```

- Delimiter `|` (forgiving: also accept tab or 2+ spaces). One word per line.
- Blank lines and `#` comments are ignored.
- **Import:** also accept pinyin with tone numbers (`ni3 hao3`) → auto-convert to
  tone marks.
- **Export:** regenerate this exact format; trigger a file download
  (`Blob` + `<a download>`).
- An on-screen "format guide" is shown in the import/export UI.

---

## 8. File / Folder Structure

```
src/
  data/store.ts            # load/save localStorage, migrations
  models/types.ts
  lib/pinyin.ts            # tone-number <-> tone-mark conversion
  lib/txt.ts               # import/export parsing + serialization
  practice/
    directions.ts          # direction registry
    orderStrategies.ts
    timerStrategies.ts
    session.ts             # PracticeSession engine
  components/
    SmartInput.tsx         # tone-number pinyin input (only smart feature)
    WordCard.tsx           # shared big-card form (guided add + edit)
    WordList.tsx           # manage view
  screens/
    Home.tsx
    Catalog.tsx
    GuidedAdd.tsx
    PracticeSetup.tsx
    PracticePlay.tsx
    Results.tsx
  App.tsx
```

---

## 9. Implementation Phases

1. **Foundations** — Vite + TS + Tailwind + PWA setup; data model; localStorage store.
2. **Catalogs CRUD** — Home list + Catalog screen.
3. **Pinyin lib** — tone-number ↔ tone-mark converter + tests.
4. **Word entry** — `WordCard` + guided add flow + manage list (edit/delete/reorder/search).
5. **Practice engine** — directions, ordering, timing strategies, session.
6. **Practice UI** — setup + play + results; `SmartInput` tone-number mode.
7. **Import / Export** — txt parser/serializer + format-guide UI.
8. **Polish** — PWA install, mobile spacing, animations, edge cases.

---

## 10. Default Product Decisions

- **UI language:** Vietnamese labels (meanings are Vietnamese; e.g. "Bộ sưu tập").
- Pinyin stored canonically **with tone marks**; tone numbers are an input convenience.
- Answer checking is **lenient** (case/space-insensitive; pinyin accepts tone
  numbers or marks; VN accepts multiple meanings).
- **iOS Safari** is the primary PWA target.
- Hanzi typing is delegated entirely to the user's **OS Chinese keyboard**.
