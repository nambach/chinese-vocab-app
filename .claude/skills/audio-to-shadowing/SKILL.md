---
name: audio-to-shadowing
description: Turn a Hán ngữ 2 lesson MP3 (Bài 16–30, in "CB2 - Nghe/") into a shadowing lesson file src/data/shadowing/lesson-NN.json. Transcribes Chinese locally with whisper.cpp, cuts segments on real silences, then edits text, pinyin and Vietnamese meaning, and gates the result with machine checks. Use when asked to create, regenerate, or fix shadowing data or timings for a lesson from its audio.
---

# audio-to-shadowing

Turn one lesson MP3 into `src/data/shadowing/lesson-NN.json`. Each segment is `{id, text, pinyin, meaning, start, end}`, following `shadowing-language-learning-prd.md` §13.

**You cannot listen to audio.** Do not claim you did, and do not "approve after listening". Quality comes from the machine checks in `verify.py`. Report the result as *machine-verified*. Only send FLAGs that stay ambiguous to the user, each with its `afplay` command.

## Scope and ids

| Bài | Lesson id | Audio in app | Source |
|---|---|---|---|
| 16 | `lesson-01` (keep: saved words point at it) | `audio/shadowing/bai-16.mp3` | `~/Documents/CB2 - Nghe/Bài 16 Hán ngữ 2.mp3` |
| 17–30 | `lesson-17` … `lesson-30` | `audio/shadowing/bai-N.mp3` | `~/Documents/CB2 - Nghe/Bài N Hán ngữ 2.mp3` |

- **Rule: everything audible in the app's MP3 has a script.** The file runs from the 课文 heading to the last 生词 word, so every spoken line in that span is a segment with `text`, `pinyin` and `meaning`, not only the dialogue lines.
- **Keep as segments:** the 课文 heading (一、课文), each text title (一、他在做什么呢, 二、谁教你们语法), the 生词 heading (二、生词), all 课文 lines, and every 生词 word.
- **Drop** only what is outside the file: the publisher intro, the book title/volume, the lesson number and lesson title read before the 课文 heading (第十七课 / 他在做什么呢？), and all of 练习 (练习 heading, 语音, 变调, 连读, drills…). Put each dropped span in `excluded` with a reason.
- `verify.py --cut` enforces the rule: any speech island inside the cut that is not in a kept segment is a coverage ERROR, and export refuses it.
- Steps 1–3 (transcribe, silences, draft) may run for many lessons ahead of time. From step 4 on, work **one lesson at a time**. Do not start editing the next lesson until the user approves the previous one.
- Do not touch the player, UI or types. Do not commit unless asked.

## Setup (check first, install only with permission)

```bash
command -v whisper-cli ffmpeg
ls ~/.cache/whisper/ggml-large-v3.bin
```

If anything is missing, ask the user, then:

```bash
brew install whisper-cpp ffmpeg
mkdir -p ~/.cache/whisper
curl -fL -o ~/.cache/whisper/ggml-large-v3.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin   # ~3 GB
```

The scripts need Python 3 stdlib only (no pip), plus `ffmpeg` and `whisper-cli`.

## Pipeline

Run from the app root. `S=.claude/skills/audio-to-shadowing/scripts`, `W=.shadowing-work/bai-N` (gitignored), `SRC="$HOME/Documents/CB2 - Nghe/Bài N Hán ngữ 2.mp3"`.

Before step 4, read the textbook pages for this lesson in `~/Documents/CB2 - Slides/Giáo trình Hán ngữ quyển 2.pdf` (page map: `.shadowing-work/pages.json`) and use them as the reference text. The printed pinyin may be blurry, so prefer the vocab file for pinyin.

```bash
bash $S/transcribe.sh "$SRC" $W        # 1. ASR -> $W/asr.json (~30 s per lesson)
python3 $S/silences.py "$SRC" $W       # 2. silencedetect -35dB/0.3s -> $W/silences.json (+ speech islands)
python3 $S/build_draft.py $W --lesson N   # 3. -> $W/draft.json
#   4. YOU: write $W/edits-*.json (below), then:
python3 $S/apply_edits.py $W           #    -> $W/segments.json
python3 $S/retime.py $W                # 5. padded start/end from speech_start/speech_end
python3 $S/verify.py $W                # 6. source timeline, including coverage
python3 $S/trim_audio.py $W            # 7. head+tail cut, 64kbps mono -> $W/lesson.mp3 + timemap.json
python3 $S/verify.py $W --cut          # 8. the report export trusts (no coverage check)
python3 $S/export_lesson.py $W --lesson N   # 9. lesson-NN.json + public/audio/shadowing/bai-N.mp3
npm test && npm run build              # 10.
```

Never edit `asr.json`. It is the raw evidence.

### The audio file

One file per lesson. `trim_audio.py` keeps a single continuous span of the source: it starts just before the spoken 课文 heading and stops just before 练习. The 课文 heading, the text titles, and the 生词 heading stay in the file, each as a segment with text. Nothing in the middle is cut or joined. The intro, lesson title, and 练习 are the only parts removed.

The cut starts at the first kept segment (the 课文 heading), bounded by the last excluded span before it. If a 课文 heading is still in `excluded`, it anchors on that instead; only the `reason` is checked, because the publisher intro's ASR text also contains 课文. After `trim_audio.py`, confirm `cut_start` in `timemap.json` falls just before the 课文 heading's `speech_start`, not inside the intro.

The span is encoded once to **mono 64kbps** (speech stays clear; Bài 16 is about 1.5MB). `segments.json` stays on the source timeline. `timemap.json` stores the same start/end values shifted by one offset, and those are what the app plays. Re-run `trim_audio.py` after any retime. `export_lesson.py` copies `lesson.mp3` and refuses a report that did not come from `verify.py --cut`.

### Why the timing works this way

- `transcribe.sh` runs **without `--vad`**. With VAD, whisper.cpp maps segment offsets back to the original timeline but leaves token offsets on the VAD-compressed timeline. `-mc 0` stops Whisper from repeating text into the silent "repeat after me" gaps.
- Whisper token times drift by about 0.3 s. So `build_draft.py` takes text from ASR but boundaries from **speech islands**, the non-silent spans between silences. Each draft segment has `islands`, `speech_start` and `speech_end`.
- `retime.py` pads each segment by up to 0.12 s, and by at least 0.08 s when the gap allows. Padding never crosses the midpoint of the gap to the neighbouring speech, whether that speech is kept or excluded. Always edit `speech_start`/`speech_end`, never `start`/`end` by hand, then re-run `retime.py`.

## Step 4: write `segments.json`

Start from `draft.json`. Read the whole draft first and map its sections from the audio's own headings: intro / 标题 / 课文 / 生词 / 练习. Then write:

```json
{
  "lesson": 16,
  "source": "<same as draft.json source>",
  "segments": [
    {"id": "s1", "section": "课文", "text": "…。", "pinyin": "…", "meaning": "…",
     "speech_start": 49.18, "speech_end": 51.61, "draft_ids": ["d10"]}
  ],
  "excluded": [
    {"section": "练习", "reason": "practice drill", "text": "…", "speech_start": 232.95, "speech_end": 294.1}
  ]
}
```

Don't type `segments.json` by hand. Write edit files keyed by `draft_id`, and let `apply_edits.py` build it. Every draft must be kept or excluded exactly once.

```json
{
  "excluded":       [["d1", "intro", "publisher intro"]],
  "excluded_range": [["d71", "d94", "练习", "practice drills"]],
  "keep": [
    [["d23", "d24", "d25"], "课文", "merged text, or null to keep the ASR text", "pinyin", "meaning"],
    [["d17"], "课文", "first half", "…", "…", [72.10, 73.40]],
    [["d17"], "课文", "second half", "…", "…", [74.05, 76.20]]
  ]
}
```

Split the edits into several small files (`edits-1.json` for 课文, `edits-2.json` for 生词). Long verbatim outputs can be blocked by the API content filter, so keep each write short and don't echo the whole transcript into chat. To split one draft at an island gap, give both `keep` rows the same draft id and a 6th item `[speech_start, speech_end]` (`null` in either slot means "take it from the draft"). `apply_edits.py` allows that shared draft. Pick the split at a gap listed in that draft's `islands`.

**Segments**
- One sentence, or one speaker turn, that a learner shadows in one breath. Split at a `。？！` in the middle of a segment: pick the island gap between the two parts. If no gap exists, flag it. Merge pieces of one sentence that Whisper cut apart: `speech_start` comes from the first piece and `speech_end` from the last.
- Headings are their own segments: one for the 课文 heading, one per text title, one for the 生词 heading. Do not merge a heading into the first dialogue line.
  - `text`: the book form with the spoken number in Hanzi and `、`, with no final `？` (一、课文 / 一、你常去图书馆吗 / 二、生词). ASR writes the number as "2." or "1."; `verify.py` reads a lone digit as Hanzi, so that is not a FLAG.
  - `pinyin`: `Yī, kèwén` / `Èr, shēngcí` / `Yī, nǐ cháng qù túshūguǎn ma` (capitalised, no final punctuation).
  - `meaning`: `Một. Bài khóa` / `Hai. Từ mới` / `Bài 1: <title in Vietnamese>`.
  - `section`: `课文` for the 课文 heading and text titles, `生词` for the 生词 heading.
- The lesson number and lesson title read before the 课文 heading go in `excluded` (they are outside the file).
- No speaker labels. `id` is `s1…sn` in speaking order.
- 生词: one segment per word read aloud. `text` is the word with no punctuation. `meaning` is a short gloss.

**text**
- Simplified only. Use Chinese punctuation `，。？！` and no spaces.
- Fix homophones and ASR slips. Use the vocab list for spelling only (`chữ | pinyin | nghĩa`). Don't force its words into the dialogue.
  - Bài 16–23: `src/data/lessons/bai-N.txt`
  - Bài 24–25: `~/Documents/CB2 - Slides/vocab/bai24.txt` and `bai25.txt` (same format)
  - Bài 26–30: no vocab file. Use the textbook PDF, and mark any homophone you are not sure of as a FLAG for the user.
- Write numbers and Latin words as Hanzi, the way the textbook writes them. For example, ASR "email" is 伊妹儿 if the vocab list has it. The one exception is an upper-case acronym the book prints as-is, such as `DVD`. Keep it verbatim in both `text` and `pinyin`; it does not count as a syllable.
- Restore the textbook form of erhua (儿) when the vocab list has it (聊天儿, 那儿).

**pinyin**
- Tone marks, `ü`, and neutral tone unmarked. Group syllables into words the way `bai-N.txt` does (`xiànzài`, `yìqǐ`, `shíhou`). Mark 一/不 tone sandhi as the vocab file does.
- Capitalise the first letter of a sentence and keep `? !` at the end. 生词 entries are lowercase with no punctuation.
- `verify.py` requires one syllable per Hanzi. Erhua `r` counts as 儿.

**meaning**
- One natural Vietnamese sentence, not a word-by-word gloss. No grammar notes.

## Step 6: verify loop

`verify.py` checks:
1. **Structure:** ids are `s1..sn`, Hanzi present, no traditional-only characters, no Latin letters or digits in `text`, section is 课文 or 生词, at most 2 decimals, `0 ≤ start < end ≤ duration`, no overlap.
2. **Pinyin:** valid syllables, no tone numbers, no `v`, syllable count == Hanzi count.
3. **Boundaries:** 30 ms RMS at `start` and at `end` is below the silence threshold.
4. **Round-trip:** each clip is re-cut with ffmpeg (decoded, never `-c copy`), padded with 0.3 s of silence, and run through whisper again. The check computes CER against `text`. A first or last character that is not heard means the clip is probably cut off. Extra characters that match the neighbouring segment mean it bleeds into that segment. For clips of 1–2 characters, Whisper can't tell homophones apart (跟/根, 借/戒). The check only requires the same Hanzi count, and records the homophone as a note.
5. **Coverage.** Source run: every speech island lies inside a segment or an `excluded` range, so nothing is dropped silently. `--cut` run: every speech island inside the cut lies inside a kept segment, because an excluded span in the file would play with no text.

Run `verify.py` on the source first and fix ERRORs there. Then `trim_audio.py` and `verify.py --cut`. Export reads the `--cut` report.

ERROR must be fixed. For each FLAG:
- **Real cut problem** (clipped, bleed, boundary not silent): adjust `speech_start`/`speech_end` using `islands` in `draft.json` / `silences.json`, then run `retime.py`, `trim_audio.py`, and `verify.py --cut` again.
- **Text problem** (CER high, and the heard text shows your text is wrong): fix `text`/`pinyin`.
- **ASR disagrees, but your text is right** (homophone, erhua, 伊妹儿 vs email, a single-syllable word heard as another): leave it, and list it for the user.

Repeat until only real ambiguities remain. Then run export, `npm test` and `npm run build`.

## Final report to the user

- Segment counts per section, and what was excluded (with time ranges).
- PASS / FLAG / ERROR counts. Say plainly that confidence is **machine-verified**, not listened to.
- Every remaining FLAG: id, text, reason, and `afplay .shadowing-work/bai-N/clips/sK.wav`.
- Ask the user to spot-check in the app (`npm run dev`, `#/shadow/<lesson-id>`): first, middle, shortest, and last sentence, plus a 生词 entry.
