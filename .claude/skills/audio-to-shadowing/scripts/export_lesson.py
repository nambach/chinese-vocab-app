#!/usr/bin/env python3
"""Usage: export_lesson.py WORK_DIR --lesson N [--force]

Writes src/data/shadowing/lesson-NN.json from WORK_DIR/segments.json (app fields only,
start/end taken from timemap.json) and copies WORK_DIR/lesson.mp3 to
public/audio/shadowing/bai-N.mp3, checking SHA-256.

Refuses unless report.json comes from verify.py --cut and has no ERRORs, unless --force.

Bài 16 keeps id 'lesson-01'. Bài 17–30 become 'lesson-17' … 'lesson-30'.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

from shadowing_lib import APP_DIR, load_json
from trim_audio import apply_timemap

APP_FIELDS = ('id', 'text', 'pinyin', 'meaning', 'start', 'end')


def lesson_id(n: int) -> str:
    return 'lesson-01' if n == 16 else f'lesson-{n:02d}'


def render(n: int, segments: list[dict]) -> str:
    lesson = {
        'id': lesson_id(n),
        'title': f'Bài {n}',
        'audio': {'type': 'file', 'src': f'audio/shadowing/bai-{n}.mp3'},
        'segments': [
            {
                'id': seg['id'],
                'text': seg['text'],
                'pinyin': seg['pinyin'],
                'meaning': seg['meaning'],
                'start': round(seg['start'], 2),
                'end': round(seg['end'], 2),
            }
            for seg in segments
        ],
    }
    return json.dumps(lesson, ensure_ascii=False, indent=2) + '\n'


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
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()

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
    segments = [{k: seg[k] for k in APP_FIELDS} for seg in apply_timemap(data['segments'], load_json(timemap_path))]
    source = lesson_mp3

    json_path = APP_DIR / 'src' / 'data' / 'shadowing' / f'{lesson_id(args.lesson)}.json'
    json_path.write_text(render(args.lesson, segments), encoding='utf-8')

    audio = APP_DIR / 'public' / 'audio' / 'shadowing' / f'bai-{args.lesson}.mp3'
    audio.parent.mkdir(parents=True, exist_ok=True)
    if not audio.exists() or sha256(audio) != sha256(source):
        shutil.copyfile(source, audio)
    if sha256(audio) != sha256(source):
        sys.exit(f'SHA-256 mismatch after copy: {audio}')

    print(f'wrote {json_path.relative_to(APP_DIR)} ({len(segments)} segments)')
    print(f'audio {audio.relative_to(APP_DIR)} matches source (sha256 {sha256(audio)[:12]}…)')


if __name__ == '__main__':
    main()
