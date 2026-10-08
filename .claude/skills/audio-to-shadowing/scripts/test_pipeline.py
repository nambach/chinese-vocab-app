"""Run: python3 -m unittest discover -s .claude/skills/audio-to-shadowing/scripts -p 'test_*.py'"""

from __future__ import annotations

import json
import sys
import unittest
from array import array
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_draft import split_sentences  # noqa: E402
from export_lesson import lesson_id, render  # noqa: E402
from retime import retime  # noqa: E402
from shadowing_lib import (  # noqa: E402
    cer, coverage_gaps, is_traditional_only, normalize_punct, pad_bounds, pinyin_matches_han,
    pinyin_problems, rms_db, speech_islands, strip_hallucinations, to_simplified,
)
from trim_audio import body_span, remap_segments  # noqa: E402
from verify import check_structure, roundtrip_flags  # noqa: E402


def seg(n, text='我很好。', pinyin='wǒ hěn hǎo', start=1.0, end=2.0, **extra):
    return {'id': f's{n}', 'section': '课文', 'text': text, 'pinyin': pinyin, 'meaning': 'Tôi khỏe.',
            'start': start, 'end': end, **extra}


class TextTests(unittest.TestCase):
    def test_traditional_to_simplified(self):
        self.assertEqual(to_simplified('我們現在去圖書館')[0], '我们现在去图书馆')
        self.assertEqual(to_simplified('你好')[0], '你好')

    def test_traditional_detection(self):
        self.assertTrue(is_traditional_only('們'))
        self.assertFalse(is_traditional_only('们'))
        self.assertFalse(is_traditional_only('干'))
        self.assertFalse(is_traditional_only('座'))
        self.assertEqual(to_simplified('一座')[0], '一座')

    def test_normalize_punct(self):
        self.assertEqual(normalize_punct('你呢?常去吗?'), '你呢？常去吗？')
        self.assertEqual(normalize_punct('很好.'), '很好。')

    def test_hallucination_strip(self):
        self.assertEqual(strip_hallucinations('谢谢观看'), '')


class PinyinTests(unittest.TestCase):
    def test_word_grouped_pinyin_counts(self):
        self.assertTrue(pinyin_matches_han('xiànzài zánmen yìqǐ zǒu ba', '现在咱们一起走吧。'))
        self.assertTrue(pinyin_matches_han('Nǐ cháng qù túshūguǎn ma?', '你常去图书馆吗？'))

    def test_mismatch_detected(self):
        self.assertFalse(pinyin_matches_han('xiànzài zǒu ba', '现在咱们走吧'))
        self.assertFalse(pinyin_matches_han('wǒ hěn hǎo ma', '我很好'))

    def test_ambiguous_split_uses_dp(self):
        # fang'an could be fa+ngan (invalid) or fang+an / fan+gan: 2 syllables either way.
        self.assertTrue(pinyin_matches_han('fāngàn', '方案'))
        self.assertTrue(pinyin_matches_han('Xī’ān', '西安'))

    def test_erhua(self):
        self.assertTrue(pinyin_matches_han('liáotiānr', '聊天儿'))
        self.assertTrue(pinyin_matches_han('yīmèir', '伊妹儿'))
        self.assertTrue(pinyin_matches_han('zài nàr', '在那儿'))

    def test_acronym_kept_verbatim(self):
        self.assertTrue(pinyin_matches_han('diànshìjù de DVD', '电视剧的DVD'))
        self.assertEqual(pinyin_problems('de DVD', '的DVD'), [])
        self.assertTrue(pinyin_problems('de DVD', '的'))

    def test_umlaut_and_problems(self):
        self.assertTrue(pinyin_matches_han('nǚ lǜ', '女绿'))
        self.assertIn("pinyin uses 'v' instead of 'ü'", pinyin_problems('nv3'))
        self.assertIn('pinyin has tone numbers', pinyin_problems('ni3'))
        self.assertEqual(pinyin_problems('nǐ hǎo'), [])


class SimilarityTests(unittest.TestCase):
    def test_cer_ignores_punct_and_script(self):
        self.assertEqual(cer('你呢？常去吗？', '你呢,常去嗎'), 0.0)
        self.assertAlmostEqual(cer('我现在去图书馆', '现在去图书馆'), 1 / 7)

    def test_roundtrip_bleed_and_clip(self):
        s = seg(1, text='我现在去图书馆。')
        _, flags = roundtrip_flags(s, '我现在去图书馆你', next_text='你跟我一起去', prev_text='')
        self.assertTrue(any('start of next segment' in f for f in flags))
        _, flags = roundtrip_flags(s, '现在去图书', next_text='', prev_text='')
        self.assertTrue(any('clipped' in f for f in flags))

    def test_short_clip_exact(self):
        self.assertEqual(roundtrip_flags(seg(1, text='跟'), '跟', '', '')[1], [])
        self.assertEqual(roundtrip_flags(seg(1, text='跟'), '根', '', '')[1], [])
        self.assertTrue(roundtrip_flags(seg(1, text='跟'), '跟我', '', '')[1])

    def test_heading_number_heard_as_digit(self):
        self.assertEqual(roundtrip_flags(seg(1, text='二、生词'), '2.生词', '', '')[1], [])
        self.assertEqual(roundtrip_flags(seg(1, text='一、课文'), '1. 课文', '', '')[1], [])


class TimingTests(unittest.TestCase):
    def test_islands_are_complement(self):
        self.assertEqual(speech_islands([[0, 1], [2, 3]], 5), [[1, 2], [3, 5]])

    def test_pad_full_when_room(self):
        self.assertEqual(pad_bounds(10.0, 12.0, 8.0, 14.0, 300)[:2], (9.88, 12.12))

    def test_pad_never_crosses_gap_midpoint(self):
        start, end, notes = pad_bounds(10.0, 12.0, 9.9, 12.1, 300)
        self.assertGreater(start, 9.95)
        self.assertLess(end, 12.05)
        self.assertTrue(notes)

    def test_pad_clamped_to_file(self):
        self.assertEqual(pad_bounds(0.05, 1.0, None, None, 1.05)[:2], (0.0, 1.05))

    def test_retime_respects_excluded_neighbour(self):
        data = {'segments': [seg(1, speech_start=10.0, speech_end=11.0)],
                'excluded': [{'speech_start': 11.1, 'speech_end': 12.0}]}
        retime(data, [], 300)
        self.assertLess(data['segments'][0]['end'], 11.05)

    def test_coverage_gaps(self):
        self.assertEqual(coverage_gaps([[1, 2], [3, 4]], [[0.9, 2.1]]), [[3, 4]])

    def test_rms(self):
        silent = array('h', [0] * 1600)
        loud = array('h', [10000, -10000] * 800)
        self.assertLess(rms_db(silent, 0, 0.1), -100)
        self.assertGreater(rms_db(loud, 0, 0.1), -15)


class SplitTests(unittest.TestCase):
    def test_split_at_nearest_gap(self):
        asr = {'text': '你呢？常去吗？', 'islands': [[69.1, 69.6], [70.4, 71.3]],
               'tokens': [{'text': '你', 'to': 69.3}, {'text': '呢', 'to': 69.6}, {'text': '?', 'to': 69.8},
                          {'text': '常去', 'to': 70.8}, {'text': '吗', 'to': 71.2}]}
        parts = split_sentences(asr)
        self.assertEqual([p['text'] for p in parts], ['你呢？', '常去吗？'])
        self.assertEqual(parts[1]['islands'], [[70.4, 71.3]])

    def test_too_few_islands_flags(self):
        parts = split_sentences({'text': '好。走吧。', 'islands': [[1, 2]], 'tokens': []})
        self.assertEqual(len(parts), 1)
        self.assertTrue(parts[0]['flags'])


class StructureTests(unittest.TestCase):
    def test_valid_passes(self):
        errors = check_structure([seg(1), seg(2, start=2.0, end=3.0)], 10)
        self.assertEqual({k: v for k, v in errors.items() if v}, {})

    def test_catches_problems(self):
        bad = [seg(1, text='我們很好email', start=1.234), seg(3, pinyin='wo3 hen', start=0.5, end=11)]
        errors = check_structure(bad, 10)
        joined = ' '.join(sum(errors.values(), []))
        for needle in ('non-acronym latin', 'traditional', '2 decimals', 'id should be s2', 'tone numbers', 'overlaps', 'range'):
            self.assertIn(needle, joined)


def _kept(n, speech_start, speech_end, start=None, end=None):
    return {'id': f's{n}', 'speech_start': speech_start, 'speech_end': speech_end,
            'start': speech_start - 0.12 if start is None else start,
            'end': speech_end + 0.12 if end is None else end}


class TrimTests(unittest.TestCase):
    def setUp(self):
        # Preamble, then 课文 heading, two sentences with a 生词 heading between
        # the groups, then 练习 after the last sentence.
        self.segments = [
            _kept(1, 49.186, 51.61),
            _kept(2, 90.613, 91.334),
            _kept(3, 147.328, 148.153),
            _kept(4, 229.0, 231.184, end=231.3),
        ]
        self.excluded = [
            {'speech_start': 1.934, 'speech_end': 14.193, 'text': '出版社', 'reason': 'publisher intro'},
            {'speech_start': 37.756, 'speech_end': 40.068, 'text': '你常去图书馆吗？', 'reason': 'lesson title'},
            {'speech_start': 41.532, 'speech_end': 43.050, 'text': '一 课文', 'reason': 'section heading 课文'},
            {'speech_start': 144.620, 'speech_end': 146.092, 'text': '二 生词', 'reason': 'section heading 生词'},
            {'speech_start': 233.070, 'speech_end': 294.100, 'text': '练习', 'reason': 'practice drills'},
        ]

    def test_span_keeps_headings_and_drops_ends(self):
        start, end = body_span(self.segments, self.excluded, 303.233)
        self.assertGreater(start, 40.068)
        self.assertLess(start, 41.532)
        self.assertGreater(end, 231.3)
        self.assertLess(end, 233.070)
        self.assertLess(144.620, end)
        self.assertGreater(144.620, start)

    def test_kept_headings_do_not_anchor_on_intro_text(self):
        intro = {'speech_start': 15.5, 'speech_end': 22.5, 'text': '配套录音录有课文、生词', 'reason': 'publisher intro'}
        excluded = [intro] + [e for e in self.excluded if 'section heading' not in e['reason']]
        segments = [_kept(0, 41.532, 43.050)] + self.segments
        start, _ = body_span(segments, excluded, 303.233)
        self.assertGreater(start, 40.068)
        self.assertLess(start, 41.532)

    def test_remap_is_one_offset(self):
        start, end = body_span(self.segments, self.excluded, 303.233)
        mapped = remap_segments(self.segments, start, end)
        for src, out in zip(self.segments, mapped):
            self.assertAlmostEqual(out['start'], src['start'] - start, delta=0.01)
            self.assertAlmostEqual(out['end'], src['end'] - start, delta=0.01)
            self.assertLess(out['start'], out['end'])
        self.assertLess(mapped[-1]['end'], round(end - start, 2) + 0.001)
        self.assertGreater(mapped[0]['start'], 0)
        for prev, nxt in zip(mapped, mapped[1:]):
            self.assertLessEqual(prev['end'], nxt['start'])

    def test_no_heading_starts_at_first_sentence(self):
        start, end = body_span(self.segments[:1], [self.excluded[0], self.excluded[-1]], 303.233)
        self.assertAlmostEqual(start, 49.186 - 0.3, places=3)
        self.assertLess(end, 233.070)


class ExportTests(unittest.TestCase):
    def test_ids(self):
        self.assertEqual(lesson_id(16), 'lesson-01')
        self.assertEqual(lesson_id(17), 'lesson-17')

    def test_render(self):
        lesson = json.loads(render(17, [seg(1, meaning="It's ok")]))
        self.assertEqual(lesson['id'], 'lesson-17')
        self.assertEqual(lesson['title'], 'Bài 17')
        self.assertEqual(lesson['audio'], {'type': 'file', 'src': 'audio/shadowing/bai-17.mp3'})
        self.assertEqual(lesson['segments'][0]['meaning'], "It's ok")
        self.assertEqual(list(lesson['segments'][0]), ['id', 'text', 'pinyin', 'meaning', 'start', 'end'])

    def test_render_keeps_hanzi_readable(self):
        out = render(17, [seg(1, text='你好')])
        self.assertIn('"text": "你好"', out)
        self.assertTrue(out.endswith('\n'))


if __name__ == '__main__':
    unittest.main()
