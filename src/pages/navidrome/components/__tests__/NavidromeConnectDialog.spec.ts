import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, setSession } from '@/services/navidrome'
import { useNavidromeStore } from '@/stores'
import NavidromeConnectDialog from '../NavidromeConnectDialog.vue'

vi.mock('vue-router', async importOriginal => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRouter: () => ({ push: vi.fn() }),
}))

let wrapper: VueWrapper | null = null

function storeSession() {
  setSession({
    baseUrl: 'http://192.168.1.10:4533',
    username: 'admin',
    subsonicSalt: 'c19b2d',
    subsonicToken: 'token',
    jwt: 'jwt',
    serverVersion: '0.63.2',
  })
}

function fieldValue(id: string): string {
  return (document.querySelector<HTMLInputElement>(id))?.value ?? ''
}

beforeEach(() => {
  setActivePinia(createPinia())
  clearSession()
})

afterEach(() => {
  // The dialog content is teleported to the body: without an unmount it would leak into the next
  // test and `querySelector` would read the previous test's inputs.
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('navidromeConnectDialog prefill', () => {
  it('should prefill when the dialog is already open at mount', async () => {
    // The route guard calls openConnectDialog() before this component exists — a reload on
    // /navidrome. A watcher alone never fires for a flag that was already true.
    storeSession()
    useNavidromeStore().openConnectDialog()

    wrapper = mount(NavidromeConnectDialog, { attachTo: document.body })
    await flushPromises()

    expect(fieldValue('#navidrome-url')).toBe('http://192.168.1.10:4533')
    expect(fieldValue('#navidrome-user')).toBe('admin')
    expect(fieldValue('#navidrome-password')).toBe('')
  })

  it('should prefill when the dialog is opened after mount', async () => {
    storeSession()
    wrapper = mount(NavidromeConnectDialog, { attachTo: document.body })

    useNavidromeStore().openConnectDialog()
    await flushPromises()

    expect(fieldValue('#navidrome-url')).toBe('http://192.168.1.10:4533')
    expect(fieldValue('#navidrome-user')).toBe('admin')
  })

  it('should leave the form empty when no session is stored', async () => {
    wrapper = mount(NavidromeConnectDialog, { attachTo: document.body })

    useNavidromeStore().openConnectDialog()
    await flushPromises()

    expect(fieldValue('#navidrome-url')).toBe('')
    expect(fieldValue('#navidrome-user')).toBe('')
  })
})
