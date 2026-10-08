"""Pure helpers shared by the audio-to-shadowing scripts. Python stdlib only."""

from __future__ import annotations

import json
import math
import re
import subprocess
import unicodedata
from array import array
from functools import lru_cache
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parents[3]
OPENCC_ST = APP_DIR / 'scripts' / 'opencc' / 'STCharacters.txt'

WHISPER_MODEL = Path.home() / '.cache' / 'whisper' / 'ggml-large-v3.bin'
WHISPER_PROMPT = '以下是普通话课文，使用简体中文。'

PAD_MAX = 0.12
PAD_MIN = 0.08
SAMPLE_RATE = 16000

# Whisper's well-known hallucinations on near-silent clips.
HALLUCINATIONS = (
    '字幕由', '字幕提供', '谢谢观看', '感谢观看', '请不吝点赞', '订阅', '点赞', '打赏',
    '明镜与点点', '优优独播剧场', 'Amara.org', '中文字幕',
)

HAN_RE = re.compile(r'[㐀-䶿一-鿿豈-﫿]')
PUNCT_ASCII_TO_ZH = {',': '，', '?': '？', '!': '！', ':': '：', ';': '；'}


# ---------------------------------------------------------------- io

def load_json(path: Path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def save_json(path: Path, data) -> None:
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def probe_duration(audio: Path) -> float:
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(audio)],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(out.strip())


def read_pcm(audio: Path, rate: int = SAMPLE_RATE) -> array:
    """Decode to mono s16le. Same decoder (ffmpeg) and timeline as silencedetect."""
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(audio), '-f', 's16le', '-ac', '1', '-ar', str(rate), '-'],
        check=True, capture_output=True,
    ).stdout
    samples = array('h')
    samples.frombytes(raw)
    return samples


# ---------------------------------------------------------------- text

def han_chars(text: str) -> str:
    return ''.join(HAN_RE.findall(text))


def has_han(text: str) -> bool:
    return bool(HAN_RE.search(text))


@lru_cache(maxsize=1)
def _st_tables() -> tuple[frozenset, dict]:
    """(chars that are valid simplified keys, traditional -> [simplified candidates])."""
    simplified_keys: set[str] = set()
    trad_to_simp: dict[str, list[str]] = {}
    for line in OPENCC_ST.read_text(encoding='utf-8').splitlines():
        if not line or line.startswith('#'):
            continue
        key, _, values = line.partition('\t')
        simplified_keys.add(key)
        for value in values.split():
            if value != key:
                trad_to_simp.setdefault(value, []).append(key)
    return frozenset(simplified_keys), trad_to_simp


# OpenCC lists 座 only as a variant of 坐. 座 is a simplified character (the measure word).
_SIMPLIFIED_MISSING_FROM_OPENCC = frozenset('座')


def is_traditional_only(char: str) -> bool:
    if char in _SIMPLIFIED_MISSING_FROM_OPENCC:
        return False
    keys, t2s = _st_tables()
    return char in t2s and char not in keys


def to_simplified(text: str) -> tuple[str, list[str]]:
    """Convert traditional-only chars. Returns (text, ambiguous chars that had >1 candidate)."""
    keys, t2s = _st_tables()
    out: list[str] = []
    ambiguous: list[str] = []
    for char in text:
        if char in _SIMPLIFIED_MISSING_FROM_OPENCC:
            out.append(char)
            continue
        if char in t2s and char not in keys:
            candidates = t2s[char]
            if len(candidates) > 1:
                ambiguous.append(char)
            out.append(candidates[0])
        else:
            out.append(char)
    return ''.join(out), ambiguous


def normalize_punct(text: str) -> str:
    text = text.strip()
    for ascii_mark, zh in PUNCT_ASCII_TO_ZH.items():
        text = text.replace(ascii_mark, zh)
    text = re.sub(r'(?<=[一-鿿])\.$', '。', text)
    return re.sub(r'\s+', ' ', text)


def strip_hallucinations(text: str) -> str:
    for phrase in HALLUCINATIONS:
        text = text.replace(phrase, '')
    return text


# ---------------------------------------------------------------- pinyin

_INITIALS = ('', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x',
             'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w')
_FINALS = ('a', 'o', 'e', 'i', 'u', 'v', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong',
           'er', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ua', 'uo', 'uai',
           'ui', 'uan', 'un', 'uang', 'ueng', 've', 'van', 'vn', 'ue')
SYLLABLES = frozenset(
    i + f for i in _INITIALS for f in _FINALS
    if i or f not in ('i', 'u', 'v', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong',
                      'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ueng', 've', 'van', 'vn', 'ue')
)
_MAX_SYL = max(map(len, SYLLABLES))


def strip_tones(pinyin: str) -> str:
    """Lowercase, drop tone marks, map ü -> v."""
    text = pinyin.lower().replace('ü', 'v').replace('ü', 'v')
    decomposed = unicodedata.normalize('NFD', text)
    return ''.join(ch for ch in decomposed if unicodedata.category(ch) != 'Mn')


def _token_counts(token: str) -> set[int]:
    """All syllable counts a pinyin token can split into (erhua 'r' counts as one, for 儿)."""
    reachable: dict[int, set[int]] = {0: {0}}
    for pos in range(len(token)):
        if pos not in reachable:
            continue
        for length in range(1, _MAX_SYL + 1):
            piece = token[pos:pos + length]
            if len(piece) < length:
                break
            # Mid-word a/o/e syllables need an apostrophe (xī'ān), so they only start a token.
            vowel_start = piece[0] in 'aoe' and pos > 0
            erhua = piece == 'r' and pos > 0 and pos + 1 == len(token)
            if (piece in SYLLABLES and not vowel_start) or erhua:
                reachable.setdefault(pos + length, set()).update(c + 1 for c in reachable[pos])
    return reachable.get(len(token), set())


ACRONYM_RE = re.compile(r'\b[A-Z]{2,}\b')


def acronyms(text: str) -> set[str]:
    """Upper-case Latin acronyms the textbook writes as-is (DVD). Kept verbatim in pinyin too."""
    return set(re.findall(r'[A-Z]{2,}', text))


def pinyin_tokens(pinyin: str, text: str = '') -> list[str]:
    keep = acronyms(text)
    pinyin = ACRONYM_RE.sub(lambda m: ' ' if m.group(0) in keep else m.group(0), pinyin)
    plain = strip_tones(pinyin)
    return [t for t in re.split(r"[^a-z]+", plain) if t]


def pinyin_matches_han(pinyin: str, text: str) -> bool:
    """True if the pinyin can be split into exactly one syllable per Hanzi in text."""
    target = len(han_chars(text))
    possible = {0}
    for token in pinyin_tokens(pinyin, text):
        counts = _token_counts(token)
        if not counts:
            return False
        possible = {p + c for p in possible for c in counts if p + c <= target}
    return target in possible


def pinyin_problems(pinyin: str, text: str = '') -> list[str]:
    problems = []
    if re.search(r'\d', pinyin):
        problems.append('pinyin has tone numbers')
    if re.search(r'v', pinyin):
        problems.append("pinyin uses 'v' instead of 'ü'")
    for token in pinyin_tokens(pinyin, text):
        if not _token_counts(token):
            problems.append(f'pinyin token "{token}" is not valid syllables')
    return problems


# ---------------------------------------------------------------- similarity

def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(reference: str, hypothesis: str) -> float:
    """Character error rate on Hanzi only (punctuation, latin, spaces ignored)."""
    ref = han_chars(reference)
    hyp = han_chars(to_simplified(hypothesis)[0])
    if not ref:
        return 0.0 if not hyp else 1.0
    return edit_distance(ref, hyp) / len(ref)


# ---------------------------------------------------------------- timing

def speech_islands(silences: list[list[float]], duration: float) -> list[list[float]]:
    """Complement of the silence intervals inside [0, duration]."""
    islands = []
    cursor = 0.0
    for start, end in sorted(silences):
        if start > cursor:
            islands.append([round(cursor, 3), round(start, 3)])
        cursor = max(cursor, end)
    if cursor < duration:
        islands.append([round(cursor, 3), round(duration, 3)])
    return [i for i in islands if i[1] - i[0] > 0.02]


def pad_bounds(speech_start: float, speech_end: float, prev_speech_end: float | None,
               next_speech_start: float | None, duration: float) -> tuple[float, float, list[str]]:
    """Pad speech by up to PAD_MAX, never past the midpoint of the gap to a neighbour."""
    notes = []
    room_before = speech_start - (prev_speech_end if prev_speech_end is not None else 0.0)
    if prev_speech_end is not None:
        room_before /= 2
    room_after = (next_speech_start if next_speech_start is not None else duration) - speech_end
    if next_speech_start is not None:
        room_after /= 2
    pad_before = max(0.0, min(PAD_MAX, room_before))
    pad_after = max(0.0, min(PAD_MAX, room_after))
    if pad_before < PAD_MIN:
        notes.append(f'tight start pad {pad_before:.2f}s')
    if pad_after < PAD_MIN:
        notes.append(f'tight end pad {pad_after:.2f}s')
    start = round(max(0.0, speech_start - pad_before), 2)
    end = round(min(duration, speech_end + pad_after), 2)
    if prev_speech_end is not None:
        start = max(start, round((prev_speech_end + speech_start) / 2 + 0.005, 2))
    if next_speech_start is not None:
        end = min(end, round((speech_end + next_speech_start) / 2 - 0.005, 2))
    return start, end, notes


def rms_db(samples: array, start: float, end: float, rate: int = SAMPLE_RATE) -> float:
    lo = max(0, int(start * rate))
    hi = min(len(samples), int(end * rate))
    if hi <= lo:
        return -120.0
    total = 0
    for s in samples[lo:hi]:
        total += s * s
    mean = total / (hi - lo)
    if mean <= 0:
        return -120.0
    return 20 * math.log10(math.sqrt(mean) / 32768)


def coverage_gaps(islands: list[list[float]], covered: list[list[float]],
                  min_ratio: float = 0.5) -> list[list[float]]:
    """Speech islands whose duration is covered less than min_ratio by `covered` ranges."""
    gaps = []
    for start, end in islands:
        span = end - start
        hit = sum(max(0.0, min(end, ce) - max(start, cs)) for cs, ce in covered)
        if span > 0 and hit / span < min_ratio:
            gaps.append([start, end])
    return gaps
