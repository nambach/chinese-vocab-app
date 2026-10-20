#!/usr/bin/env python3
"""Usage: export_lesson.py WORK_DIR --book ID --lesson N [--force]

Copies WORK_DIR/lesson.mp3 to public/audio/shadowing/bai-N.mp3 (SHA-256 checked) and
exports WORK_DIR/segments.json with app fields only: start/end from timemap.json, and
section mapped to the app's heading / kewen / shengci.

- src/data/lessons/bai-N.json exists (published lesson): replaces its segments in place and
  keeps title, audio and words. Refuses if the segment ids differ, because saved words and
  src/data/lessons/published-segment-ids.json point at them.
- Otherwise (new lesson): writes WORK_DIR/lesson.json. Build bai-N.json from it with
  scripts/merge-lesson.mjs --from-shengci, then run publish_lesson.py.

Refuses unless report.json comes from verify.py --cut and has no ERRORs, unless --force.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

from shadowing_lib import APP_DIR, load_json
from trim_audio import apply_timemap

APP_FIELDS = ('id', 'text', 'pinyin', 'meaning', 'start', 'end')
HEADING_RE = re.compile(r'^[一二三四五六七八九十]+、')
SENTENCE_END_RE = re.compile(r'[。？！]$')
LESSONS_DIR = APP_DIR / 'src' / 'data' / 'lessons'


def lesson_id(n: int, pad: int = 0) -> str:
    """App id. pad 0 → bai-16. pad 2 → bai-01. The pad comes from the book config."""
    return f'bai-{n:0{pad}d}' if pad else f'bai-{n}'


def is_heading(text: str) -> bool:
    text = text.strip()
    return text == '专名' or (bool(HEADING_RE.match(text)) and not SENTENCE_END_RE.search(text))


def app_section(seg: dict) -> str:
    """Same rule as scripts/merge-lesson.mjs: numbered headings and 专名 are 'heading'."""
    if is_heading(seg['text']):
        return 'heading'
    return 'shengci' if seg.get('section') == '生词' else 'kewen'


def heading_problems(segments: list[dict]) -> list[str]:
    return [f"{seg['id']} {seg['text']}: a heading must not end with 。？！"
            for seg in segments
            if HEADING_RE.match(seg['text'].strip()) and SENTENCE_END_RE.search(seg['text'].strip())]


def number(value: float) -> float | int:
    value = round(value, 2)
    return int(value) if value == int(value) else value


def app_segments(segments: list[dict]) -> list[dict]:
    rows = []
    for seg in segments:
        row = {k: seg[k] for k in APP_FIELDS}
        row['start'] = number(seg['start'])
        row['end'] = number(seg['end'])
        row['section'] = app_section(seg)
        rows.append(row)
    return rows


def render(n: int, segments: list[dict], pad: int = 0) -> str:
    lid = lesson_id(n, pad)
    lesson = {
        'id': lid,
        'title': f'Bài {n}',
        'audio': {'type': 'file', 'src': f'audio/shadowing/{lid}.mp3'},
        'segments': app_segments(segments),
    }
    return json.dumps(lesson, ensure_ascii=False, indent=2) + '\n'


def word_in(text: str, hanzi: str) -> bool:
    parts = [p for p in re.split(r'…+', hanzi) if p]
    if len(parts) > 1:
        return all(p in text for p in parts)
    base = hanzi[:-1] if hanzi.endswith('儿') and len(hanzi) > 1 else hanzi
    return base in text


def update_published(existing: dict, segments: list[dict]) -> tuple[dict | None, list[str]]:
    """Returns (updated file, problems). A non-empty problem list means: do not write."""
    old_ids = [seg['id'] for seg in existing['segments']]
    new_ids = [seg['id'] for seg in segments]
    if old_ids != new_ids:
        return None, [f'segment ids changed ({len(old_ids)} published, {len(new_ids)} now). '
                      'A published lesson must keep s1..sn: stop and ask the user.']
    updated = {**existing, 'segments': app_segments(segments)}
    by_id = {seg['id']: seg for seg in updated['segments']}
    warnings = [f"warning: word {word['hanzi']} no longer appears in {ref}「{by_id[ref]['text']}」"
                for word in updated.get('words', [])
                for ref in word.get('segments', [])
                if not word_in(by_id[ref]['text'], word['hanzi'])]
    return updated, warnings


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    parser.add_argument('--lesson', type=int, required=True)
    parser.add_argument('--book', required=True, help='books/<id>.json. Sets the app id.')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()

    from book_config import load_book
    pad = int(load_book(args.book).get('idPad', 0))
    lid = lesson_id(args.lesson, pad)

    report_path = args.work / 'report.json'
    if not args.force:
        if not report_path.exists():
            sys.exit('no report.json: run verify.py first')
        report = load_json(report_path)
        if report.get('audio') != 'cut':
            sys.exit('report.json is not from verify.py --cut')
        if report['error'] or report['global_errors']:
            sys.exit('report.json has ERRORs: fix them first (or --force)')

    data = load_json(args.work / 'segments.json')
    timemap_path = args.work / 'timemap.json'
    lesson_mp3 = args.work / 'lesson.mp3'
    if not timemap_path.exists() or not lesson_mp3.exists():
        sys.exit('lesson.mp3 or timemap.json missing: run trim_audio.py first')
    segments = apply_timemap(data['segments'], load_json(timemap_path))
    problems = heading_problems(segments)
    if problems:
        sys.exit('\n'.join(problems))

    published_path = LESSONS_DIR / f'{lid}.json'
    if published_path.exists():
        updated, notes = update_published(load_json(published_path), segments)
        if updated is None:
            sys.exit('\n'.join(notes))
        out_path = published_path
        out_path.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    else:
        notes = []
        out_path = args.work / 'lesson.json'
        out_path.write_text(render(args.lesson, segments, pad), encoding='utf-8')

    audio = APP_DIR / 'public' / 'audio' / 'shadowing' / f'{lid}.mp3'
    audio.parent.mkdir(parents=True, exist_ok=True)
    if not audio.exists() or sha256(audio) != sha256(lesson_mp3):
        shutil.copyfile(lesson_mp3, audio)
    if sha256(audio) != sha256(lesson_mp3):
        sys.exit(f'SHA-256 mismatch after copy: {audio}')

    for note in notes:
        print(note)
    if out_path == published_path:
        print(f'updated {out_path.relative_to(APP_DIR)} ({len(segments)} segments, words kept)')
    else:
        print(f'wrote {out_path} ({len(segments)} segments). New lesson: run merge-lesson.mjs --from-shengci next.')
    print(f'audio {audio.relative_to(APP_DIR)} matches source (sha256 {sha256(audio)[:12]}…)')


if __name__ == '__main__':
    main()
