import { describe, expect, it } from 'vitest'
import { resolveAudio } from './resolveAudio'
import { resolveAudioSrc } from './segments'

describe('resolveAudio', () => {
  it('uses the bundled path and a full waveform for a file', () => {
    expect(resolveAudio({ type: 'file', src: 'audio/shadowing/bai-16.mp3' })).toEqual({
      url: resolveAudioSrc('audio/shadowing/bai-16.mp3'),
      waveform: 'full',
    })
  })

  it('leaves a remote url untouched and skips the waveform', () => {
    expect(resolveAudio({ type: 'url', src: 'https://example.com/a.mp3' })).toEqual({
      url: 'https://example.com/a.mp3',
      waveform: 'none',
    })
  })

  it('returns null when there is nothing to play', () => {
    expect(resolveAudio({ type: 'file', src: '  ' })).toBeNull()
    expect(resolveAudio({ type: 'url', src: '' })).toBeNull()
    expect(resolveAudio({ type: 'youtube', videoId: 'abc' })).toBeNull()
    expect(resolveAudio({ type: 'local', name: 'a.mp3', size: 4, mime: 'audio/mpeg' })).toBeNull()
    expect(
      resolveAudio({ type: 'local', blobId: 'b1', name: 'a.mp3', size: 2, mime: 'audio/mpeg' }),
    ).toBeNull()
  })

  it('builds an object url when the local blob is in hand', () => {
    const blob = new Blob([new Uint8Array([1, 2])], { type: 'audio/mpeg' })
    expect(
      resolveAudio(
        { type: 'local', blobId: 'b1', name: 'a.mp3', size: 2, mime: 'audio/mpeg' },
        blob,
        () => 'blob:lesson',
      ),
    ).toEqual({ url: 'blob:lesson', waveform: 'full' })
  })
})
