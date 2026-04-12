const ANILIST_PATH_RE = /^\/(anime|manga)\/(\d+)/

export function parseAnilistImageUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl)
    if (url.hostname !== 'anilist.co')
      return null
    const match = url.pathname.match(ANILIST_PATH_RE)
    if (!match)
      return null
    return `https://img.anili.st/media/${match[2]}`
  }
  catch {
    return null
  }
}
