// Bundled default lessons. To publish new lessons later:
//   1. Drop a new `bai-NN.txt` (or any *.txt) into this folder.
//   2. Set its `introducedIn` below to the NEW pack version.
//   3. Bump LESSON_PACK_VERSION to that same number.
// Existing users are then offered ONLY the newly introduced lessons.

export type BuiltinLesson = {
  /** Stable id derived from the file name, e.g. "bai-01". Used to detect duplicates. */
  id: string
  /** Sort order within the pack (natural, not lexical). */
  order: number
  /** Pack version in which this lesson was first shipped. */
  introducedIn: number
  /** Raw file contents, parsed with parseCatalogText. */
  text: string
}

/** Highest pack version currently shipped. Bump when adding lessons. */
export const LESSON_PACK_VERSION = 1

// Per-lesson version overrides. Anything not listed defaults to 1.
const INTRODUCED_IN: Record<string, number> = {}

const modules = import.meta.glob('./*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function idFromPath(path: string): string {
  return path.replace(/^\.\//, '').replace(/\.txt$/, '')
}

function orderFromId(id: string): number {
  const match = id.match(/(\d+)/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

export const LESSON_PACK: BuiltinLesson[] = Object.entries(modules)
  .map(([path, text]) => {
    const id = idFromPath(path)
    return {
      id,
      order: orderFromId(id),
      introducedIn: INTRODUCED_IN[id] ?? 1,
      text,
    }
  })
  .sort((a, b) => a.order - b.order)
