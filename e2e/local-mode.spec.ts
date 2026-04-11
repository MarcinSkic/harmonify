import { expect, test } from '@playwright/test'

test.describe('Local mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('harmonifyLibrary')
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        req.onblocked = () => resolve()
      })
    })
    await page.reload()
  })

  test('plays a full local game from setup to result', async ({ page }) => {
    // Seed library with 1 playlist + 2 tracks via raw IndexedDB API
    await page.evaluate(async () => {
      const playlistId = crypto.randomUUID()
      const now = Date.now()
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('harmonifyLibrary', 2)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('playlists')) {
            db.createObjectStore('playlists', { keyPath: 'id' })
          }
          if (!db.objectStoreNames.contains('tracks')) {
            const tracksStore = db.createObjectStore('tracks', { keyPath: 'id' })
            tracksStore.createIndex('playlistIds', 'playlistIds', { multiEntry: true })
          }
          if (!db.objectStoreNames.contains('localGames')) {
            db.createObjectStore('localGames', { keyPath: 'id' })
          }
        }
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['playlists', 'tracks'], 'readwrite')
          tx.objectStore('playlists').add({
            id: playlistId,
            name: 'E2E Playlist',
            source: 'manual',
            createdAt: now,
          })
          for (const i of [1, 2]) {
            tx.objectStore('tracks').add({
              id: crypto.randomUUID(),
              sourceId: `e2e-${i}`,
              name: `E2E Track ${i}`,
              artists: [`Artist ${i}`],
              albumName: `Album ${i}`,
              durationMs: 180000,
              audioUrl: `https://example.com/track${i}.mp3`,
              playbackRange: null,
              tags: [],
              playlistIds: [playlistId],
              metadataSource: 'manual',
              createdAt: now,
            })
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      })
    })
    await page.reload()

    // Home → Local game
    await page.getByRole('link', { name: 'Local game' }).click()
    await expect(page).toHaveURL(/\/local\/setup$/)

    // Setup: 2 teams
    await page.getByPlaceholder('Team 1').fill('Red')
    await page.getByRole('button', { name: 'Add team' }).click()
    await page.getByPlaceholder('Team 2').fill('Blue')

    // Select playlist (defaults to "All tracks" which already includes our tracks)
    await page.getByRole('button', { name: 'E2E Playlist' }).click()

    // Start game
    await page.getByRole('button', { name: 'Play!' }).click()
    await expect(page).toHaveURL(/\/local\/.+\/round$/)

    // Round 1: playing → scoring
    await expect(page.getByText('Round: 1')).toBeVisible()
    await page.getByRole('button', { name: 'Show answer' }).click()

    await page.getByTestId('team-score-Red').fill('5')
    await page.getByTestId('team-score-Blue').fill('3')
    await page.getByRole('button', { name: 'Next round' }).click()

    // Round 2: pool exhausted after this → only "Finish game" available
    await expect(page.getByText('Round: 2')).toBeVisible()
    await page.getByRole('button', { name: 'Show answer' }).click()
    await page.getByTestId('team-score-Red').fill('2')
    await page.getByTestId('team-score-Blue').fill('4')
    await page.getByRole('button', { name: 'Finish game' }).click()

    // Result view
    await expect(page).toHaveURL(/\/local\/.+\/result$/)
    await expect(page.getByRole('heading', { name: 'Game Over' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Red' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Blue' })).toBeVisible()
    await expect(page.getByText('E2E Track 1')).toBeVisible()
    await expect(page.getByText('E2E Track 2')).toBeVisible()
  })
})
