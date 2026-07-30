import type { HanziFontId } from '../models/types'

export type HanziFontDef = {
  id: HanziFontId
  /** Vietnamese label shown in the settings selector. */
  label: string
  /** Short description of the style. */
  description: string
  /**
   * The CSS font-family value applied to hanzi. Always falls back to the
   * system stack so that offline / failed font loads degrade gracefully.
   */
  cssFamily: string
  /**
   * URL of the stylesheet that defines the web font (Google Fonts, jsDelivr,
   * etc.). `null` for the system font, which needs no network request. These
   * stylesheets use `unicode-range` subsetting, so browsers lazily download
   * only the glyph slices actually rendered.
   */
  stylesheetUrl: string | null
}

function googleFontsUrl(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${family}&display=swap`
}

const SYSTEM_FALLBACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export const HANZI_FONTS: HanziFontDef[] = [
  {
    id: 'system',
    label: 'Mặc định (hệ thống)',
    description: 'Phông có sẵn trên thiết bị',
    cssFamily: SYSTEM_FALLBACK,
    stylesheetUrl: null,
  },
  {
    id: 'kai',
    label: 'Chữ in serif (Noto Serif SC)',
    description: 'Kiểu chữ in (Tống thể), rõ nét',
    cssFamily: `"Noto Serif SC", ${SYSTEM_FALLBACK}`,
    stylesheetUrl: googleFontsUrl('Noto+Serif+SC:wght@400;700'),
  },
  {
    id: 'kaiti',
    label: 'Khải thư (Kaiti)',
    description: 'Chữ khải chuẩn (方正楷体 / phông hệ thống)',
    // Prefer the device's native Kaiti (macOS/Windows), then the FZ Kaiti
    // webfont for platforms without it (Android/Linux), then the system stack.
    cssFamily: `"Kaiti SC", STKaiti, KaiTi, "FZKai-Z03S", "楷体", ${SYSTEM_FALLBACK}`,
    stylesheetUrl: 'https://cdn.jsdelivr.net/npm/cn-fontsource-fz-kai-z-03-s@1.0.3/font.css',
  },
  {
    id: 'mashan',
    label: 'Thư pháp (Ma Shan Zheng)',
    description: 'Nét bút lông, dễ đọc',
    cssFamily: `"Ma Shan Zheng", ${SYSTEM_FALLBACK}`,
    stylesheetUrl: googleFontsUrl('Ma+Shan+Zheng'),
  },
  {
    id: 'zhimang',
    label: 'Viết tay (Zhi Mang Xing)',
    description: 'Kiểu chữ viết tay thường ngày',
    cssFamily: `"Zhi Mang Xing", ${SYSTEM_FALLBACK}`,
    stylesheetUrl: googleFontsUrl('Zhi+Mang+Xing'),
  },
  {
    id: 'longcang',
    label: 'Thảo thư (Long Cang)',
    description: 'Chữ thảo bay bổng, khó đọc hơn',
    cssFamily: `"Long Cang", ${SYSTEM_FALLBACK}`,
    stylesheetUrl: googleFontsUrl('Long+Cang'),
  },
]

export function getHanziFont(id: HanziFontId): HanziFontDef {
  return HANZI_FONTS.find((font) => font.id === id) ?? HANZI_FONTS[0]
}

const loadedStylesheets = new Set<string>()

/**
 * Lazily inject a web-font stylesheet. Only runs once per URL. If the request
 * fails (e.g. offline) the CSS font-family fallback to the system stack takes
 * over automatically, so no error handling is needed.
 */
function ensureStylesheet(url: string): void {
  if (typeof document === 'undefined' || loadedStylesheets.has(url)) {
    return
  }
  loadedStylesheets.add(url)

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

/**
 * Apply the selected hanzi font: load it (if needed) and set the shared
 * `--hanzi-font` CSS variable that the <Hanzi> component reads.
 */
export function applyHanziFont(id: HanziFontId): void {
  if (typeof document === 'undefined') return
  const font = getHanziFont(id)
  if (font.stylesheetUrl) {
    ensureStylesheet(font.stylesheetUrl)
  }
  document.documentElement.style.setProperty('--hanzi-font', font.cssFamily)
}
