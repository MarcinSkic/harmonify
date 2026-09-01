/** Shape shared by the album and playlist tiles; never parsed from outside, so a plain interface. */
export interface NavidromeCoverTile {
  id: string
  title: string
  subtitle: string
  /** Subsonic cover art id; absent means the tile shows a placeholder icon. */
  coverArt?: string
}
