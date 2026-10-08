#!/usr/bin/env python3
"""Usage: verify.py WORK_DIR [--no-roundtrip] [--cut]

Machine checks for WORK_DIR/segments.json. Writes WORK_DIR/report.md and report.json,
plus WORK_DIR/clips/<id>.wav (exact cut, for `afplay`). Exit code 1 if any ERROR.

ERROR = must fix (structure, pinyin, coverage). FLAG = suspicious, fix or send to the user.

--cut checks the trimmed lesson.mp3 (timemap.json times) instead of the source.
Coverage there is stricter: every speech island inside the cut must be in a kept
segment. Excluded ranges do not count, because they would play with no text.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

from shadowing_lib import (
    WHISPER_MODEL, WHISPER_PROMPT, cer, coverage_gaps, han_chars, has_han, is_traditional_only,
    load_json, pinyin_matches_han, pinyin_problems, probe_duration, read_pcm, rms_db, save_json,
    strip_hallucinations, to_simplified,
)
from trim_audio import apply_timemap

SECTIONS = {'课文', '生词'}
BOUNDARY_WINDOW = 0.03
CER_FLAG = 0.15


def check_structure(segments: list[dict], duration: float) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    prev_end = 0.0
    for n, seg in enumerate(segments, 1):
        sid = seg.get('id', f'#{n}')
        errs = errors.setdefault(sid, [])
        if sid != f's{n}':
            errs.append(f'id should be s{n}')
        text = seg.get('text', '')
        if not text.strip() or not has_han(text):
            errs.append('text has no Hanzi')
        trad = ''.join(c for c in text if is_traditional_only(c))
        if trad:
            errs.append(f'traditional chars in text: {trad}')
        if re.search(r'[0-9]', text) or re.search(r'[A-Za-z]', re.sub(r'[A-Z]{2,}', '', text)):
            errs.append('digits or non-acronym latin letters in text')
        if seg.get('section') not in SECTIONS:
            errs.append(f"section must be one of {sorted(SECTIONS)}")
        pinyin = seg.get('pinyin', '')
        if not pinyin.strip():
            errs.append('pinyin is empty')
        else:
            errs.extend(pinyin_problems(pinyin, text))
            if not pinyin_matches_han(pinyin, text):
                errs.append(f'pinyin syllables != {len(han_chars(text))} Hanzi')
        if not seg.get('meaning', '').strip():
            errs.append('meaning is empty')
        start, end = seg.get('start'), seg.get('end')
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            errs.append('start/end missing')
            continue
        if round(start, 2) != start or round(end, 2) != end:
            errs.append('start/end must have at most 2 decimals')
        if not (0 <= start < end <= duration):
            errs.append(f'range must satisfy 0 <= start < end <= {duration}')
        if start < prev_end:
            errs.append('overlaps previous segment')
        prev_end = end
    return errors


def check_boundaries(segments: list[dict], samples, noise_db: float) -> dict[str, list[str]]:
    flags: dict[str, list[str]] = {}
    for seg in segments:
        out = flags.setdefault(seg['id'], [])
        head = rms_db(samples, seg['start'], seg['start'] + BOUNDARY_WINDOW)
        tail = rms_db(samples, seg['end'] - BOUNDARY_WINDOW, seg['end'])
        if head > noise_db:
            out.append(f'start not in silence ({head:.0f} dBFS)')
        if tail > noise_db:
            out.append(f'end not in silence ({tail:.0f} dBFS)')
    return flags


def cut_clips(segments: list[dict], source: Path, work: Path) -> list[Path]:
    clips, rt = work / 'clips', work / 'roundtrip'
    for d in (clips, rt):
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir()
    rt_files = []
    for seg in segments:
        span = ['-ss', f"{seg['start']:.2f}", '-to', f"{seg['end']:.2f}", '-i', str(source), '-vn']
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *span, str(clips / f"{seg['id']}.wav")], check=True)
        target = rt / f"{seg['id']}.wav"
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *span, '-af', 'adelay=300:all=1,apad=pad_dur=0.3',
                        '-ar', '16000', '-ac', '1', str(target)], check=True)
        rt_files.append(target)
    return rt_files


def transcribe_clips(files: list[Path]) -> dict[str, str]:
    for old in files:
        old.with_name(old.name + '.json').unlink(missing_ok=True)
    subprocess.run(['whisper-cli', '-m', str(WHISPER_MODEL), '-l', 'zh', '--prompt', WHISPER_PROMPT,
                    '-mc', '0', '-oj', '-np', *map(str, files)],
                   check=True, capture_output=True)
    out = {}
    for f in files:
        data = load_json(f.with_name(f.name + '.json'))
        text = ''.join(s['text'] for s in data['transcription'])
        out[f.stem] = to_simplified(strip_hallucinations(text))[0].strip()
    return out


HAN_DIGITS = '〇一二三四五六七八九'


def lone_digits_to_han(heard: str) -> str:
    """Whisper writes a spoken heading number as "2." where the book prints 二、."""
    return re.sub(r'(?<!\d)\d(?!\d)', lambda m: HAN_DIGITS[int(m.group(0))], heard)


def roundtrip_flags(seg: dict, heard: str, next_text: str, prev_text: str) -> tuple[float, list[str]]:
    heard = lone_digits_to_han(heard)
    ref, hyp = han_chars(seg['text']), han_chars(heard)
    score = cer(seg['text'], heard)
    flags = []
    if len(ref) <= 2:
        # Whisper cannot tell homophones apart without context (跟/根, 借/戒). For a lone word the
        # round-trip only proves the clip holds the whole word: same Hanzi count, nothing extra.
        if len(hyp) != len(ref):
            flags.append(f'short clip heard as "{heard}" ({len(hyp)} chars, expected {len(ref)})')
        return score, flags
    if score > CER_FLAG:
        flags.append(f'round-trip CER {score:.2f}, heard "{heard}"')
    if ref in hyp:
        lead, trail = hyp[:hyp.index(ref)], hyp[hyp.index(ref) + len(ref):]
        if lead:
            hint = ' (tail of previous segment?)' if han_chars(prev_text).endswith(lead) else ''
            flags.append(f'extra speech before: "{lead}"{hint}')
        if trail:
            hint = ' (start of next segment?)' if han_chars(next_text).startswith(trail) else ''
            flags.append(f'extra speech after: "{trail}"{hint}')
    else:
        if hyp and ref[0] not in hyp[:2]:
            flags.append(f'first char "{ref[0]}" not heard (clipped start?)')
        if hyp and ref[-1] not in hyp[-2:]:
            flags.append(f'last char "{ref[-1]}" not heard (clipped end?)')
    return score, flags


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    parser.add_argument('--no-roundtrip', action='store_true')
    parser.add_argument('--cut', action='store_true')
    args = parser.parse_args()

    work = args.work
    sil = load_json(work / 'silences.json')
    data = load_json(work / 'segments.json')
    segments = data['segments']
    excluded = data.get('excluded', [])
    if args.cut:
        lesson = work / 'lesson.mp3'
        timemap_path = work / 'timemap.json'
        if not lesson.exists() or not timemap_path.exists():
            sys.exit('lesson.mp3 or timemap.json missing: run trim_audio.py first')
        source = lesson
        timemap = load_json(timemap_path)
        segments = apply_timemap(segments, timemap)
        duration = probe_duration(source)
    else:
        source = Path(data.get('source') or sil['source'])
        duration = sil['duration']

    errors = check_structure(segments, duration)
    timed = [s for s in segments if isinstance(s.get('start'), (int, float)) and isinstance(s.get('end'), (int, float))]
    flags = check_boundaries(timed, read_pcm(source), sil['noise_db'])

    if not args.cut:
        covered = [[s['start'], s['end']] for s in timed]
        for e in excluded:
            lo, hi = e.get('speech_start', e.get('start')), e.get('speech_end', e.get('end'))
            if lo is None or hi is None:
                errors.setdefault('excluded', []).append(f"excluded entry without range: {e.get('text', '')}")
            else:
                covered.append([lo, hi])
        gaps = coverage_gaps(sil['islands'], covered)
        if gaps:
            errors.setdefault('coverage', []).extend(
                f'speech {a:.2f}-{b:.2f}s is in no segment and not in excluded' for a, b in gaps)
    else:
        # Everything audible in lesson.mp3 needs a script, headings included.
        lo, hi = timemap['cut_start'], timemap['cut_end']
        inside = [[a, b] for a, b in sil['islands'] if a >= lo and b <= hi]
        gaps = coverage_gaps(inside, [[s['start'], s['end']] for s in data['segments']])
        if gaps:
            errors.setdefault('coverage', []).extend(
                f'speech {a - lo:.2f}-{b - lo:.2f}s in lesson.mp3 has no segment; '
                'headings inside the file must be kept with text' for a, b in gaps)

    heard: dict[str, str] = {}
    scores: dict[str, float] = {}
    notes: dict[str, list[str]] = {}
    if not args.no_roundtrip and timed:
        heard = transcribe_clips(cut_clips(timed, source, work))
        for i, seg in enumerate(timed):
            prev_text = timed[i - 1]['text'] if i else ''
            next_text = timed[i + 1]['text'] if i + 1 < len(timed) else ''
            score, rt = roundtrip_flags(seg, heard.get(seg['id'], ''), next_text, prev_text)
            if not rt and score > 0:
                notes.setdefault(seg['id'], []).append(f"heard \"{heard.get(seg['id'], '')}\" (homophone, same length)")
            scores[seg['id']] = score
            flags.setdefault(seg['id'], []).extend(rt)

    rows, n_err, n_flag = [], 0, 0
    for seg in segments:
        sid = seg.get('id', '?')
        errs, fl = errors.get(sid, []), flags.get(sid, [])
        status = 'ERROR' if errs else 'FLAG' if fl else 'PASS'
        n_err += status == 'ERROR'
        n_flag += status == 'FLAG'
        rows.append({'id': sid, 'section': seg.get('section'), 'start': seg.get('start'), 'end': seg.get('end'),
                     'text': seg.get('text'), 'heard': heard.get(sid), 'cer': scores.get(sid),
                     'status': status, 'reasons': errs + fl + notes.get(sid, [])})
    global_errors = {k: v for k, v in errors.items() if k in ('coverage', 'excluded') and v}

    audio_kind = 'cut' if args.cut else 'source'
    lines = [f"# Verify report — {work.name}", '',
             f"{len(segments)} segments: {len(segments) - n_err - n_flag} PASS, {n_flag} FLAG, {n_err} ERROR. "
             f"{len(excluded)} excluded entries. Audio: {audio_kind}. "
             f"Round-trip: {'off' if args.no_roundtrip else 'on'}.",
             '', 'Confidence is machine-verified (pinyin/Hanzi count, boundary RMS, ASR round-trip, '
             'coverage). Nobody has listened unless the user did.', '']
    for key, msgs in global_errors.items():
        lines.append(f'## {key} ERROR')
        lines.extend(f'- {m}' for m in msgs)
        lines.append('')
    lines += ['| id | section | start–end | CER | status | text | reasons |', '|---|---|---|---|---|---|---|']
    for r in rows:
        c = '' if r['cer'] is None else f"{r['cer']:.2f}"
        lines.append(f"| {r['id']} | {r['section']} | {r['start']}–{r['end']} | {c} | {r['status']} | "
                     f"{r['text']} | {'; '.join(r['reasons'])} |")
    to_listen = [r for r in rows if r['status'] != 'PASS']
    if to_listen and not args.no_roundtrip:
        lines += ['', '## Listen', '']
        lines += [f"- {r['id']} `afplay {work / 'clips' / (r['id'] + '.wav')}` — {'; '.join(r['reasons'])}"
                  for r in to_listen]
    (work / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    save_json(work / 'report.json', {'rows': rows, 'global_errors': global_errors,
                                     'pass': len(segments) - n_err - n_flag, 'flag': n_flag, 'error': n_err,
                                     'audio': audio_kind})
    print(f"{len(segments)} segments: {len(segments) - n_err - n_flag} PASS, {n_flag} FLAG, {n_err} ERROR"
          + (f"; global: {sum(map(len, global_errors.values()))} error(s)" if global_errors else ''))
    print(f"report: {work / 'report.md'}")
    sys.exit(1 if n_err or global_errors else 0)


if __name__ == '__main__':
    main()
