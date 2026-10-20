#!/usr/bin/env python3
"""Usage: prepare_book.py BOOK_ID [--check] [--asr]

Renders missing page images for one book and prints anything else a lesson
pass still needs. Does not OCR and does not write script.json.

--check   report only, do not render
--asr     also write asr.json and silences.json for lessons that lack them

Page images go only to this book's pagesDir.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from book_config import APP_DIR, audio_path, load_book, page_image, pages_dir, recording, same_audio, work_dir

SCRIPT_DIR = Path(__file__).resolve().parent


def _ranges(numbers: list[int]) -> list[tuple[int, int]]:
    if not numbers:
        return []
    spans = []
    start = prev = numbers[0]
    for number in numbers[1:]:
        if number == prev + 1:
            prev = number
            continue
        spans.append((start, prev))
        start = prev = number
    spans.append((start, prev))
    return spans


def _lesson_numbers(book: dict) -> list[int]:
    return sorted(int(key) for key in book.get('lessons', {}))


def _missing_pages(book: dict, start: int, end: int) -> list[int]:
    return [n for n in range(start, end + 1) if not page_image(book, n).exists()]


def _render(book: dict, start: int, end: int) -> None:
    dest = pages_dir(book)
    dest.mkdir(parents=True, exist_ok=True)
    pdf = Path(book['pdf']).expanduser()
    subprocess.run(
        ['pdftoppm', '-f', str(start), '-l', str(end), '-png', '-r', str(book.get('pageDpi', 60)),
         str(pdf), str(dest / 'p')],
        check=True,
    )


def _timed_audio(work: Path, expected: Path) -> str:
    """ok, missing, or STALE. STALE means the files exist but came from another recording."""
    asr = work / 'asr.json'
    silences = work / 'silences.json'
    if not asr.exists() or not silences.exists():
        return 'missing'
    recorded = json.loads(silences.read_text(encoding='utf-8')).get('source', '')
    if not recorded or not same_audio(recorded, expected):
        return 'STALE'
    noted = work / 'asr-source.txt'
    if noted.exists() and not same_audio(noted.read_text(encoding='utf-8').strip(), expected):
        return 'STALE'
    return 'ok'


def _have(cmd: str) -> bool:
    return subprocess.run(['bash', '-lc', f'command -v {cmd}'], capture_output=True).returncode == 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('book_id')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--asr', action='store_true')
    args = parser.parse_args()

    book = load_book(args.book_id)
    chosen = recording(book)
    pdf = Path(book['pdf']).expanduser()
    print(f'{book["id"]}: {book.get("title", "")}')
    print(f'recording {book["audio"].get("use", "pattern")}  {chosen.get("covers", "")}')
    print(f'pdf {"ok" if pdf.exists() else "MISSING"}  {pdf}')
    model = Path.home() / '.cache' / 'whisper' / 'ggml-large-v3.bin'
    print(f'whisper-cli {"ok" if _have("whisper-cli") else "MISSING"}')
    print(f'ffmpeg {"ok" if _have("ffmpeg") else "MISSING"}')
    print(f'model {"ok" if model.exists() else "MISSING"}  {model}')

    if not pdf.exists():
        sys.exit('stop: the PDF in the book config is missing')

    for n in _lesson_numbers(book):
        info = book['lessons'][str(n)]
        start, end = info.get('start'), info.get('end')
        if not isinstance(start, int) or not isinstance(end, int):
            print(f'bai-{n}: no page range — fill books/{book["id"]}.json before OCR')
            continue
        missing = _missing_pages(book, start, end)
        if missing and not args.check:
            for span_start, span_end in _ranges(missing):
                print(f'render p-{span_start:03d}..p-{span_end:03d}', file=sys.stderr)
                _render(book, span_start, span_end)
            missing = _missing_pages(book, start, end)
        audio = audio_path(book, n)
        work = work_dir(book, n)
        asr_state = _timed_audio(work, audio)
        print(
            f'bai-{n}: pages {start}-{end} '
            f'{"ok" if not missing else f"MISSING {len(missing)}"}  '
            f'audio {"ok" if audio.exists() else "MISSING"}  '
            f'asr {asr_state}'
        )
        if asr_state == 'STALE':
            sys.exit(
                f'bai-{n} timings were made from a different file than the selected recording.\n'
                f'Delete asr.json, asr-source.txt and silences.json in {work} and transcribe {audio.name}.'
            )
        if missing:
            sys.exit(f'still missing {missing[0]} after render')
        if args.asr and audio.exists() and asr_state == 'missing':
            if book.get('asrReady'):
                sys.exit(f'{book["id"]} is asrReady but {work / "asr.json"} is missing. Do not re-transcribe a finished book.')
            subprocess.run(['bash', str(SCRIPT_DIR / 'transcribe.sh'), str(audio), str(work)],
                           check=True, cwd=APP_DIR)
            subprocess.run([sys.executable, str(SCRIPT_DIR / 'silences.py'), str(audio), str(work)],
                           check=True, cwd=APP_DIR)


if __name__ == '__main__':
    main()
