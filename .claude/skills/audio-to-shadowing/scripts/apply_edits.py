#!/usr/bin/env python3
"""Usage: apply_edits.py WORK_DIR [edits-*.json ...]

Builds WORK_DIR/segments.json from WORK_DIR/draft.json plus agent-written edit files
(default: WORK_DIR/edits-*.json, merged). Edit file shape:

{
  "excluded":       [["d1", "intro", "reason"], ...],
  "excluded_range": [["d71", "d94", "练习", "reason"], ...],
  "keep": [[["d23", "d24"], "课文", "text or null to keep ASR text", "pinyin", "meaning"], ...,
           [["d17"], "课文", "…", "…", "…", [72.37, 73.41]]]   # optional span: split a draft
}

Merged drafts take speech_start of the first and speech_end of the last. Every draft
must be kept or excluded exactly once. Ids s1..sn follow speaking order. Run retime.py next.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shadowing_lib import load_json, save_json


def draft_num(draft_id: str) -> int:
    return int(draft_id.lstrip('d'))


def build(draft: dict, edits: list[dict]) -> tuple[dict, list[str]]:
    by_id = {d['draft_id']: d for d in draft['segments']}
    used: dict[str, str] = {}
    problems: list[str] = []
    kept, excluded = [], []

    def claim(draft_id: str, role: str, shared: bool = False) -> dict | None:
        if draft_id not in by_id:
            problems.append(f'{role}: unknown draft id {draft_id}')
            return None
        if draft_id in used and not (shared and used[draft_id] == 'keep-span'):
            problems.append(f'{draft_id} used twice ({used[draft_id]} and {role})')
        used[draft_id] = role
        return by_id[draft_id]

    for edit in edits:
        for draft_id, section, reason in edit.get('excluded', []):
            d = claim(draft_id, 'excluded')
            if d:
                excluded.append({'section': section, 'reason': reason, 'text': d['text'],
                                 'speech_start': d['speech_start'], 'speech_end': d['speech_end'],
                                 'draft_ids': [draft_id]})
        for first, last, section, reason in edit.get('excluded_range', []):
            ids = [k for k in by_id if draft_num(first) <= draft_num(k) <= draft_num(last)]
            ds = [d for d in (claim(k, 'excluded_range') for k in ids) if d]
            if ds:
                excluded.append({'section': section, 'reason': reason,
                                 'text': ' / '.join(d['text'] for d in ds),
                                 'speech_start': ds[0]['speech_start'], 'speech_end': ds[-1]['speech_end'],
                                 'draft_ids': ids})
        for item in edit.get('keep', []):
            draft_ids, section, text, pinyin, meaning = item[:5]
            # Optional 6th item [speech_start, speech_end] (null = from drafts) lets several
            # kept segments share one draft, cut at an island gap.
            span = item[5] if len(item) > 5 else None
            role = 'keep-span' if span else 'keep'
            ds = [d for d in (claim(k, role, shared=bool(span)) for k in draft_ids) if d]
            if not ds:
                continue
            start = span[0] if span and span[0] is not None else ds[0]['speech_start']
            end = span[1] if span and span[1] is not None else ds[-1]['speech_end']
            kept.append({'section': section, 'text': text if text is not None else ''.join(d['text'] for d in ds),
                         'pinyin': pinyin, 'meaning': meaning, 'speech_start': start, 'speech_end': end,
                         'draft_ids': list(draft_ids)})

    missing = [k for k in by_id if k not in used]
    if missing:
        problems.append(f"drafts neither kept nor excluded: {', '.join(missing)}")
    if any(e['speech_start'] is None for e in kept + excluded):
        problems.append('some drafts have no speech island; set speech_start/speech_end by hand')

    kept.sort(key=lambda s: (s['speech_start'] or 0))
    excluded.sort(key=lambda s: (s['speech_start'] or 0))
    segments = [{'id': f's{n}', **seg, 'start': None, 'end': None} for n, seg in enumerate(kept, 1)]
    return {'lesson': draft['lesson'], 'source': draft['source'], 'segments': segments,
            'excluded': excluded}, problems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    parser.add_argument('edits', nargs='*', type=Path)
    args = parser.parse_args()

    files = args.edits or sorted(args.work.glob('edits-*.json'))
    if not files:
        sys.exit('no edit files')
    data, problems = build(load_json(args.work / 'draft.json'), [load_json(f) for f in files])
    for p in problems:
        print('problem: ' + p)
    if problems:
        sys.exit(1)
    save_json(args.work / 'segments.json', data)
    print(f"segments.json: {len(data['segments'])} segments, {len(data['excluded'])} excluded entries "
          f"(from {', '.join(f.name for f in files)})")


if __name__ == '__main__':
    main()
