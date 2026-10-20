#!/usr/bin/env node
/**
 * Propose a bundled lesson file (format cn-vocab-lesson) by joining a vocab
 * list with a shadowing lesson. Writes the JSON and a review report.
 * Does not decide additions, proper names, or one-character matches — those
 * are listed for a person to confirm.
 *
 *   node scripts/merge-lesson.mjs <bai-NN.txt> <lesson-NN.json> --out <file> --report <file>
 *   node scripts/merge-lesson.mjs --from-shengci <lesson-NN.json> --vocab <bai-N.txt> --id bai-24 --out <file> --report <file>
 *
 * --from-shengci builds the word list from 生词 segments (Bài 24–25, which have
 * no packaged .txt). Pinyin comes from the segment. Meaning and note come from
 * --vocab when the hanzi is listed there; vocab rows that are not read stay out.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const HEADING_RE = /^[一二三四五六七八九十]+、/

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--from-shengci') flags.fromShengci = true
    else if (arg.startsWith('--')) {
      const key = arg.slice(2)
      flags[key] = argv[++i]
    } else positional.push(arg)
  }
  return { positional, flags }
}

function parseVocab(text) {
  const words = []
  let title
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      if (!title) title = line.replace(/^#\s*/, '').trim()
      continue
    }
    const hash = line.indexOf('#')
    const note = hash >= 0 ? line.slice(hash + 1).trim() : ''
    const content = hash >= 0 ? line.slice(0, hash).trim() : line
    const parts = content.split('|').map((part) => part.trim())
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new Error(`Bad vocab line: ${line}`)
    }
    const [hanzi, pinyin, ...meaningParts] = parts
    words.push({
      hanzi,
      pinyin,
      meaning: meaningParts.join(' | ').trim(),
      ...(note ? { note } : {}),
    })
  }
  return { title, words }
}

function assignSections(segments) {
  let afterShengci = false
  return segments.map((segment) => {
    const text = segment.text.trim()
    const numberedHeading = HEADING_RE.test(text) && !/[。？！]$/.test(text)
    const properNameHeading = text === '专名'
    if (numberedHeading || properNameHeading) {
      if (text === '二、生词') afterShengci = true
      return { ...segment, section: 'heading' }
    }
    return { ...segment, section: afterShengci ? 'shengci' : 'kewen' }
  })
}

/** Readings after the 专名 heading are proper names: they are not vocab words. */
function properNameIds(segments) {
  const start = segments.findIndex((segment) => segment.text.trim() === '专名')
  return new Set(start === -1 ? [] : segments.slice(start + 1).map((segment) => segment.id))
}

function erhuaVariants(hanzi) {
  if (hanzi.endsWith('儿')) return [hanzi, hanzi.slice(0, -1)]
  return [hanzi, `${hanzi}儿`]
}

function patternParts(hanzi) {
  if (!hanzi.includes('…')) return null
  const parts = hanzi.split(/…+/).filter(Boolean)
  return parts.length >= 2 ? parts : null
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Occurrences of a one-character word that sit inside a longer vocab item. */
function coveredByLonger(text, index, length, hanzi, vocabHanzi) {
  if (hanzi.length !== 1) return false
  for (const other of vocabHanzi) {
    if (other === hanzi || !other.includes(hanzi)) continue
    for (const variant of erhuaVariants(other)) {
      if (variant.length <= hanzi.length) continue
      let at = text.indexOf(variant)
      while (at !== -1) {
        if (index >= at && index + length <= at + variant.length) return true
        at = text.indexOf(variant, at + 1)
      }
    }
  }
  return false
}

/** 生词 readings are one word per segment, so only an exact line counts. */
function findShengci(segments, hanzi) {
  const exact = segments.find((segment) => segment.text === hanzi)
  if (exact) return { id: exact.id, via: 'exact', text: exact.text }
  const variant = erhuaVariants(hanzi).find((item) => item !== hanzi)
  const hit = variant ? segments.find((segment) => segment.text === variant) : undefined
  return hit ? { id: hit.id, via: `erhua:${hit.text}`, text: hit.text } : null
}

function findDialogue(segments, hanzi, vocabHanzi) {
  const parts = patternParts(hanzi)
  if (parts) {
    const re = new RegExp(parts.map(escapeRegExp).join('.+'))
    const hit = segments.find((segment) => re.test(segment.text))
    return hit ? { id: hit.id, via: 'pattern', text: hit.text } : null
  }

  for (const segment of segments) {
    for (const variant of erhuaVariants(hanzi)) {
      let index = segment.text.indexOf(variant)
      while (index !== -1) {
        if (!coveredByLonger(segment.text, index, variant.length, hanzi, vocabHanzi)) {
          const followedByErhua = variant === hanzi && segment.text[index + hanzi.length] === '儿'
          return {
            id: segment.id,
            via: variant === hanzi && !followedByErhua ? 'exact' : `erhua:${variant}`,
            text: segment.text,
          }
        }
        index = segment.text.indexOf(variant, index + variant.length)
      }
    }
  }
  return null
}

function proposeWord(word, segments, vocabHanzi) {
  const shengci = segments.filter((segment) => segment.section === 'shengci')
  const kewen = segments.filter((segment) => segment.section === 'kewen')
  const shengciHit = findShengci(shengci, word.hanzi)
  const dialogueHit = findDialogue(kewen, word.hanzi, vocabHanzi)
  const segmentIds = []
  if (dialogueHit) segmentIds.push(dialogueHit.id)
  if (shengciHit && shengciHit.id !== dialogueHit?.id) segmentIds.push(shengciHit.id)
  return { word, shengciHit, dialogueHit, segmentIds }
}

/** Words read in 生词 that the packaged .txt did not list. Confirmed 2026-10-13. */
const ADDITIONS = {
  'bai-16': [
    {
      before: '常常',
      hanzi: '常',
      pinyin: 'cháng',
      meaning: 'thường',
      note: '常 + V; ngắn hơn 常常, phủ định vẫn là 不常',
    },
    {
      before: '总是',
      hanzi: '总',
      pinyin: 'zǒng',
      meaning: 'luôn, luôn luôn',
      note: '总 + V; cùng nghĩa với 总是',
    },
  ],
  'bai-19': [
    {
      before: '羽绒服',
      hanzi: '又……又……',
      pinyin: 'yòu……yòu……',
      meaning: 'vừa… vừa…',
      note: '又 + tính từ + 又 + tính từ, VD: 又好又便宜',
    },
  ],
  'bai-20': [
    {
      before: '前年',
      hanzi: '年',
      pinyin: 'nián',
      meaning: 'năm',
      note: '哪一年 = năm nào',
    },
    {
      before: '春节',
      hanzi: '祝你生日快乐',
      pinyin: 'zhù nǐ shēngrì kuàilè',
      meaning: 'chúc bạn sinh nhật vui vẻ',
    },
  ],
  'bai-23': [
    {
      before: '旁边',
      hanzi: '外边',
      pinyin: 'wàibian',
      meaning: 'bên ngoài',
      note: 'ngược với 里边',
    },
  ],
}

/** One-character hits confirmed by hand. Replaces the proposed dialogue segment. */
const DIALOGUE_FIX = {
  'bai-17': { 课: 's19' },
}

function insertAdditions(id, words) {
  const additions = ADDITIONS[id] ?? []
  const next = [...words]
  for (const addition of additions) {
    const { before, ...word } = addition
    const index = next.findIndex((item) => item.hanzi === before)
    if (index === -1) next.push(word)
    else next.splice(index, 0, word)
  }
  return next
}

function lessonIdFromVocabPath(vocabPath) {
  const match = vocabPath.match(/(bai-\d+)\.txt$/)
  if (!match) throw new Error(`Cannot read lesson id from ${vocabPath}`)
  return match[1]
}

function buildLesson({ id, title, audio, segments, proposals }) {
  return {
    format: 'cn-vocab-lesson',
    version: 1,
    id,
    title,
    audio,
    segments,
    words: proposals.map(({ word, segmentIds }) => ({
      hanzi: word.hanzi,
      pinyin: word.pinyin,
      meaning: word.meaning,
      ...(word.note ? { note: word.note } : {}),
      ...(segmentIds.length > 0 ? { segments: segmentIds } : {}),
    })),
  }
}

function formatHit(hit) {
  if (!hit) return '—'
  const sentence = hit.text.length > 42 ? `${hit.text.slice(0, 42)}…` : hit.text
  return `${hit.id} ${hit.via} 「${sentence}」`
}

function writeReport({ id, title, segments, proposals, unmatchedShengci, extraVocab }) {
  const counts = { heading: 0, kewen: 0, shengci: 0 }
  for (const segment of segments) counts[segment.section] += 1
  const lines = [
    `# ${id}  ${title}`,
    '',
    `segments ${segments.length} (heading ${counts.heading}, kewen ${counts.kewen}, shengci ${counts.shengci})`,
    `words ${proposals.length}`,
    '',
    '## Một chữ — cần xác nhận',
    '',
  ]
  const oneChar = proposals.filter(({ word }) => [...word.hanzi].length === 1)
  if (oneChar.length === 0) lines.push('(không có)')
  for (const item of oneChar) {
    lines.push(
      `- ${item.word.hanzi}  生词 ${formatHit(item.shengciHit)}  |  hội thoại ${formatHit(item.dialogueHit)}`,
    )
  }

  lines.push('', '## Không có vị trí', '')
  const nowhere = proposals.filter((item) => item.segmentIds.length === 0)
  if (nowhere.length === 0) lines.push('(không có)')
  for (const item of nowhere) lines.push(`- ${item.word.hanzi}`)

  lines.push('', '## Khớp bằng biến thể (儿 hoặc mẫu ……)', '')
  const variantLines = proposals.filter(
    (item) =>
      (item.shengciHit && item.shengciHit.via !== 'exact') ||
      (item.dialogueHit && item.dialogueHit.via !== 'exact'),
  )
  if (variantLines.length === 0) lines.push('(không có)')
  for (const item of variantLines) {
    lines.push(
      `- ${item.word.hanzi}  生词 ${formatHit(item.shengciHit)}  |  hội thoại ${formatHit(item.dialogueHit)}`,
    )
  }

  lines.push('', '## Đoạn 生词 chưa có từ', '')
  if (unmatchedShengci.length === 0) lines.push('(không có)')
  for (const segment of unmatchedShengci) {
    const suggestion = findDialogue(
      segments.filter((item) => item.section === 'kewen'),
      segment.text,
      proposals.map((item) => item.word.hanzi),
    )
    lines.push(
      `- ${segment.id} ${segment.text}  ${segment.pinyin ?? ''}  ${segment.meaning ?? ''}  | hội thoại ${formatHit(suggestion)}`,
    )
  }

  if (extraVocab) {
    lines.push('', '## Từ trong vocab không được đọc trong 生词', '')
    if (extraVocab.length === 0) lines.push('(không có)')
    for (const word of extraVocab) lines.push(`- ${word.hanzi}`)
  }

  lines.push('', '## Tất cả từ', '')
  for (const item of proposals) {
    const places = item.segmentIds.join(', ') || '—'
    lines.push(`- ${item.word.hanzi}  [${places}]`)
  }
  lines.push('')
  return lines.join('\n')
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  if (!flags.out || !flags.report) {
    console.error('Required: --out <lesson.json> --report <report.md>')
    process.exit(1)
  }

  let sourcePath
  let vocab
  let id

  if (flags.fromShengci) {
    sourcePath = positional[0]
    if (!sourcePath || !flags.id) {
      console.error('Usage: --from-shengci <lesson.json> --id bai-NN --vocab <file> --out --report')
      process.exit(1)
    }
    id = flags.id
    vocab = flags.vocab ? parseVocab(readFileSync(flags.vocab, 'utf8')) : { words: [] }
  } else {
    const [vocabPath, lessonPath] = positional
    if (!vocabPath || !lessonPath) {
      console.error('Usage: <bai-NN.txt> <lesson-NN.json> --out --report')
      process.exit(1)
    }
    sourcePath = lessonPath
    vocab = parseVocab(readFileSync(vocabPath, 'utf8'))
    id = lessonIdFromVocabPath(vocabPath)
  }

  const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
  const segments = assignSections(source.segments)

  let words
  let extraVocab
  if (flags.fromShengci) {
    const byHanzi = new Map(vocab.words.map((word) => [word.hanzi, word]))
    const names = properNameIds(segments)
    words = segments
      .filter((segment) => segment.section === 'shengci' && !names.has(segment.id))
      .map((segment) => {
        const fromVocab = byHanzi.get(segment.text)
        return {
          hanzi: segment.text,
          pinyin: segment.pinyin || fromVocab?.pinyin || '',
          meaning: fromVocab?.meaning || segment.meaning || '',
          ...(fromVocab?.note ? { note: fromVocab.note } : {}),
        }
      })
    const used = new Set(words.map((word) => word.hanzi))
    extraVocab = vocab.words.filter((word) => !used.has(word.hanzi))
  } else {
    words = insertAdditions(id, vocab.words)
  }

  const maskHanzi = words.map((word) => word.hanzi)
  const fixes = DIALOGUE_FIX[id] ?? {}
  const proposals = words.map((word) => {
    const proposal = proposeWord(word, segments, maskHanzi)
    const fixedId = fixes[word.hanzi]
    if (!fixedId) return proposal
    const segment = segments.find((item) => item.id === fixedId)
    const dialogueHit = segment
      ? { id: segment.id, via: 'reviewed', text: segment.text }
      : null
    const segmentIds = []
    if (dialogueHit) segmentIds.push(dialogueHit.id)
    if (proposal.shengciHit && proposal.shengciHit.id !== dialogueHit?.id) {
      segmentIds.push(proposal.shengciHit.id)
    }
    return { ...proposal, dialogueHit, segmentIds }
  })
  const matchedShengci = new Set(
    proposals.map((item) => item.shengciHit?.id).filter(Boolean),
  )
  const unmatchedShengci = segments.filter(
    (segment) => segment.section === 'shengci' && !matchedShengci.has(segment.id),
  )

  const lesson = buildLesson({
    id,
    title: vocab.title || source.title,
    audio: source.audio,
    segments,
    proposals,
  })

  writeFileSync(flags.out, `${JSON.stringify(lesson, null, 2)}\n`)
  writeFileSync(
    flags.report,
    writeReport({
      id,
      title: lesson.title,
      segments,
      proposals,
      unmatchedShengci,
      extraVocab,
    }),
  )
}

main()
