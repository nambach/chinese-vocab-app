#!/usr/bin/env python3
"""Usage: retime.py WORK_DIR

Recomputes `start`/`end` in WORK_DIR/segments.json from each entry's `speech_start`/
`speech_end` (kept segments and excluded entries alike). Run after every merge, split or
boundary fix so padding never reaches into neighbouring speech, kept or excluded.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from shadowing_lib import load_json, pad_bounds, save_json


def retime(data: dict, islands: list[list[float]], duration: float) -> list[str]:
    entries = [e for e in data['segments'] + data.get('excluded', []) if e.get('speech_start') is not None]
    speech = sorted([[e['speech_start'], e['speech_end']] for e in entries] + islands)
    notes = []
    for seg in data['segments']:
        s0, s1 = seg['speech_start'], seg['speech_end']
        if s1 <= s0:
            notes.append(f"{seg['id']}: speech_end <= speech_start")
            continue
        before = [b for a, b in speech if b <= s0 + 1e-6]
        after = [a for a, b in speech if a >= s1 - 1e-6]
        seg['start'], seg['end'], tight = pad_bounds(
            s0, s1, max(before) if before else None, min(after) if after else None, duration)
        notes.extend(f"{seg['id']}: {t}" for t in tight)
    return notes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    args = parser.parse_args()

    sil = load_json(args.work / 'silences.json')
    path = args.work / 'segments.json'
    data = load_json(path)
    notes = retime(data, sil['islands'], sil['duration'])
    save_json(path, data)
    print(f"retimed {len(data['segments'])} segments")
    for note in notes:
        print('  ' + note)


if __name__ == '__main__':
    main()
