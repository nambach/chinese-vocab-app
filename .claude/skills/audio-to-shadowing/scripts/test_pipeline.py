"""Run: python3 -m unittest discover -s .claude/skills/audio-to-shadowing/scripts -p 'test_*.py'"""

from __future__ import annotations

import json
import sys
import unittest
from array import array
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_draft import split_sentences  # noqa: E402
from align_script import (  # noqa: E402
    absorb_short_islands, char_times, extend_outer_edges, foreign_spans, match_lines, outside, place,
)
from export_lesson import app_section, heading_problems, lesson_id, render, update_published  # noqa: E402
from publish_lesson import update_index, update_snapshot  # noqa: E402
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
        self.assertEqual(lesson_id(16), 'bai-16')
        self.assertEqual(lesson_id(26), 'bai-26')
        self.assertEqual(lesson_id(1, 2), 'bai-01')

    def test_render(self):
        lesson = json.loads(render(17, [seg(1, meaning="It's ok", start=12.0, end=13.456)]))
        self.assertEqual(lesson['id'], 'bai-17')
        self.assertEqual(lesson['title'], 'Bài 17')
        self.assertEqual(lesson['audio'], {'type': 'file', 'src': 'audio/shadowing/bai-17.mp3'})
        row = lesson['segments'][0]
        self.assertEqual(row['meaning'], "It's ok")
        self.assertEqual(list(row), ['id', 'text', 'pinyin', 'meaning', 'start', 'end', 'section'])
        self.assertEqual((row['start'], row['end']), (12, 13.46))

    def test_render_keeps_hanzi_readable(self):
        out = render(17, [seg(1, text='你好')])
        self.assertIn('"text": "你好"', out)
        self.assertTrue(out.endswith('\n'))

    def test_app_sections(self):
        self.assertEqual(app_section(seg(1, text='一、课文')), 'heading')
        self.assertEqual(app_section(seg(1, text='二、生词', section='生词')), 'heading')
        self.assertEqual(app_section(seg(1, text='专名', section='生词')), 'heading')
        self.assertEqual(app_section(seg(1, text='二比一。')), 'kewen')
        self.assertEqual(app_section(seg(1, text='上海', section='生词')), 'shengci')
        self.assertEqual(heading_problems([seg(2, text='一、你常去图书馆吗？')]),
                         ['s2 一、你常去图书馆吗？: a heading must not end with 。？！'])

    def test_update_keeps_words_and_ids(self):
        existing = {'format': 'cn-vocab-lesson', 'version': 1, 'id': 'bai-17', 'title': 'Bài 17',
                    'audio': {'type': 'file', 'src': 'audio/shadowing/bai-17.mp3'},
                    'segments': [{'id': 's1'}],
                    'words': [{'hanzi': '好', 'pinyin': 'hǎo', 'meaning': 'tốt', 'segments': ['s1']},
                              {'hanzi': '玩儿', 'pinyin': 'wánr', 'meaning': 'chơi', 'segments': ['s1']}]}
        updated, notes = update_published(existing, [seg(1, text='我很好。')])
        self.assertEqual(updated['words'], existing['words'])
        self.assertEqual(updated['segments'][0]['section'], 'kewen')
        self.assertEqual(notes, ['warning: word 玩儿 no longer appears in s1「我很好。」'])

    def test_update_refuses_changed_ids(self):
        existing = {'segments': [{'id': 's1'}, {'id': 's2'}], 'words': []}
        updated, notes = update_published(existing, [seg(1)])
        self.assertIsNone(updated)
        self.assertIn('stop and ask the user', notes[0])


def _tok(text, t0, t1):
    return {'text': text, 'offsets': {'from': int(t0 * 1000), 'to': int(t1 * 1000)}}


def _asr(*tokens):
    return {'transcription': [{'tokens': list(tokens)}]}


class AlignTests(unittest.TestCase):
    def test_joined_sentences_split_at_midpoint_and_outer_edges_keep_a_buffer(self):
        asr = _asr(_tok('你', 1.0, 1.3), _tok('好', 1.3, 1.6),
                   _tok('我', 1.7, 2.0), _tok('好', 2.0, 2.4))
        lines = [{'section': '课文', 'text': '你好', 'pinyin': '', 'meaning': ''},
                 {'section': '课文', 'text': '我好', 'pinyin': '', 'meaning': ''}]
        placed = place(match_lines(lines, char_times(asr)), duration=10)
        self.assertAlmostEqual(placed[0]['end'], (1.6 + 1.7) / 2, places=2)
        self.assertEqual(placed[1]['start'], placed[0]['end'])
        self.assertAlmostEqual(placed[0]['start'], 1.0 - 0.18, places=2)
        self.assertAlmostEqual(placed[1]['end'], 2.4 + 0.18, places=2)

    def test_a_pause_keeps_silence_up_to_the_midpoint(self):
        asr = _asr(_tok('你', 1.0, 1.4), _tok('我', 5.0, 5.4))
        lines = [{'section': '课文', 'text': '你', 'pinyin': '', 'meaning': ''},
                 {'section': '课文', 'text': '我', 'pinyin': '', 'meaning': ''}]
        placed = place(match_lines(lines, char_times(asr)), duration=10)
        self.assertLess(placed[0]['end'], 3)
        self.assertGreater(placed[1]['start'], 3)
        self.assertLessEqual(placed[0]['end'], placed[1]['start'])

    def test_homophone_still_places_the_book_text(self):
        asr = _asr(_tok('他', 1.0, 1.5), _tok('好', 1.5, 2.0))
        lines = [{'section': '课文', 'text': '她好', 'pinyin': 'Tā hǎo', 'meaning': 'Cô ấy khỏe'}]
        placed = place(match_lines(lines, char_times(asr)), duration=5)
        self.assertEqual(placed[0]['text'], '她好')
        self.assertIsNotNone(placed[0]['match'])
        self.assertEqual(placed[0]['cer'], 0.0)

    def test_short_word_is_placed_on_the_homophone_whisper_heard(self):
        asr = _asr(_tok('提', 8.0, 8.4))
        lines = [{'section': '生词', 'text': '题', 'pinyin': 'tí', 'meaning': 'câu hỏi'}]
        placed = place(match_lines(lines, char_times(asr)), duration=12)
        self.assertIsNotNone(placed[0]['match'])
        self.assertEqual(placed[0]['text'], '题')
        self.assertAlmostEqual(placed[0]['start'], 8.0 - 0.18, places=2)

    def test_short_word_does_not_jump_ahead_to_a_later_exact_match(self):
        asr = _asr(_tok('美', 10.0, 10.4), _tok('每', 90.0, 90.4))
        lines = [{'section': '生词', 'text': '每', 'pinyin': 'měi', 'meaning': 'mỗi'}]
        placed = match_lines(lines, char_times(asr))
        self.assertEqual(placed[0]['heard'], '美')
        self.assertAlmostEqual(placed[0]['match'][0], 10.0)

    def test_kewen_heading_does_not_keep_the_previous_word(self):
        asr = _asr(_tok('乐', 6.07, 6.16), _tok('课', 8.63, 9.52), _tok('文', 9.52, 9.88),
                   _tok('你', 11.6, 12.0), _tok('好', 12.0, 12.4))
        lines = [{'section': '课文', 'text': '一、课文', 'pinyin': '', 'meaning': ''},
                 {'section': '课文', 'text': '你好', 'pinyin': '', 'meaning': ''}]
        placed = match_lines(lines, char_times(asr))
        self.assertEqual(placed[0]['heard'], '课文')
        self.assertAlmostEqual(placed[0]['match'][0], 8.63, places=1)

    def test_erhua_does_not_eat_the_next_word(self):
        asr = _asr(_tok('画', 159.9, 160.3), _tok('专', 160.4, 162.1),
                   _tok('名', 162.1, 162.7), _tok('田', 162.8, 164.6), _tok('中', 164.8, 165.4))
        lines = [{'section': '生词', 'text': '画儿', 'pinyin': '', 'meaning': ''},
                 {'section': '生词', 'text': '专名', 'pinyin': '', 'meaning': ''},
                 {'section': '生词', 'text': '田中', 'pinyin': '', 'meaning': ''}]
        placed = match_lines(lines, char_times(asr))
        self.assertEqual(placed[0]['heard'], '画')
        self.assertEqual(placed[1]['heard'], '专名')
        self.assertEqual(placed[2]['heard'], '田中')

    def test_zero_length_token_is_ignored(self):
        asr = _asr(_tok('足', 143.6, 144.6), _tok('球', 144.9, 145.8),
                   _tok('场', 145.82, 145.82), _tok('劳', 146.0, 147.2), _tok('驾', 147.3, 148.6))
        lines = [{'section': '生词', 'text': '足球', 'pinyin': '', 'meaning': ''},
                 {'section': '生词', 'text': '劳驾', 'pinyin': '', 'meaning': ''}]
        placed = match_lines(lines, char_times(asr))
        self.assertEqual(placed[0]['heard'], '足球')
        self.assertEqual(placed[1]['heard'], '劳驾')

    def test_kewen_heading_is_the_one_just_before_the_title(self):
        asr = _asr(_tok('有', 18.6, 18.7), _tok('课', 18.7, 19.0), _tok('文', 19.0, 19.4),
                   _tok('一', 41.8, 42.2), _tok('课', 42.2, 42.6), _tok('文', 42.6, 43.0),
                   _tok('一', 43.2, 43.5), _tok('你', 43.5, 44.0), _tok('好', 44.0, 44.4))
        lines = [{'section': '课文', 'text': '一、课文', 'pinyin': '', 'meaning': ''},
                 {'section': '课文', 'text': '一、你好', 'pinyin': '', 'meaning': ''}]
        placed = match_lines(lines, char_times(asr))
        self.assertAlmostEqual(placed[0]['match'][0], 41.8, places=1)
        self.assertAlmostEqual(placed[1]['match'][0], 43.2, places=1)

    def test_latin_word_fills_the_hole_and_leaves_the_next_hanzi(self):
        asr = _asr(_tok('发', 208.8, 209.2), _tok('em', 209.4, 211.2), _tok('ail', 211.2, 211.6),
                   _tok('电', 211.8, 213.5), _tok('影', 213.5, 214.2))
        lines = [{'section': '生词', 'text': '发', 'pinyin': '', 'meaning': ''},
                 {'section': '生词', 'text': '伊妹儿', 'pinyin': '', 'meaning': ''},
                 {'section': '生词', 'text': '电影', 'pinyin': '', 'meaning': ''}]
        placed = match_lines(lines, char_times(asr), foreign_spans(asr))
        self.assertAlmostEqual(placed[1]['match'][0], 209.4, places=1)
        self.assertEqual(placed[1]['heard'], 'email')
        self.assertEqual(placed[2]['heard'], '电影')

    def test_short_island_in_a_pause_goes_to_the_nearer_side(self):
        segments = [
            {'start': 8.2, 'end': 9.2, 'speech_start': 8.2, 'speech_end': 9.2},
            {'start': 11.3, 'end': 13.5, 'speech_start': 11.3, 'speech_end': 13.5},
        ]
        absorb_short_islands(segments, [[10.39, 10.66]])
        self.assertLess(segments[1]['start'], 10.39)
        self.assertGreater(segments[0]['end'], 9.0)
        self.assertLess(segments[0]['end'], segments[1]['start'])

    def test_outer_edge_does_not_rewind_into_a_long_island(self):
        segments = [{'start': 9.7, 'end': 11.6, 'speech_start': 9.7, 'speech_end': 11.6}]
        extend_outer_edges(segments, [[4.2, 12.0]])
        self.assertGreater(segments[0]['start'], 9.0)

    def test_outside_covers_intro_and_tail(self):
        rows = outside([{'start': 8.0, 'end': 90.0}], 100)
        self.assertEqual(rows[0]['speech_end'], 8.0)
        self.assertEqual(rows[1]['speech_start'], 90.0)

    def test_unmatched_line_does_not_block_the_next(self):
        asr = _asr(_tok('你', 2.0, 2.5), _tok('好', 2.5, 3.0))
        lines = [{'section': '课文', 'text': '完全不相关的句子啊', 'pinyin': '', 'meaning': ''},
                 {'section': '课文', 'text': '你好', 'pinyin': '', 'meaning': ''}]
        placed = place(match_lines(lines, char_times(asr)), duration=5)
        self.assertIsNone(placed[0]['match'])
        self.assertIsNotNone(placed[1]['match'])


class PublishTests(unittest.TestCase):
    INDEX = ("export const LESSON_PACK_VERSION = 7\n\n"
             "const INTRODUCED_IN: Record<string, number> = {\n  'bai-24': 7,\n  'bai-25': 7,\n}\n")

    def test_new_version(self):
        out = update_index(self.INDEX, 'bai-26', 8)
        self.assertIn('LESSON_PACK_VERSION = 8', out)
        self.assertIn("  'bai-25': 7,\n  'bai-26': 8,\n}", out)

    def test_same_unreleased_version_and_idempotent(self):
        out = update_index(self.INDEX, 'bai-26', 7)
        self.assertEqual(update_index(out, 'bai-26', 7), out)
        self.assertIn('LESSON_PACK_VERSION = 7', out)

    def test_rejects_version_jump_and_conflict(self):
        with self.assertRaises(ValueError):
            update_index(self.INDEX, 'bai-26', 9)
        with self.assertRaises(ValueError):
            update_index(self.INDEX, 'bai-25', 8)

    def test_snapshot_sorted_and_guarded(self):
        out = update_snapshot({'bai-9': ['s1'], 'bai-25': ['s1']}, 'bai-10', ['s1', 's2'])
        self.assertEqual(list(out), ['bai-9', 'bai-10', 'bai-25'])
        with self.assertRaises(ValueError):
            update_snapshot(out, 'bai-10', ['s1'])


if __name__ == '__main__':
    unittest.main()
