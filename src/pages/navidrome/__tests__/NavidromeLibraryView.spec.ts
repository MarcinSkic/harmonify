import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, setSession } from '@/services/navidrome'
import { useNavidromeStore } from '@/stores'
import NavidromeLibraryView from '../NavidromeLibraryView.vue'

vi.mock('vue-router', async importOriginal => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRouter: () => ({ push: vi.fn() }),
}))

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
      getCoverArtUrl: (id: string) => `http://server/cover/${id}`,
    },
  }
})

const PAGE_SIZE = 60

let wrapper: VueWrapper | null = null

function connect() {
  setSession({
    baseUrl: 'http://192.168.1.10:4533',
    username: 'admin',
    subsonicSalt: 'c19b2d',
    subsonicToken: 'token',
    jwt: 'jwt',
    serverVersion: '0.63.2',
  })
  useNavidromeStore().status = 'connected'
}

beforeEach(() => {
  setActivePinia(createPinia())
  clearSession()
  vi.clearAllMocks()
  getPlaylists.mockResolvedValue([])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('navidromeLibraryView album pagination', () => {
  it('should request one page at a time and move by offset', async () => {
    const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: `a${i}`, name: `Album ${i}` }))
    getAlbums
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce([{ id: 'b1', name: 'Last album' }])
    connect()

    wrapper = mount(NavidromeLibraryView)
    await flushPromises()

    expect(getAlbums).toHaveBeenCalledTimes(1)
    expect(getAlbums).toHaveBeenLastCalledWith({ offset: 0, size: PAGE_SIZE })
    expect(wrapper.text()).toContain('Page 1')

    await wrapper.find('button[title="Next page"]').trigger('click')
    await flushPromises()

    expect(getAlbums).toHaveBeenLastCalledWith({ offset: PAGE_SIZE, size: PAGE_SIZE })
    expect(wrapper.text()).toContain('Page 2')
    expect(wrapper.text()).toContain('Last album')
  })

  it('should disable the next page button on a page that is not full', async () => {
    getAlbums.mockResolvedValue([{ id: 'a1', name: 'Only album' }])
    connect()

    wrapper = mount(NavidromeLibraryView)
    await flushPromises()

    // A short first page means no navigation is offered at all.
    expect(wrapper.find('button[title="Next page"]').exists()).toBe(false)
  })
})
