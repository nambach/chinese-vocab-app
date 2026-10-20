---
name: audio-to-shadowing
description: Turn a textbook lesson MP3 into the bundled lesson src/data/lessons/bai-N.json and its trimmed MP3. The textbook is the script. Whisper only places that script on the audio. Book paths, page ranges, and audio filenames live in books/*.json. Use when asked to create or regenerate a shadowing lesson from its audio and textbook pages.
---

# audio-to-shadowing

The textbook is the script. The audio only supplies timings.

- `public/audio/shadowing/bai-N.mp3` — trimmed audio the app plays.
- `src/data/lessons/bai-N.json` — format `cn-vocab-lesson` (`src/shadowing/lessonSchema.ts`): `segments` (`{id, text, pinyin, meaning, start, end, section}`) and `words` (each word linked to at most 2 segment ids).

The app bundles every `bai-*.json` (`src/data/lessons/index.ts`). The folder is chosen from the lesson number in `folderIdForBuiltinLesson`: under 16 opens in "Căn bản 1", 16 and above in "Căn bản 2". `appFolder` in the book config is that expected name. The app does not read it. Script and audio stay in the bundle. Each word's `segments` become `sources` (`{lessonId, segmentId}`) in the user's saved data. `LessonScreen` shows "Bài khóa", "Từ vựng" ("Trong câu" / "Đọc từ" from section `kewen` / `shengci`) and "Luyện tập".

## Book config

Paths, page numbers, and audio filenames are not in this skill. They live in `books/<id>.json` next to this file. Read that file before any step. If the user names a book that has no file, stop and write one from the paths they give. Do not hunt through a scan during a lesson.

| Field | Meaning |
|---|---|
| `pdf` | The scan. No text layer. |
| `pagesDir` | Rendered `p-NNN.png` for this book only. Never write into another book's folder. |
| `pageDpi` | DPI of those images. Do not mix DPIs in one folder. |
| `workDir` | `{workDir}/bai-N/` holds `asr.json`, `script.json`, `lesson.mp3`. `N` is not zero-padded. |
| `idPad` | App id. `0` → `bai-16`. `2` → `bai-01`. |
| `appFolder` | The folder name the app will use for this book's lesson numbers. Not a switch. |
| `audio.use` | Which entry of `audio.recordings` is the file to align. Change this to switch recordings. |
| `audio.recordings` | Each entry has `covers` and either `pattern` (`{n}`, `{n:02d}`) or `files` (one path per lesson). A book with one recording may use `audio.pattern` and no `use`. |
| `vocab` | Optional word list. `lessons` limits which lessons have a file. |
| `asrReady` | `true` means `asr.json` and `silences.json` already exist. Do not transcribe those lessons again. |
| `lessons.N.start/end` | PDF pages to OCR. `null` means the range is unknown: fill it from the table of contents before OCR. |
| `print` | How this book prints a section number, and the printed-page offset. |

A heading the app can see still needs the顿号 (`一、课文`), even when `print.sectionNumber` says the book puts the digit in a black box without one. Copy the characters the box prints, then add `、` so export treats it as a heading.

## Preprocess

Do this once per book, before the first lesson. The lesson pass does not render pages and does not look for the lesson in the PDF.

Must already exist:

1. `books/<id>.json` with the PDF, the audio pattern, `idPad`, `appFolder`, and a page range for every lesson you will build.
2. `{pagesDir}/p-NNN.png` for those ranges, at `pageDpi`.
3. `whisper-cli`, `ffmpeg`, and `~/.cache/whisper/ggml-large-v3.bin`.
4. So the lesson pass does not wait on Whisper: `{workDir}/bai-N/asr.json` and `silences.json`, made from the recording selected by `audio.use`. A file left over from another recording is STALE. Delete `asr.json`, `asr-source.txt` and `silences.json` for that lesson and transcribe the selected file. Do not align the old one.

```bash
python3 $S/prepare_book.py <id>          # render missing pages, print what else is missing
python3 $S/prepare_book.py <id> --check  # report only
python3 $S/prepare_book.py <id> --asr    # also transcribe each lesson that has no asr.json
```

If `asrReady` is true and a file is missing, stop. Do not re-transcribe that book. If a page range is null, fill the config from the table of contents, then run prepare again. Do not OCR the whole PDF to find it.

## Do not use the old pipeline

The old pipeline took Whisper's text as the draft and had the model correct it toward the book, then re-ran Whisper on every clip (`verify.py` without `--no-roundtrip`). That loop rewrote correct book lines (往回走 for 往回赶, 倒挺好 for 特别好) and cost a full transcription per fix. Do not write `edits-*.json`. Do not "fix" book text because ASR heard something else. Do not round-trip clips.

`build_draft.py`, `apply_edits.py` and clip round-trip stay in `scripts/` for the lessons already built (Bài 16–29). They are not part of this pipeline.

## Hard rules

1. **Book text is copied, never composed.** A 课文 line matches the printed line, character for character. You may normalise punctuation to `，。？！、` and write digits the book prints as Hanzi (`30` → 三十). Nothing else.
2. **ASR disagreement is a timing FLAG, not a text edit.** 她/他, 芳/方, 会话/绘画, a dropped 儿, digits: the book wins. Record the disagreement. Do not change the line.
3. **You cannot listen.** Never claim you did. Confidence is *machine-checked*: alignment score, silence boundaries, coverage. Say so.
4. **One lesson at a time.** Wait for the user to approve it before the next.
5. **Published lessons keep `s1…sn`.** Ids in `src/data/lessons/published-segment-ids.json` are frozen. `export_lesson.py` refuses a different id list. Which lessons used the old pipeline is a note in that book's config. Do not rebuild those unless the user asks.
6. Never edit `asr.json`. Do not run `retime.py`: it snaps edges to speech islands. `align_script.py` writes the final times.
7. Do not touch the player, UI or types. Do not commit unless asked. Do not paste a transcript into chat.

## Files

| What | Where |
|---|---|
| Book | `books/<id>.json` |
| Source MP3 | the recording selected by `audio.use` |
| Page images | `{pagesDir}/p-NNN.png` |
| Work dir | `{workDir}/bai-N/` (gitignored) |
| Vocab | `vocab` in the book config, when that lesson is listed |
| App id | `idPad` in the book config. Never write `lesson-01` or `lesson-NN`. |

Ignore `.shadowing-work/pages.json` and `.shadowing-work/textbook.txt`. The page map is the book config. Run from the app root. `S=.claude/skills/audio-to-shadowing/scripts`, `W={workDir}/bai-$N`.

## Pipeline

| Step | Who | Command | Output |
|---|---|---|---|
| 1 | script | `python3 $S/ocr_book.py --book <id> $N` | `$W/book.json` |
| 2 | you | Mark each OCR line kept or dropped. Copy Hanzi as printed. Add `meaning`. | `$W/script.json` |
| 3 | script | `python3 $S/align_script.py $W --book <id>` | `$W/segments.json` (times already final) and `$W/align.md` |
| 4 | script | `python3 $S/verify.py $W --no-roundtrip` | structure, pinyin count, coverage. No Whisper. |
| 5 | script | `python3 $S/trim_audio.py $W` | `$W/lesson.mp3`, `timemap.json` |
| 6 | script | `python3 $S/verify.py $W --cut --no-roundtrip` | the report export trusts |
| 7 | script | `python3 $S/export_lesson.py $W --lesson $N --book <id>` | see "Export" |
| 8 | script | merge, review links, publish | see "Export" |
| 9 | you | `npm test && npm run build`, then the report | |

Steps 4 and 6 must pass with 0 ERROR before export. A FLAG from alignment is a line to show the user, not a line to rewrite.

## Step 1 — `ocr_book.py`

Read the lesson's page images with macOS Vision (`zh-Hans`), on device, no network. The images and the page range come from the book config. Stop at the 练习 page; do not OCR the rest of a long range. If `p-NNN.png` is missing, stop and run `prepare_book.py`. Do not render into another book's `pagesDir`.

Write `$W/book.json`:

```json
{"pages": [185, 186], "lines": [
  {"page": 185, "text": "（一）我都做对了", "pinyin": ""}
]}
```

One visual line per row, top to bottom. Drop the watermark (`Hai Phong`, the blog URL). Keep the printed pinyin line in `pinyin` when the page has one under the Hanzi; otherwise `""`. Do not translate and do not correct characters.

## Step 2 — you write `script.json`

Read `book.json` against the page images only to fix OCR garbage (a dropped character, a merged line). If the print is unreadable, leave the OCR text and set `"uncertain": true`. Never invent a line from the audio.

```json
{"lesson": 29, "lines": [
  {"role": "heading", "section": "课文", "text": "一、课文", "pinyin": "Yī, kèwén", "meaning": "Một. Bài khóa"},
  {"role": "line", "section": "课文", "text": "你做完了没有？", "pinyin": "Nǐ zuò wán le méiyǒu?", "meaning": "Bạn làm xong chưa?"},
  {"role": "word", "section": "生词", "text": "考试", "pinyin": "kǎoshì", "meaning": "kỳ thi"}
]}
```

`role` is `heading`, `line` or `word`. `section` is `课文` or `生词` (the app mapping happens at export).

**Keep**, in spoken order, only lines the selected recording actually reads (`recordings[audio.use].covers`). That is the 课文 heading, each text title, every dialogue line, and — when the file reads them — the 生词 heading, every word read aloud, and 专名 plus each name. **Drop**: publisher intro, the lesson number and lesson title printed before 课文, 注释, 语法, 练习 and everything after it, speaker labels (玛丽：, 张东：), and stage directions in parentheses. A dialogue line that mentions the word 练习 is still dialogue. Do not put 生词 into `script.json` when the selected recording's `covers` says the file does not read them.

| Heading | text | pinyin | meaning |
|---|---|---|---|
| 课文 | `一、课文` | `Yī, kèwén` | `Một. Bài khóa` |
| Title 1 | `一、<title>` | `Yī, …` | `Bài 1: …` |
| Title 2 | `二、<title>` | `Èr, …` | `Bài 2: …` |
| 生词 | `二、生词` | `Èr, shēngcí` | `Hai. Từ mới` |
| 专名 | `专名` | `Zhuānmíng` | `Danh từ riêng` |

Headings have no final `。？！`. Some lessons have one text and no title (Bài 22). A line like `二比一。` is dialogue, not a title: it is not printed as a title. Names after 专名 are `word` rows, lowercase pinyin (`shànghǎi`), meaning is the name (`Thượng Hải`). They are not vocab words.

**Pinyin.** Use the printed pinyin when OCR captured it. Otherwise write it: tone marks, `ü`, neutral tone unmarked (`ma`, `de`, `le`). Join the syllables of one word (`xiànzài`). 一 is `yí` before a 4th tone or 个, `yì` before a 1st/2nd/3rd, `yī` when counting. 不 is `bú` before a 4th tone, `bù` otherwise, and neutral in A-不-A (`xiǎng bu xiǎng`). Do not write the 3rd-tone change (`nǐ hǎo`). Sentences start with a capital and keep `? !`. 生词 and names are lowercase with no punctuation. One syllable per Hanzi; erhua `r` counts as 儿.

**Meaning.** One natural Vietnamese sentence for a dialogue line. A short gloss for a word. Where `baiN.txt` exists, copy its meaning and pinyin grouping for that word. No grammar notes.

Split a printed sentence at `。？！` into its own `line`. One breath, one line.

## Step 3 — `align_script.py`

Place `script.json` onto `asr.json`. Do not change `text`. Do not snap to silence edges.

1. One time per Hanzi Whisper emitted (token times; skip `[_` tokens).
2. Walk the script lines in order. For each line, take the earliest window after the previous match with the lowest Hanzi CER. CER ignores punctuation and treats 她/他 and 你/您 as the same. Accept it when CER ≤ 0.34. A line of one or two characters (a 生词 reading) is placed on the immediately following window of that same length, even when Whisper heard a different character. Do not search ahead for a cleaner match: that match is usually the same word inside 练习, and every later word follows it there. A zero-length stutter between two words is skipped when it is not the word itself. A word ending in 儿 may sit on one fewer character when Whisper dropped 儿, so the next word stays intact. `一、课文` is the reading that sits just before the title. The intro also says 课文; do not use that one. A short word heard as Latin (`伊妹儿` → email) takes that Latin span and does not consume the next Hanzi.
3. **Two sentences in one stretch** (the gap between them is under 0.45 s): the cut is the midpoint between the end of the first and the start of the second. Do not look for a silence between them. There usually is none.
4. **The outside of a stretch** (the first line's start, the last line's end, and both sides of a real pause): include the speech the words sit in, then keep 0.18 s of silence beyond it, and never cross the midpoint of that pause. Whisper's own timestamp starts late, so catch up at most 0.45 s into that speech, then keep the buffer. Do not rewind to the start of a long island: the intro runs into `一、课文` as one island. Do not pull an internal cut onto a silence.
5. A line with no acceptable window is listed in `align.md` and left out of `segments.json`. Do not invent a time and do not rewrite the line. Fix the script only when the book text itself was misread; then re-run this step.
6. `segments.json` already has final `start`/`end` (copied to `speech_start`/`speech_end`). `excluded` is only the span before the first line and the span after the last, so the intro and 练习 are covered without being transcribed again. `trim_audio.py` cuts from the first segment to the last.

`align.md` is the review: lines not placed, and lines placed where Whisper disagreed. Disagreement is not a text edit.

## Steps 4–6

`verify.py --no-roundtrip` checks structure, pinyin syllable count, and coverage. A midpoint cut is in the middle of speech, so the silence check applies only to an edge that does not meet the next segment. An ERROR there means the outer buffer landed in speech: widen that one edge by hand, once, and re-run from step 4. Do not rewrite text to clear it.

`trim_audio.py` keeps one continuous span from just before the first segment to just after the last, mono 64 kbps. Then `verify.py --cut --no-roundtrip`. Export refuses any other report.

## Export

`export_lesson.py --book <id>` copies `lesson.mp3` to `public/audio/shadowing/<app id>.mp3` (`idPad` from the config) and maps `section`: a numbered heading or 专名 becomes `heading`, then `课文` → `kewen` and `生词` → `shengci`.

- Published lesson (`src/data/lessons/bai-N.json` exists): it replaces `segments` and keeps `words`. It refuses changed segment ids.
- New lesson: it writes `$W/lesson.json`. Then:

```bash
node scripts/merge-lesson.mjs --from-shengci $W/lesson.json --id <app id> \
  --vocab <vocab path, when the config lists one> \
  --out src/data/lessons/<app id>.json --report $W/merge-report.md
```

When the book has a vocab file and the audio did not read 生词, merge with the positional form (`<vocab> <lesson.json>`) so the word list stays. Readings after the 专名 heading are names, not words. Read `$W/merge-report.md` under **Một chữ — cần xác nhận**: a one-character word can match the wrong sentence. Fix that word's `segments` by hand (dialogue id, then the 生词 id, at most 2).

Ask the user for the pack version before publishing a lesson that was not already a `.txt`. The app offers a lesson only when its version is higher than `seededVersion` in that browser (`src/data/seed.ts`). Reusing a version that is already deployed means existing users are never offered the lesson. Use the current `LESSON_PACK_VERSION` only when that version has not been deployed; otherwise use current + 1. When unsure, use + 1. Then `python3 $S/publish_lesson.py --book <id> --lesson $N --version V`. A `.txt` of the same id is not a new lesson: run the same command without `--version`. It records the segment ids and does not change the pack version. Migration attaches the 课文. Do not edit `index.ts` or `published-segment-ids.json` by hand.

## Report

- Segment counts: headings, 课文, 生词, 专名. `cut_start` and MP3 length.
- PASS / FLAG / ERROR from the `--cut --no-roundtrip` report. Say the check did not listen and did not re-transcribe clips.
- Every alignment FLAG: id, book text, ASR window, CER.
- Word count, and any one-character link you changed.
- Spot-check: `npm run dev`, accept "Bài học mẫu" (or Cài đặt → "Khôi phục bài học mẫu"), open the lesson from the book's `appFolder`. Tab "Bài khóa": first, middle, shortest, last line, plus one 生词 when the audio reads 生词. Tab "Từ vựng": "Trong câu" and "Đọc từ" for two words.
