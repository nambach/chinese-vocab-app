# Shadowing — Sentence detail dialog (copy + save words) — Implementation Plan

## Why

In `src/screens/ShadowingLesson.tsx` each sentence is one `<button>` that plays its audio range. Text cannot be selected, so a word cannot be copied or saved. Tapping a sentence must keep playing audio. Word picking therefore lives in a separate detail dialog, opened from a button that only the focused (active) sentence shows.

The goal is to save words together with the dialogue sentence they came from, so vocabulary is studied in context rather than by lesson group.

## Scope

In scope:

1. Detail button on the active sentence card.
2. Centered detail dialog: larger Hanzi, pinyin, meaning.
3. Tap characters to select a word, then **Copy** or **Lưu** (save to a collection).
4. Save form: pick a collection (or create one), fill pinyin and Vietnamese meaning, note prefilled with the sentence.
5. Store a `source` reference (lesson id + segment id) on saved words. No UI uses it yet.

Out of scope (do not build):

- Dictionary lookup or auto meaning. The app has no bundled dictionary (`docs/PLAN.md`).
- Automatic word segmentation.
- "Nghe câu" link from practice/study back to the audio. Only store `source` now.
- Underlining already-saved words in the transcript.
- Prev/next sentence navigation inside the dialog.

## Decided UX

### Detail button

- Rendered only for `index === player.activeIndex`, on the right edge of the sentence card, vertically centered.
- Icon: "expand" (two diagonal arrows pointing outward, like Feather `maximize-2`). `aria-label="Xem chi tiết câu"`, `title` the same.
- 40×40 round, `bg-white/15 text-white hover:bg-white/25` (card is `bg-teal-700` when active).
- A `<button>` cannot be nested inside the sentence `<button>`. Make the `<li>` `relative`, keep the sentence button as is, and render the detail button as an absolutely positioned sibling (`absolute right-2 top-1/2 -translate-y-1/2`). Give the active sentence button `pr-14` so text does not run under the icon.
- Move `itemRefs` from the sentence button to the `<li>` (type `HTMLLIElement`). Scroll / jump-button logic only uses `getBoundingClientRect` and `scrollBy`, so it keeps working.

### Opening the dialog

- Store the opened segment index in state (`detailIndex: number | null`). The dialog shows that sentence even if `activeIndex` changes later.
- If audio is playing, pause it. Do not auto-resume on close.
- While open, the screen keyboard shortcuts do nothing (guard at the top of the existing `onKey` handler with a ref). The dialog handles `Escape` itself to close.
- Close via backdrop tap, the ✕ button, or Escape. Focus the ✕ button on open; return focus to the detail button on close.

### Dialog layout

- `fixed inset-0 z-50 flex items-center justify-center px-3 md:px-6`, backdrop `bg-black/40`.
- Panel: `w-full max-w-2xl rounded-3xl bg-white shadow-xl flex flex-col`, height `min-h-[55dvh] max-h-[75dvh]`. Visible gap above and below; small gap left and right on phones. Not a full takeover.
- Enter animation ~120ms (opacity + scale 0.97 → 1). Add keyframes next to `jump-in` / `jump-out` in `src/index.css` (e.g. `animate-dialog-in`).
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the header title.
- Header row: small label `Câu {n}/{total}`, button **Nghe câu** (calls `player.playSegment(detailIndex)`), ✕.
- Body (scrolls with `overflow-y-auto overscroll-contain`):
  - Hanzi characters, `text-4xl leading-relaxed`, one tappable span per character (see Selection).
  - Pinyin and Vietnamese meaning always shown in the dialog, ignoring the list's Pinyin/Nghĩa toggles (this is the study view).
- Footer (sticky bottom of the panel):
  - No selection: hint `Chạm từng chữ để chọn từ, chạm lại chữ ở đầu hoặc cuối để bỏ` + secondary button **Copy cả câu**.
  - With selection: the selected text in large Hanzi, buttons **Copy**, **Lưu** (bookmark icon), **Bỏ chọn**.
- After Copy, the button label shows `Đã copy` for ~1.5s.

### Selection rules

Characters come from `Array.from(segment.text)` (code points). Punctuation and whitespace (`/[\p{P}\s]/u`) render as plain text and are not tappable.

State: `{ start: number; end: number } | null` (inclusive indices into the character array).

Tapping grows the range, so tapping characters one by one and tapping first-then-last both give the expected word. No hover or drag (does not work on phones; most words are 1–2 characters).

- No selection, tap `i` → `{ start: i, end: i }`.
- Tap `i` outside the range → grow it to include `i` (characters in between are selected too).
- Tap the only selected character → clear.
- Tap the start or end of a longer range → drop that character (skipping punctuation).
- Tap a character strictly inside the range → new `{ start: i, end: i }`.
- To pick a different word elsewhere, use **Bỏ chọn** first.

Selected text = characters `start..end` joined, with leading/trailing punctuation and whitespace trimmed (inner punctuation kept). Highlight selected chars with `bg-amber-200 text-teal-950 rounded`.

### Simplified / traditional

- Display uses the user's variant. Convert the whole sentence once with `useHanziVariant(variant, segment.text)` (`src/lib/traditional`), then `Array.from` it. If the converted length differs from the simplified length, fall back to simplified characters for display.
- Apply the font with `style={{ fontFamily: 'var(--hanzi-font, inherit)' }}`, same as `Hanzi.tsx`.
- **Copy** copies the displayed variant. **Lưu** always stores simplified (stored words are always simplified, see `Settings.hanziVariant` comment).

### Save form

Tapping **Lưu** replaces the dialog body with a save step (same panel, no second dialog):

1. `Select` (from `src/components/ui.tsx`) labeled `Lưu vào bộ`, options = all catalogs by name plus a last option `+ Tạo bộ mới…` (value `__new__`).
   - Default: `settings.shadowSaveCatalogId` if that catalog still exists, else the first catalog, else `__new__`.
   - When `__new__`: show a text input `Tên bộ mới`, default `Từ trong hội thoại`.
2. If the chosen catalog already has a word with the same `hanzi`, show a hint `Bộ này đã có 「X」`. Still allow saving (a different context can be useful).
3. `WordCard` (`src/components/WordCard.tsx`) with draft:
   - `hanzi`: selected simplified text
   - `pinyin`: empty (per-word pinyin is not in the lesson data)
   - `meaning`: empty
   - `note`: `buildContextNote(segment)` → `"{text} — {meaning}"`, or just `text` when the segment has no meaning
   - `saveLabel="Lưu từ"`, `toneNumberInput={state.settings.toneNumberInput}`, `onCancel` returns to the sentence view keeping the selection.
   - `WordCard` already requires hanzi, pinyin and meaning before saving.
4. On save:
   - If `__new__`, `const catalog = addCatalog(name)` and use its id (synchronous, returns the catalog).
   - `addWord(catalogId, { ...draft, source: { lessonId: lesson.id, segmentId: segment.id } })`.
   - `patchSettings({ shadowSaveCatalogId: catalogId })`.
   - Return to the sentence view, clear the selection, show `Đã lưu vào {catalog name}` in the footer for ~2s.

## Code changes

### Types and store

- `src/models/types.ts`
  - Add `export type WordSource = { lessonId: string; segmentId: string }`.
  - `Word` and `WordDraft`: add `source?: WordSource`.
  - `Settings`: add `shadowSaveCatalogId: string | null` (doc comment: last collection used when saving a word from shadowing). Default `null` in `defaultSettings()`. No schema bump (settings are merged with defaults on load).
- `src/data/store.ts` `createWord`: keep `source` when present (`...(input.source ? { source: input.source } : {})`). `updateWordInCatalog` callers already spread `...word`, so edits keep it.

### Pure logic + tests

New `src/shadowing/selection.ts`:

- `type CharCell = { char: string; selectable: boolean }`
- `splitSentence(text: string): CharCell[]`
- `type CharSelection = { start: number; end: number } | null`
- `nextSelection(current: CharSelection, index: number, cells: CharCell[]): CharSelection` (rules above)
- `selectedText(chars: string[], selection: CharSelection): string` (trim edge punctuation/whitespace)
- `buildContextNote(segment: Pick<ShadowingSegment, 'text' | 'meaning'>): string`

New `src/shadowing/selection.test.ts` covering every selection rule, punctuation detection, edge trimming, note with and without meaning.

Add a store test that `createWord` keeps `source` and omits it when absent (put it next to existing store tests if there are any, otherwise a new `src/data/store.test.ts`).

### Clipboard helper

New `src/lib/clipboard.ts`: `copyText(text: string): Promise<boolean>`. Use `navigator.clipboard.writeText`; on failure or when unavailable, fall back to a hidden `<textarea>` + `document.execCommand('copy')`. Return whether it worked. On failure show `Không copy được`.

### Player hook

`src/shadowing/useShadowingPlayer.ts`: expose `pause()` (calls `player.pause()` if a player exists). Do not change other behavior.

### Dialog component

New `src/components/SentenceDetailDialog.tsx`. Props:

```ts
{
  lessonId: string
  segment: ShadowingSegment
  index: number
  total: number
  onClose: () => void
  onPlay: () => void
}
```

Gets `state`, `addCatalog`, `addWord`, `patchSettings` from `useApp()`. Owns selection state, the sentence/save step, and copy/save feedback. Renders the overlay itself (do not reuse `Dialog` from `ui.tsx`, it is `max-w-sm` and content-sized). Add a local `ExpandIcon` / `BookmarkIcon` as inline SVG like the icons at the bottom of `ShadowingLesson.tsx`.

### Screen

`src/screens/ShadowingLesson.tsx`:

- `detailIndex` state + `detailOpenRef` for the keyboard guard.
- Detail button on the active card (see Detail button). On click: `player.pause()` if playing, `setDetailIndex(index)`.
- Render `<SentenceDetailDialog>` when `detailIndex !== null`.

## Verify

1. `npm test` and `npm run build` pass (`tsc -b` with `noUnusedLocals`).
2. Browser, desktop and phone emulation (390×844, touch), at `http://localhost:5173/#/shadow/lesson-01`:
   - Detail button appears only on the active sentence and follows it during playback.
   - Tapping a sentence still plays its range; tapping the detail button does not.
   - Dialog is centered with visible gaps, not full screen; Escape / backdrop / ✕ close it; shortcuts do nothing while it is open.
   - Opening pauses playing audio; the dialog keeps its sentence when the active sentence changes.
   - Selection rules behave as listed; punctuation is not tappable.
   - Copy puts the selected text on the clipboard; `Đã copy` shows.
   - Save into an existing collection and into a new one. The word appears in that collection with the sentence in its note, and shows the note on Study.
   - With the traditional variant on, the dialog shows traditional characters but the saved word is simplified.
   - The last used collection is preselected next time.
3. Clear any device emulation afterwards.

Do not commit unless asked.
