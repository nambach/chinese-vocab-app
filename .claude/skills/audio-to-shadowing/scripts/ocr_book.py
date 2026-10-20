#!/usr/bin/env python3
"""Usage: ocr_book.py --book ID N

Reads that lesson's page images with macOS Vision (on device, zh-Hans) and writes
{workDir}/bai-N/book.json. Page range and image folder come from books/ID.json.
Stops at the 练习 page. Does not correct characters and does not translate.
Does not render the PDF. Run prepare_book.py first.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from book_config import lesson_info, load_book, page_image, page_range, work_dir
from shadowing_lib import has_han
SWIFT = r'''
import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else { fputs("need an image path\n", stderr); exit(1) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: url),
      let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let cg = bitmap.cgImage else {
    fputs("cannot read image\n", stderr); exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "en-US"]
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([request])

struct Row { var text: String; var y: Double; var x: Double }
var rows: [Row] = []
for obs in request.results ?? [] {
    guard let text = obs.topCandidates(1).first?.string else { continue }
    let box = obs.boundingBox
    rows.append(Row(text: text, y: box.origin.y, x: box.origin.x))
}
rows.sort { $0.y > $1.y || ($0.y == $1.y && $0.x < $1.x) }

var lines: [String] = []
var bucket: [Row] = []
func flush() {
    guard !bucket.isEmpty else { return }
    let text = bucket.sorted { $0.x < $1.x }.map { $0.text }.joined()
    if !text.trimmingCharacters(in: .whitespaces).isEmpty { lines.append(text) }
    bucket = []
}
for row in rows {
    if let first = bucket.first, abs(row.y - first.y) > 0.012 { flush() }
    bucket.append(row)
}
flush()

let data = try JSONSerialization.data(withJSONObject: lines, options: [])
FileHandle.standardOutput.write(data)
'''

NOISE = re.compile(r'hai\s*phong|blogspot|https?://|^-\s*\d+\s*-$', re.I)
TONE = re.compile(r'[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]')
def _is_practice(text: str) -> bool:
    """A heading, not a dialogue line that merely contains the word 练习."""
    head = text.strip()
    at = head.find('练习')
    return 0 <= at <= 6 and '。' not in head[:at + 2] and '？' not in head[:at + 2]
BIN = Path('/tmp/ocr-vision')


def _keep(text: str) -> bool:
    text = text.strip()
    if not text or NOISE.search(text):
        return False
    return has_han(text) or bool(TONE.search(text))


def vision(image: Path) -> list[str]:
    if not BIN.exists():
        swift = Path('/tmp/ocr-vision.swift')
        swift.write_text(SWIFT, encoding='utf-8')
        subprocess.run(['swiftc', '-O', '-o', str(BIN), str(swift)], check=True)
    out = subprocess.run([str(BIN), str(image)], check=True, capture_output=True)
    return json.loads(out.stdout)


def read_pages(book: dict, lesson: int) -> list[dict]:
    start, end = page_range(book, lesson)
    # Touch the entry so a missing lesson fails before the first image.
    lesson_info(book, lesson)
    lines = []
    for number in range(start, end + 1):
        image = page_image(book, number)
        if not image.exists():
            sys.exit(f'missing {image}. Run prepare_book.py {book["id"]}. Do not render into another book.')
        page = [text.strip() for text in vision(image) if _keep(text)]
        if any(_is_practice(text) for text in page):
            break
        for text in page:
            lines.append({'page': number, 'text': text, 'pinyin': ''})
        print(f'p-{number:03d}: {len(page)} lines', file=sys.stderr)
    return lines


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--book', required=True, help='books/<id>.json')
    parser.add_argument('lesson', type=int)
    args = parser.parse_args()

    book = load_book(args.book)
    lines = read_pages(book, args.lesson)
    work = work_dir(book, args.lesson)
    work.mkdir(parents=True, exist_ok=True)
    path = work / 'book.json'
    path.write_text(json.dumps({'pages': sorted({ln['page'] for ln in lines}), 'lines': lines},
                               ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {path} ({len(lines)} lines)')


if __name__ == '__main__':
    main()
