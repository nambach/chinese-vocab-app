#!/usr/bin/env python3
"""Usage: silences.py SOURCE.mp3 WORK_DIR [--noise-db -35] [--min-dur 0.3]

Runs ffmpeg silencedetect on the source file (same timeline the app plays) and writes
WORK_DIR/silences.json: {duration, noise_db, min_dur, silences: [[start, end], ...], islands}.
"""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

from shadowing_lib import probe_duration, save_json, speech_islands


def detect(source: Path, noise_db: float, min_dur: float) -> list[list[float]]:
    log = subprocess.run(
        ['ffmpeg', '-nostats', '-i', str(source), '-af',
         f'silencedetect=noise={noise_db}dB:d={min_dur}', '-f', 'null', '-'],
        check=True, capture_output=True, text=True,
    ).stderr
    starts = [float(m) for m in re.findall(r'silence_start: (-?[\d.]+)', log)]
    ends = [float(m) for m in re.findall(r'silence_end: ([\d.]+)', log)]
    silences = []
    for i, start in enumerate(starts):
        end = ends[i] if i < len(ends) else None
        silences.append([round(max(0.0, start), 3), round(end, 3) if end is not None else None])
    return silences


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('work', type=Path)
    parser.add_argument('--noise-db', type=float, default=-35)
    parser.add_argument('--min-dur', type=float, default=0.3)
    args = parser.parse_args()

    duration = round(probe_duration(args.source), 3)
    silences = [[s, e if e is not None else duration] for s, e in detect(args.source, args.noise_db, args.min_dur)]
    islands = speech_islands(silences, duration)
    args.work.mkdir(parents=True, exist_ok=True)
    save_json(args.work / 'silences.json', {
        'source': str(args.source),
        'duration': duration,
        'noise_db': args.noise_db,
        'min_dur': args.min_dur,
        'silences': silences,
        'islands': islands,
    })
    print(f'duration {duration}s, {len(silences)} silences, {len(islands)} speech islands')


if __name__ == '__main__':
    main()
