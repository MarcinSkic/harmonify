import { describe, expect, it } from 'vitest'
import { parseAnilistImageUrl } from '../anilist'

describe('parseAnilistImageUrl', () => {
  it('should parse anime URL', () => {
    expect(parseAnilistImageUrl('https://anilist.co/anime/12345/'))
      .toBe('https://img.anili.st/media/12345')
  })

  it('should parse anime URL with slug', () => {
    expect(parseAnilistImageUrl('https://anilist.co/anime/12345/some-anime-title'))
      .toBe('https://img.anili.st/media/12345')
  })

  it('should parse manga URL', () => {
    expect(parseAnilistImageUrl('https://anilist.co/manga/67890/some-slug'))
      .toBe('https://img.anili.st/media/67890')
  })

  it('should return null for non-anilist host', () => {
    expect(parseAnilistImageUrl('https://example.com/anime/123')).toBeNull()
  })

  it('should return null for non anime/manga path', () => {
    expect(parseAnilistImageUrl('https://anilist.co/user/foo')).toBeNull()
  })

  it('should return null for invalid URL', () => {
    expect(parseAnilistImageUrl('not-a-url')).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(parseAnilistImageUrl('')).toBeNull()
  })

  it('should parse URL without trailing slash', () => {
    expect(parseAnilistImageUrl('https://anilist.co/anime/99999'))
      .toBe('https://img.anili.st/media/99999')
  })
})
