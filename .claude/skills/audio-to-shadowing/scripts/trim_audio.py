#!/usr/bin/env python3
"""Usage: trim_audio.py WORK_DIR

Cuts the source MP3 to one continuous span and encodes it to mono 64kbps.

The span keeps the lesson body in one piece: it starts at the 课文 heading
(so that heading and everything after it stays, including 生词) and stops
before 练习. Publisher intro and the practice drills are the only parts
removed. Nothing in the middle is spliced.

Writes WORK_DIR/lesson.mp3 and WORK_DIR/timemap.json. Segment start/end in
timemap.json are shifted by a single offset (the cut point) so they match
the new file. segments.json stays on the original timeline; run this after
retime.py, and run it again if you retime.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import wave
from array import array
from pathlib import Path

from shadowing_lib import load_json, probe_duration, save_json

EDGE = 0.3
BITRATE = '64k'
RATE = 44100


def body_span(segments: list[dict], excluded: list[dict], duration: float,
              edge: float = EDGE) -> tuple[float, float]:
    """Source-timeline [cut_start, cut_end) covering 课文 heading through the last segment."""
    if not segments:
        raise ValueError('no segments')
    first_speech = min(s['speech_start'] for s in segments)
    last_speech = max(s['speech_end'] for s in segments)
    first_start = min(s['start'] for s in segments)
    last_end = max(s['end'] for s in segments)

    before = [e for e in excluded if _ends_by(e, first_speech)]
    headings = [e for e in before if _is_kewen_heading(e)]
    anchor = max(headings, key=lambda e: e['speech_start']) if headings else None
    raw_start = anchor['speech_start'] if anchor else first_speech
    earlier = [e['speech_end'] for e in before if e is not anchor and e['speech_end'] <= raw_start + 1e-6]
    barrier_before = max(earlier) if earlier else 0.0
    cut_start = max(barrier_before, raw_start - edge, 0.0)
    if first_start < cut_start:
        cut_start = max(barrier_before, first_start)

    after = [e['speech_start'] for e in excluded if _starts_at(e, last_speech)]
    barrier_after = min(after) if after else duration
    cut_end = min(duration, barrier_after, last_speech + edge)
    if last_end > cut_end:
        cut_end = min(barrier_after, duration, last_end)
    if cut_end <= cut_start:
        raise ValueError(f'empty trim span {cut_start}..{cut_end}')
    return round(cut_start, 3), round(cut_end, 3)


def remap_segments(segments: list[dict], cut_start: float, cut_end: float) -> list[dict]:
    """Shift source start/end by one offset. Result stays inside the cut file."""
    span = round(cut_end - cut_start, 2)
    mapped = []
    previous = 0.0
    for seg in segments:
        start = round(seg['start'] - cut_start, 2)
        end = round(seg['end'] - cut_start, 2)
        start = min(max(start, previous), span)
        end = min(max(end, round(start + 0.01, 2)), span)
        mapped.append({'id': seg['id'], 'start': start, 'end': end})
        previous = end
    return mapped


def apply_timemap(segments: list[dict], timemap: dict) -> list[dict]:
    by_id = {row['id']: row for row in timemap['segments']}
    missing = [seg['id'] for seg in segments if seg['id'] not in by_id]
    if missing:
        raise KeyError(f'timemap missing segments: {", ".join(missing)}')
    return [{**seg, 'start': by_id[seg['id']]['start'], 'end': by_id[seg['id']]['end']} for seg in segments]


def _ends_by(entry: dict, when: float) -> bool:
    end = entry.get('speech_end')
    return isinstance(end, (int, float)) and end <= when + 1e-3


def _starts_at(entry: dict, when: float) -> bool:
    start = entry.get('speech_start')
    return isinstance(start, (int, float)) and start >= when - 1e-3


def _is_kewen_heading(entry: dict) -> bool:
    # Reason only: the publisher intro's ASR text also says 课文 (配套录音录有课文…).
    return '课文' in entry.get('reason', '')


def _decode(audio: Path) -> array:
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(audio), '-f', 's16le', '-ac', '1', '-ar', str(RATE), '-'],
        check=True, capture_output=True,
    ).stdout
    samples = array('h')
    samples.frombytes(raw)
    return samples


def _write_wav(path: Path, samples: array) -> None:
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(samples.tobytes())


def _encode(wav: Path, mp3: Path, bitrate: str) -> None:
    subprocess.run(
        ['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame',
         '-ac', '1', '-ar', str(RATE), '-b:a', bitrate, str(mp3)],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    parser.add_argument('--bitrate', default=BITRATE)
    args = parser.parse_args()

    data = load_json(args.work / 'segments.json')
    sil = load_json(args.work / 'silences.json')
    if any(seg.get('start') is None or seg.get('end') is None for seg in data['segments']):
        sys.exit('segments have no start/end: run retime.py first')

    cut_start, cut_end = body_span(data['segments'], data.get('excluded', []), sil['duration'])
    mapped = remap_segments(data['segments'], cut_start, cut_end)
    source = Path(data['source'])
    samples = _decode(source)
    lo = max(0, int(round(cut_start * RATE)))
    hi = min(len(samples), int(round(cut_end * RATE)))
    if hi <= lo:
        sys.exit(f'cut span is empty in samples: {cut_start}..{cut_end}')

    wav = args.work / 'lesson.wav'
    mp3 = args.work / 'lesson.mp3'
    _write_wav(wav, samples[lo:hi])
    try:
        _encode(wav, mp3, args.bitrate)
    finally:
        wav.unlink(missing_ok=True)

    timemap = {
        'mode': 'head-tail',
        'source': str(source),
        'output': str(mp3),
        'bitrate': args.bitrate,
        'channels': 1,
        'sample_rate': RATE,
        'cut_start': cut_start,
        'cut_end': cut_end,
        'pcm_duration': round((hi - lo) / RATE, 3),
        'mp3_duration': round(probe_duration(mp3), 3),
        'segments': mapped,
    }
    save_json(args.work / 'timemap.json', timemap)
    size = mp3.stat().st_size
    print(f'cut {cut_start:.3f}–{cut_end:.3f}s -> {mp3.name} '
          f'({timemap["mp3_duration"]:.1f}s, {size / 1e6:.2f}MB, {args.bitrate} mono)')
    print(f'{len(mapped)} segments, offset -{cut_start:.3f}s')


if __name__ == '__main__':
    main()
