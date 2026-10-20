#!/usr/bin/env python3
"""Usage: publish_lesson.py --book ID --lesson N [--version V]

Registers src/data/lessons/<id>.json in the lesson pack:
- appends its segment ids to src/data/lessons/published-segment-ids.json
- for a new id, sets INTRODUCED_IN and LESSON_PACK_VERSION to V
- when a bai-N.txt of the same id already exists, leaves the pack version alone.
  That file becoming a json is not a new lesson. Migration attaches the 课文.

V is the current LESSON_PACK_VERSION when that version has not been released yet
(several lessons can ship together), otherwise LESSON_PACK_VERSION + 1. Ask the user.
Running it twice with the same arguments changes nothing.
"""

from __future__ import annotations

import argparse
import json
import re
import sys

from shadowing_lib import APP_DIR, load_json

LESSONS_DIR = APP_DIR / 'src' / 'data' / 'lessons'
INDEX_TS = LESSONS_DIR / 'index.ts'
SNAPSHOT = LESSONS_DIR / 'published-segment-ids.json'

VERSION_RE = re.compile(r'export const LESSON_PACK_VERSION = (\d+)')
INTRODUCED_RE = re.compile(r'(const INTRODUCED_IN: Record<string, number> = \{\n)(.*?)(\n\})', re.S)
ENTRY_RE = re.compile(r"'(bai-\d+)': (\d+),")


def order(lesson: str) -> int:
    return int(lesson.split('-')[1])


def update_index(source: str, lesson: str, version: int) -> str:
    current = int(VERSION_RE.search(source).group(1))
    if version not in (current, current + 1):
        raise ValueError(f'--version must be {current} (not released yet) or {current + 1}, got {version}')
    block = INTRODUCED_RE.search(source)
    if not block:
        raise ValueError('INTRODUCED_IN block not found in index.ts')
    entries = dict((k, int(v)) for k, v in ENTRY_RE.findall(block.group(2)))
    if lesson in entries and entries[lesson] != version:
        raise ValueError(f'{lesson} is already in INTRODUCED_IN with version {entries[lesson]}')
    entries[lesson] = version
    body = '\n'.join(f"  '{k}': {v}," for k, v in sorted(entries.items(), key=lambda kv: order(kv[0])))
    source = source[:block.start(2)] + body + source[block.end(2):]
    return VERSION_RE.sub(f'export const LESSON_PACK_VERSION = {version}', source, count=1)


def update_snapshot(snapshot: dict, lesson: str, ids: list[str]) -> dict:
    if lesson in snapshot and snapshot[lesson] != ids:
        raise ValueError(f'{lesson} is already published with other segment ids')
    merged = {**snapshot, lesson: ids}
    return {k: merged[k] for k in sorted(merged, key=order)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--book', required=True, help='books/<id>.json. Sets the app id.')
    parser.add_argument('--lesson', type=int, required=True)
    parser.add_argument('--version', type=int, help='Required when the id is not already a .txt lesson.')
    args = parser.parse_args()

    from book_config import app_lesson_id, load_book
    lesson = app_lesson_id(load_book(args.book), args.lesson)
    path = LESSONS_DIR / f'{lesson}.json'
    if not path.exists():
        sys.exit(f'{path.relative_to(APP_DIR)} missing: build it with merge-lesson.mjs first')
    data = load_json(path)
    if data.get('format') != 'cn-vocab-lesson' or data.get('id') != lesson:
        sys.exit(f"{path.name} must have format 'cn-vocab-lesson' and id '{lesson}'")

    replaces_txt = (LESSONS_DIR / f'{lesson}.txt').exists()
    if replaces_txt:
        try:
            snapshot = update_snapshot(load_json(SNAPSHOT), lesson, [seg['id'] for seg in data['segments']])
        except ValueError as error:
            sys.exit(str(error))
        SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{lesson}: replaces {lesson}.txt. Pack version unchanged. '
              f'{len(data["segments"])} segment ids published')
        return

    if args.version is None:
        sys.exit('--version is required for a lesson that was not already a .txt')
    try:
        index = update_index(INDEX_TS.read_text(encoding='utf-8'), lesson, args.version)
        snapshot = update_snapshot(load_json(SNAPSHOT), lesson, [seg['id'] for seg in data['segments']])
    except ValueError as error:
        sys.exit(str(error))

    INDEX_TS.write_text(index, encoding='utf-8')
    SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"{lesson}: INTRODUCED_IN {args.version}, LESSON_PACK_VERSION {args.version}, "
          f"{len(data['segments'])} segment ids published")


if __name__ == '__main__':
    main()
