"""Load a book config from books/<id>.json. Paths and page numbers live there, not in the skill."""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BOOKS = SCRIPT_DIR.parent / 'books'
APP_DIR = SCRIPT_DIR.parents[3]


def book_path(book_id: str) -> Path:
    return BOOKS / f'{book_id}.json'


def load_book(book_id: str) -> dict:
    path = book_path(book_id)
    if not path.exists():
        sys.exit(f'no book config {path}. Write books/{book_id}.json before this lesson. Do not search the PDF.')
    book = json.loads(path.read_text(encoding='utf-8'))
    if book.get('id') != book_id:
        sys.exit(f'{path.name} id is {book.get("id")!r}, expected {book_id!r}')
    return book


def app_path(book: dict, key: str) -> Path:
    raw = Path(book[key]).expanduser()
    return raw if raw.is_absolute() else APP_DIR / raw


def lesson_id(n: int, pad: int = 0) -> str:
    """App id. pad 0 → bai-16. pad 2 → bai-01. Work folders stay bai-N with no pad."""
    return f'bai-{n:0{pad}d}' if pad else f'bai-{n}'


def app_lesson_id(book: dict, n: int) -> str:
    return lesson_id(n, int(book.get('idPad', 0)))


def work_dir(book: dict, n: int) -> Path:
    return app_path(book, 'workDir') / f'bai-{n}'


def pages_dir(book: dict) -> Path:
    return app_path(book, 'pagesDir')


def page_image(book: dict, number: int) -> Path:
    return pages_dir(book) / f'p-{number:03d}.png'


def lesson_info(book: dict, n: int) -> dict:
    lessons = book.get('lessons') or {}
    info = lessons.get(str(n))
    if not info:
        sys.exit(f'{book["id"]} has no lesson {n}. Add it to books/{book["id"]}.json.')
    return info


def page_range(book: dict, n: int) -> tuple[int, int]:
    info = lesson_info(book, n)
    start, end = info.get('start'), info.get('end')
    if not isinstance(start, int) or not isinstance(end, int):
        sys.exit(
            f'{book["id"]} lesson {n} has no PDF page range. '
            f'Fill start and end in books/{book["id"]}.json from the table of contents. '
            'Do not scan the book during a lesson.'
        )
    return start, end


def recording(book: dict) -> dict:
    """The recording selected by audio.use. A book with one file keeps audio.pattern."""
    audio = book['audio']
    recordings = audio.get('recordings')
    if not recordings:
        return audio
    key = audio.get('use')
    if key not in recordings:
        names = ', '.join(sorted(recordings))
        sys.exit(f'{book["id"]} audio.use is {key!r}. Set it to one of: {names}.')
    return recordings[key]


def audio_path(book: dict, n: int) -> Path:
    chosen = recording(book)
    files = chosen.get('files') or {}
    if str(n) in files:
        return Path(files[str(n)]).expanduser()
    pattern = chosen.get('pattern')
    if not pattern:
        sys.exit(f'{book["id"]} has no audio file for lesson {n} in the selected recording.')
    return Path(pattern.format(n=n)).expanduser()


def same_audio(recorded: str, expected: Path) -> bool:
    """True when both paths are the same file. Unicode normalization is not a difference."""
    left = Path(recorded).expanduser()
    right = Path(expected).expanduser()
    if left.exists() and right.exists():
        try:
            return left.samefile(right)
        except OSError:
            pass
    return unicodedata.normalize('NFC', str(left)) == unicodedata.normalize('NFC', str(right))


def vocab_path(book: dict, n: int) -> Path | None:
    vocab = book.get('vocab') or {}
    lessons = vocab.get('lessons')
    if lessons is not None and n not in lessons:
        return None
    pattern = vocab.get('pattern')
    directory = vocab.get('dir')
    if not pattern or not directory:
        return None
    root = Path(directory).expanduser()
    root = root if root.is_absolute() else APP_DIR / root
    path = root / pattern.format(n=n)
    return path if path.exists() else None
