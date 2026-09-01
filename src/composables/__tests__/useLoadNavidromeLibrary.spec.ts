import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useLoadNavidromeLibrary } from '@/composables/useLoadNavidromeLibrary'
import { clearSession, setSession } from '@/services/navidrome'

const getAlbums = vi.fn()
const getPlaylists = vi.fn()

vi.mock('@/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services')>()
  return {
    ...actual,
    NavidromeService: {
      ...actual.NavidromeService,
      getAlbums: (args: unknown) => getAlbums(args),
      getPlaylists: () => getPlaylists(),
    },
  }
})

interface LibraryHost {
  playlistPage: number
  goToPlaylistPage: (page: number) => void
}

const host = defineComponent({
  setup: () => useLoadNavidromeLibrary(),
  template: '<div>{{ playlists.map(p => p.name).join(",") }}|page={{ playlistPage }}|next={{ hasNextPlaylistPage }}</div>',
})

let wrapper: VueWrapper | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  clearSession()
  vi.clearAllMocks()
  getAlbums.mockResolvedValue([])
  setSession({
    baseUrl: 'http://192.168.1.10:4533',
    username: 'admin',
    subsonicSalt: 'c19b2d',
    subsonicToken: 'token',
    jwt: 'jwt',
    serverVersion: '0.63.2',
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('useLoadNavidromeLibrary playlist paging', () => {
  it('should page a single response client-side', async () => {
    // `getPlaylists` returns everything in one call, so paging must not hit the network again.
    getPlaylists.mockResolvedValue(
      Array.from({ length: 70 }, (_, i) => ({ id: `p${i}`, name: `Playlist ${i}`, songCount: i })),
    )

    wrapper = mount(host)
    await flushPromises()

    expect(getPlaylists).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Playlist 59')
    expect(wrapper.text()).not.toContain('Playlist 60')
    expect(wrapper.text()).toContain('next=true')

    ;(wrapper.vm as unknown as LibraryHost).goToPlaylistPage(1)
    await flushPromises()

    expect(getPlaylists).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Playlist 69')
    expect(wrapper.text()).not.toContain('Playlist 59')
    expect(wrapper.text()).toContain('next=false')
  })

  it('should ignore a page beyond the last one', async () => {
    getPlaylists.mockResolvedValue([{ id: 'p1', name: 'Only playlist', songCount: 1 }])

    wrapper = mount(host)
    await flushPromises()

    ;(wrapper.vm as unknown as LibraryHost).goToPlaylistPage(3)
    await flushPromises()

    expect(wrapper.text()).toContain('page=0')
    expect(wrapper.text()).toContain('Only playlist')
  })
})
