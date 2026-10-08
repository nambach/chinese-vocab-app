#!/usr/bin/env python3
"""Usage: build_draft.py WORK_DIR [--lesson N]

Reads WORK_DIR/asr.json + WORK_DIR/silences.json, writes WORK_DIR/draft.json.

Text comes from ASR. Timing comes from speech islands (non-silent spans between
silencedetect gaps), because Whisper token timestamps drift by ~0.3s. Each ASR segment
claims the islands it overlaps most; sentences inside one ASR segment are split at the
island gap nearest the token time of their final punctuation.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from shadowing_lib import (
    han_chars, load_json, normalize_punct, pad_bounds, save_json, strip_hallucinations,
    to_simplified,
)

LOW_P = 0.5
SENTENCE_END = re.compile(r'(?<=[。？！])')


def asr_segments(asr: dict) -> list[dict]:
    out = []
    for seg in asr['transcription']:
        raw = seg['text'].strip()
        text = strip_hallucinations(raw).strip()
        if not text:
            continue
        simplified, ambiguous = to_simplified(normalize_punct(text))
        tokens = []
        for tok in seg.get('tokens', []):
            if tok['text'].startswith('[_'):
                continue
            tokens.append({
                'text': to_simplified(tok['text'])[0],
                'from': tok['offsets']['from'] / 1000,
                'to': tok['offsets']['to'] / 1000,
                'p': tok.get('p', 1.0),
            })
        out.append({
            'raw_text': raw,
            'text': simplified,
            'ambiguous_t2s': ambiguous,
            'from': seg['offsets']['from'] / 1000,
            'to': seg['offsets']['to'] / 1000,
            'tokens': tokens,
        })
    return out


def assign_islands(segs: list[dict], islands: list[list[float]]) -> list[list[float]]:
    """Give each island to the ASR segment overlapping it most. Returns unassigned islands."""
    for seg in segs:
        seg['islands'] = []
    unassigned = []
    for island in islands:
        best, best_overlap = None, 0.0
        for seg in segs:
            overlap = min(island[1], seg['to']) - max(island[0], seg['from'])
            if overlap > best_overlap:
                best, best_overlap = seg, overlap
        if best is None:
            unassigned.append(island)
        else:
            best['islands'].append(island)
    return unassigned


def boundary_time(tokens: list[dict], han_count: int) -> float | None:
    """Token end time once `han_count` Hanzi have been spoken."""
    seen = 0
    for tok in tokens:
        seen += len(han_chars(tok['text']))
        if seen >= han_count:
            return tok['to']
    return None


def split_sentences(seg: dict) -> list[dict]:
    sentences = [s for s in SENTENCE_END.split(seg['text']) if s.strip()]
    islands = seg['islands']
    if len(sentences) < 2:
        return [{'text': seg['text'], 'islands': islands, 'flags': []}]
    if len(islands) < len(sentences):
        return [{'text': seg['text'], 'islands': islands,
                 'flags': [f'{len(sentences)} sentences but {len(islands)} speech islands: split by hand']}]

    gaps = [(islands[i][1] + islands[i + 1][0]) / 2 for i in range(len(islands) - 1)]
    cuts: list[int] = []
    count = 0
    for sentence in sentences[:-1]:
        count += len(han_chars(sentence))
        estimate = boundary_time(seg['tokens'], count)
        lo = cuts[-1] + 1 if cuts else 0
        remaining = len(sentences) - 1 - len(cuts) - 1
        options = range(lo, len(gaps) - remaining)
        if estimate is None or not options:
            return [{'text': seg['text'], 'islands': islands, 'flags': ['could not place sentence split']}]
        cuts.append(min(options, key=lambda i: abs(gaps[i] - estimate)))

    parts, start = [], 0
    for sentence, cut in zip(sentences, cuts + [len(islands) - 1]):
        parts.append({'text': sentence, 'islands': islands[start:cut + 1], 'flags': []})
        start = cut + 1
    return parts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    parser.add_argument('--lesson', type=int)
    args = parser.parse_args()

    asr = load_json(args.work / 'asr.json')
    sil = load_json(args.work / 'silences.json')
    duration, islands = sil['duration'], sil['islands']

    segs = asr_segments(asr)
    unassigned = assign_islands(segs, islands)

    drafts = []
    for seg in segs:
        low = sorted({c for t in seg['tokens'] if t['p'] < LOW_P for c in han_chars(t['text'])})
        if not seg['islands']:
            drafts.append({'text': seg['text'], 'raw_text': seg['raw_text'], 'islands': [],
                           'flags': ['no speech island matched this ASR text'],
                           'asr_from': seg['from'], 'asr_to': seg['to'], 'low_confidence': low})
            continue
        for part in split_sentences(seg):
            flags = list(part['flags'])
            if seg['ambiguous_t2s']:
                flags.append(f"ambiguous T->S: {''.join(seg['ambiguous_t2s'])}")
            if low:
                flags.append(f"low-confidence chars: {''.join(low)}")
            if re.search(r'[A-Za-z0-9]', part['text']):
                flags.append('latin letters or digits in text')
            drafts.append({'text': part['text'], 'raw_text': seg['raw_text'], 'islands': part['islands'],
                           'flags': flags, 'asr_from': seg['from'], 'asr_to': seg['to'],
                           'low_confidence': low})

    timed = [d for d in drafts if d['islands']]
    for i, d in enumerate(timed):
        d['speech_start'] = d['islands'][0][0]
        d['speech_end'] = d['islands'][-1][1]
    for i, d in enumerate(timed):
        prev_end = timed[i - 1]['speech_end'] if i else None
        next_start = timed[i + 1]['speech_start'] if i + 1 < len(timed) else None
        d['start'], d['end'], notes = pad_bounds(d['speech_start'], d['speech_end'], prev_end, next_start, duration)
        d['flags'].extend(notes)

    for n, d in enumerate(drafts, 1):
        d['draft_id'] = f'd{n}'

    save_json(args.work / 'draft.json', {
        'lesson': args.lesson,
        'source': sil['source'],
        'duration': duration,
        'segments': [{
            'draft_id': d['draft_id'], 'section': None, 'text': d['text'], 'pinyin': '', 'meaning': '',
            'speech_start': d.get('speech_start'), 'speech_end': d.get('speech_end'),
            'start': d.get('start'), 'end': d.get('end'),
            'islands': d['islands'], 'raw_text': d['raw_text'],
            'asr_from': d['asr_from'], 'asr_to': d['asr_to'], 'flags': d['flags'],
        } for d in drafts],
        'unassigned_islands': unassigned,
    })
    flagged = sum(1 for d in drafts if d['flags'])
    print(f'{len(drafts)} draft segments ({flagged} flagged), {len(unassigned)} unassigned speech islands')


if __name__ == '__main__':
    main()
