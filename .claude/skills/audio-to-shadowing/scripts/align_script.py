#!/usr/bin/env python3
"""Usage: align_script.py WORK_DIR --book ID

Places WORK_DIR/script.json onto WORK_DIR/asr.json. The book text is not changed.
Whisper only supplies a time per character.

Boundaries, on purpose, are not snapped to speech edges:
- Sentences that follow each other (gap under JOIN_GAP) split at the midpoint
  between one's end and the next one's start.
- The outside of such a group keeps BUFFER seconds of the surrounding silence,
  and never crosses the midpoint of that silence. That buffer is what keeps the
  first and last sound whole.

Writes segments.json (speech_start/speech_end and start/end already final; do not
run retime.py) and align.md. A line Whisper could not place is listed, not rewritten.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shadowing_lib import cer, han_chars, load_json, save_json, to_simplified

JOIN_GAP = 0.45
BUFFER = 0.18
MAX_CER = 0.34
SEARCH = 80
# A 课文 heading is the one sitting just before the title, not the same word in the intro.
HEAD_GAP = 6.0
# Token times start late by a fraction of a second. Do not rewind to the start of a long island.
EDGE_CATCH = 0.45

# ASR confuses these. They compare as equal; the book text is what gets stored.
SAME_SOUND = str.maketrans({'她': '他', '您': '你'})


def relax(text: str) -> str:
    return han_chars(text).translate(SAME_SOUND)


def char_times(asr: dict) -> list[dict]:
    """One entry per Hanzi Whisper emitted, with that character's time."""
    chars = []
    for seg in asr['transcription']:
        for tok in seg.get('tokens', []):
            raw = tok['text']
            if raw.startswith('[_'):
                continue
            text, _ = to_simplified(raw)
            hans = han_chars(text)
            if not hans:
                continue
            start = tok['offsets']['from'] / 1000
            end = tok['offsets']['to'] / 1000
            if end < start:
                end = start
            step = (end - start) / len(hans) if len(hans) > 1 else 0.0
            for i, ch in enumerate(hans):
                chars.append({'ch': ch, 't0': start + step * i, 't1': start + step * (i + 1) if step else end})
    return chars


def foreign_spans(asr: dict) -> list[dict]:
    """Latin tokens Whisper emitted, such as 伊妹儿 heard as 'email'. Hanzi stays in char_times."""
    spans = []
    for seg in asr['transcription']:
        for tok in seg.get('tokens', []):
            raw = tok['text']
            if raw.startswith('[_') or not raw.strip():
                continue
            text, _ = to_simplified(raw)
            if han_chars(text):
                continue
            t0 = tok['offsets']['from'] / 1000
            t1 = tok['offsets']['to'] / 1000
            if t1 > t0:
                spans.append({'t0': t0, 't1': t1, 'text': raw.strip()})
    return spans


def _window(chars: list[dict], i: int, length: int) -> str:
    return ''.join(c['ch'] for c in chars[i:i + length])


def _best(target: str, chars: list[dict], start: int, end: int, short: bool):
    best = None
    last = min(len(chars), end)
    for i in range(start, last):
        lengths = (len(target),) if short else range(max(1, len(target) - 2), len(target) + 4)
        for length in lengths:
            if i + length > len(chars):
                break
            window = _window(chars, i, length)
            score = cer(target, window.translate(SAME_SOUND))
            if best is None or score < best[0] - 1e-9 or (abs(score - best[0]) < 1e-9 and i < best[1]):
                best = (score, i, length, window)
    return best


def _is_kewen_head(target: str) -> bool:
    return target.endswith('课文') and len(target) <= 4


def _heading_anchor(target: str, nxt: str, chars: list[dict], cursor: int):
    """The heading just before the title. The intro also says 课文, many seconds earlier."""
    best_pair = None
    limit = min(len(chars), cursor + 500)
    for i in range(cursor, limit):
        for length in range(max(1, len(target) - 1), len(target) + 2):
            if i + length > len(chars):
                break
            window = _window(chars, i, length)
            score = cer(target, window.translate(SAME_SOUND))
            if score > MAX_CER:
                continue
            end_t = chars[i + length - 1]['t1']
            j = i + length
            while j < len(chars) and chars[j]['t0'] <= end_t + HEAD_GAP:
                j += 1
            found = _best(nxt, chars, i + length, j, short=False)
            if found is None or found[0] > MAX_CER:
                continue
            gap = chars[found[1]]['t0'] - end_t
            # Same score: the shorter window is the heading. A longer one still
            # contains the previous word (发课文, 乐课文).
            rank = (score, gap, length, i)
            if best_pair is None or rank < best_pair[0]:
                best_pair = (rank, i, length, window)
    if best_pair is None:
        return None
    _, i, length, window = best_pair
    return i, length, window


def _foreign_gap(target: str, chars: list[dict], cursor: int, foreign: list[dict]):
    """A short word heard as Latin sits in the hole before the next Hanzi. Do not consume that Hanzi."""
    if not foreign or len(target) > 4 or len(target) < 2:
        return None
    prev_t = chars[cursor - 1]['t1'] if cursor else 0.0
    next_t = chars[cursor]['t0'] if cursor < len(chars) else prev_t + 4
    if next_t <= prev_t or next_t - prev_t > 4:
        return None
    gap = [s for s in foreign if s['t0'] >= prev_t - 0.05 and s['t1'] <= next_t + 0.05]
    if not gap:
        return None
    t0, t1 = gap[0]['t0'], gap[-1]['t1']
    if t1 - t0 < 0.15:
        return None
    return t0, t1, ''.join(s['text'] for s in gap)


def _zero(ch: dict) -> bool:
    return ch['t1'] - ch['t0'] < 0.02


def _short_span(target: str, chars: list[dict], cursor: int, nxt: str):
    """Next window of the same length. A dropped 儿, or a zero-length stutter, must not eat the next word."""
    options = [len(target)]
    if target.endswith('儿') and len(target) > 1:
        options.append(len(target) - 1)
    starts = [cursor]
    k = cursor
    while k < len(chars) and _zero(chars[k]) and k < cursor + 2:
        k += 1
        starts.append(k)
    best = None
    for start in starts:
        for length in options:
            if start + length > len(chars):
                continue
            window = _window(chars, start, length)
            own = cer(target, window.translate(SAME_SOUND))
            nxt_at = start + length
            if nxt and len(nxt) <= 2 and nxt_at + len(nxt) <= len(chars):
                nxt_score = cer(nxt, _window(chars, nxt_at, len(nxt)).translate(SAME_SOUND))
            elif nxt and len(nxt) > 2:
                found = _best(nxt, chars, nxt_at, nxt_at + SEARCH, short=False)
                nxt_score = 1.0 if found is None else found[0]
            else:
                nxt_score = 0.0
            rank = (nxt_score > MAX_CER, nxt_score, own, start, -length)
            if best is None or rank < best[0]:
                best = (rank, start, length, window)
    if best is None:
        return None
    _, start, length, window = best
    return start, length, window


def match_lines(lines: list[dict], chars: list[dict], foreign: list[dict] | None = None) -> list[dict]:
    """Monotonic. Each line gets t0/t1, or match=None when nothing is close enough."""
    foreign = foreign or []
    cursor = 0
    placed = []
    for idx, line in enumerate(lines):
        target = relax(line['text'])
        if not target:
            placed.append({**line, 'match': None, 'cer': None, 'heard': ''})
            continue
        # One or two characters are a 生词 reading. Take the next window of that
        # length even when the character differs (题/提, 每/美). Searching ahead
        # for a perfect match lands in 练习 and drags every later word with it.
        short = len(target) <= 2
        if short:
            nxt = ''
            for later in lines[idx + 1:]:
                nxt = relax(later['text'])
                if nxt:
                    break
            span_at = _short_span(target, chars, cursor, nxt)
            if span_at is None:
                placed.append({**line, 'match': None, 'cer': None, 'heard': ''})
                continue
            start, length, window = span_at
            span = chars[start:start + length]
            placed.append({
                **line,
                'match': (span[0]['t0'], span[-1]['t1']),
                'cer': cer(target, window.translate(SAME_SOUND)),
                'heard': window,
            })
            cursor = start + length
            continue
        if _is_kewen_head(target):
            nxt = ''
            for later in lines[idx + 1:]:
                nxt = relax(later['text'])
                if nxt:
                    break
            anchor = _heading_anchor(target, nxt, chars, cursor) if len(nxt) >= 2 else None
            if anchor is not None:
                i, length, window = anchor
                span = chars[i:i + length]
                placed.append({
                    **line,
                    'match': (span[0]['t0'], span[-1]['t1']),
                    'cer': cer(target, window.translate(SAME_SOUND)),
                    'heard': window,
                })
                cursor = i + length
                continue
        best = _best(target, chars, cursor, cursor + SEARCH, short=False)
        if best is None or best[0] > MAX_CER:
            gap = _foreign_gap(target, chars, cursor, foreign)
            if gap is not None:
                t0, t1, heard = gap
                placed.append({**line, 'match': (t0, t1), 'cer': 1.0, 'heard': heard})
                continue
            heard = '' if best is None else best[3]
            score = None if best is None else best[0]
            placed.append({**line, 'match': None, 'cer': score, 'heard': heard})
            continue
        i, length = best[1], best[2]
        span = chars[i:i + length]
        placed.append({
            **line,
            'match': (span[0]['t0'], span[-1]['t1']),
            'cer': best[0],
            'heard': best[3],
        })
        cursor = i + length
    return placed


def place(placed: list[dict], duration: float, buffer: float = BUFFER, join_gap: float = JOIN_GAP) -> list[dict]:
    """Fill start/end. Unmatched lines are returned unchanged, with no times."""
    groups: list[list[int]] = []
    for i, line in enumerate(placed):
        if line['match'] is None:
            continue
        if groups and _joins(placed[groups[-1][-1]], line, join_gap):
            groups[-1].append(i)
        else:
            groups.append([i])

    for indexes in groups:
        for pos, i in enumerate(indexes):
            t0, t1 = placed[i]['match']
            if pos == 0:
                start = t0 - buffer
            else:
                prev = placed[indexes[pos - 1]]['match']
                start = (prev[1] + t0) / 2
            if pos == len(indexes) - 1:
                end = t1 + buffer
            else:
                nxt = placed[indexes[pos + 1]]['match']
                end = (t1 + nxt[0]) / 2
            placed[i]['start'] = start
            placed[i]['end'] = end
    for left, right in zip(groups, groups[1:]):
        _share_gap(placed, left[-1], right[0])

    for line in placed:
        if line['match'] is None:
            continue
        line['start'] = round(min(max(line['start'], 0.0), duration), 2)
        line['end'] = round(min(max(line['end'], line['start'] + 0.05), duration), 2)
    return placed


def _joins(left: dict, right: dict, join_gap: float) -> bool:
    gap = right['match'][0] - left['match'][1]
    return gap <= join_gap


def _share_gap(placed: list[dict], left: int, right: int) -> None:
    """Two groups with a real pause: each may use the silence up to its midpoint."""
    mid = (placed[left]['match'][1] + placed[right]['match'][0]) / 2
    placed[left]['end'] = min(placed[left]['end'], mid)
    placed[right]['start'] = max(placed[right]['start'], mid)


def render_report(placed: list[dict]) -> str:
    missed = [ln for ln in placed if ln['match'] is None]
    lines = [f'{sum(ln["match"] is not None for ln in placed)} placed, {len(missed)} not placed.', '']
    if missed:
        lines.append('## Not placed')
        lines.append('')
        for ln in missed:
            cer_s = '' if ln['cer'] is None else f'{ln["cer"]:.2f}'
            lines.append(f"- {ln['text']}  CER {cer_s}  heard 「{ln['heard']}」")
        lines.append('')
    weak = [ln for ln in placed if ln['match'] is not None and ln['cer'] and ln['cer'] > 0]
    if weak:
        lines.append('## Placed, but Whisper disagreed')
        lines.append('')
        for ln in weak:
            lines.append(f"- {ln.get('id', '')} {ln['text']}  CER {ln['cer']:.2f}  heard 「{ln['heard']}」")
        lines.append('')
    return '\n'.join(lines)


def extend_outer_edges(segments: list[dict], islands: list[list[float]], buffer: float = BUFFER) -> None:
    """Token times start late. An outer edge reaches back to that speech, then keeps `buffer` of silence."""
    for i, seg in enumerate(segments):
        prev_end = segments[i - 1]['end'] if i else 0.0
        next_start = segments[i + 1]['start'] if i + 1 < len(segments) else None
        outer_start = i == 0 or seg['start'] - prev_end > 0.03
        outer_end = next_start is None or next_start - seg['end'] > 0.03
        if outer_start:
            near = [(a, b) for a, b in islands
                    if (a < seg['start'] <= b) or (0 <= seg['start'] - b <= 0.45 and a >= prev_end - 1e-6)]
            if near:
                a, _ = max(near, key=lambda span: span[0])
                a = max(a, seg['start'] - EDGE_CATCH)
                seg['start'] = round(max(prev_end, a - buffer), 2)
        if outer_end:
            ceiling = next_start if next_start is not None else seg['end'] + buffer + 1
            near = [(a, b) for a, b in islands
                    if (a <= seg['end'] < b) or (0 <= a - seg['end'] <= 0.45 and b <= ceiling + 1e-6)]
            if near:
                _, b = max(near, key=lambda span: span[1])
                b = min(b, seg['end'] + EDGE_CATCH)
                seg['end'] = round(min(ceiling, b + buffer), 2)
        if seg['end'] <= seg['start']:
            seg['end'] = round(seg['start'] + 0.05, 2)
        seg['speech_start'] = seg['start']
        seg['speech_end'] = seg['end']


def absorb_short_islands(segments: list[dict], islands: list[list[float]], buffer: float = BUFFER) -> None:
    """A breath-sized island left in a pause belongs to the nearer side, up to the midpoint."""
    for a, b in islands:
        if b - a > 0.55:
            continue
        for i, seg in enumerate(segments):
            prev_end = segments[i - 1]['end'] if i else 0.0
            nxt = segments[i + 1]['start'] if i + 1 < len(segments) else None
            if nxt is not None and seg['end'] < a < nxt and a - seg['end'] <= 1.3:
                mid = (seg['end'] + nxt) / 2
                if b <= mid + 1e-6:
                    seg['end'] = round(min(mid, max(seg['end'], b + buffer)), 2)
                    seg['speech_end'] = seg['end']
            if i and prev_end < b < seg['start'] and seg['start'] - b <= 1.3:
                mid = (prev_end + seg['start']) / 2
                if a >= mid - 1e-6:
                    seg['start'] = round(max(mid, min(seg['start'], a - buffer)), 2)
                    seg['speech_start'] = seg['start']


def outside(segments: list[dict], duration: float) -> list[dict]:
    """Intro and 练习 stay out of the file. Covering them keeps the coverage check quiet."""
    if not segments:
        return []
    rows = []
    first, last = segments[0]['start'], segments[-1]['end']
    if first > 0.05:
        rows.append({'section': 'intro', 'reason': 'before the lesson body', 'text': '',
                     'speech_start': 0.0, 'speech_end': first})
    if duration - last > 0.05:
        rows.append({'section': 'tail', 'reason': 'after the lesson body', 'text': '',
                     'speech_start': last, 'speech_end': round(duration, 2)})
    return rows


def build(script: dict, asr: dict, source: str, duration: float, islands: list[list[float]] | None = None) -> tuple[dict, str]:
    placed = place(match_lines(script['lines'], char_times(asr), foreign_spans(asr)), duration)
    segments = []
    n = 0
    for ln in placed:
        if ln['match'] is None:
            continue
        n += 1
        ln['id'] = f's{n}'
        segments.append({
            'id': ln['id'],
            'section': ln['section'],
            'text': ln['text'],
            'pinyin': ln.get('pinyin', ''),
            'meaning': ln.get('meaning', ''),
            'speech_start': ln['start'],
            'speech_end': ln['end'],
            'start': ln['start'],
            'end': ln['end'],
        })
    if islands:
        extend_outer_edges(segments, islands)
        absorb_short_islands(segments, islands)
    data = {'lesson': script.get('lesson'), 'source': source, 'segments': segments,
            'excluded': outside(segments, duration)}
    return data, render_report(placed)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    parser.add_argument('--book', required=True, help='books/<id>.json. The audio must match this config.')
    args = parser.parse_args()

    from book_config import audio_path, load_book, same_audio
    name = args.work.name
    if not name.startswith('bai-') or not name.removeprefix('bai-').isdigit():
        sys.exit(f'{args.work} is not a bai-N work directory')
    book = load_book(args.book)
    expected = audio_path(book, int(name.removeprefix('bai-')))
    sil = load_json(args.work / 'silences.json')
    if not same_audio(sil['source'], expected):
        sys.exit(
            f'silences.json was made from\n  {sil["source"]}\n'
            f'the selected recording is\n  {expected}\n'
            f'Delete asr.json, asr-source.txt and silences.json in {args.work} and transcribe that file.'
        )
    recorded = args.work / 'asr-source.txt'
    if recorded.exists() and not same_audio(recorded.read_text(encoding='utf-8').strip(), expected):
        sys.exit(
            f'asr.json was made from\n  {recorded.read_text(encoding="utf-8").strip()}\n'
            f'the selected recording is\n  {expected}\n'
            f'Delete asr.json, asr-source.txt and silences.json in {args.work} and transcribe that file.'
        )
    data, report = build(
        load_json(args.work / 'script.json'),
        load_json(args.work / 'asr.json'),
        sil['source'],
        sil['duration'],
        sil.get('islands', []),
    )
    if not data['segments']:
        sys.exit('nothing placed: see align.md')
    save_json(args.work / 'segments.json', data)
    (args.work / 'align.md').write_text(report, encoding='utf-8')
    missed = report.splitlines()[0]
    print(f"segments.json: {len(data['segments'])} segments ({missed})")


if __name__ == '__main__':
    main()
