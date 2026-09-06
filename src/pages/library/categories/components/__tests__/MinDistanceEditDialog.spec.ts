import type { VueWrapper } from '@vue/test-utils'
import type { Ref } from 'vue'
import type { CategorySet, FieldMinDistance } from '@/db/schemas'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { db } from '@/db'
import MinDistanceEditDialog from '../MinDistanceEditDialog.vue'

let wrapper: VueWrapper | null = null

interface Harness {
  open: Ref<boolean>
  minDistance: Ref<FieldMinDistance | null>
}

/** Mirrors how `CategorySetCard` drives the dialog: an `open` flag and the entry being edited. */
function mountDialog(categorySet: CategorySet, initial: FieldMinDistance | null): Harness {
  const open = ref(false)
  const minDistance = shallowRef<FieldMinDistance | null>(initial)

  const Host = defineComponent({
    setup() {
      return () => h(MinDistanceEditDialog, {
        'open': open.value,
        'categorySet': categorySet,
        'minDistance': minDistance.value,
        'onUpdate:open': (value: boolean) => (open.value = value),
      })
    },
  })

  wrapper = mount(Host, { attachTo: document.body })
  return { open, minDistance }
}

/** The dialog content is teleported, so it is read off the document rather than off the wrapper. */
function inputs(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input')]
}

/** `SuggestInput` puts the id on its wrapper, so the field is found by its placeholder. */
function nameInput(): HTMLInputElement {
  const input = inputs().find(candidate => candidate.placeholder === 'e.g. work')
  if (!input)
    throw new Error('No field-name input in the dialog')
  return input
}

function roundsInput(): HTMLInputElement {
  const input = inputs().find(candidate => candidate.placeholder === 'Rounds')
  if (!input)
    throw new Error('No rounds input in the dialog')
  return input
}

function setTextField(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input'))
}

/** `NumberFieldInput` only commits its value on blur, not on every keystroke. */
function setNumberField(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input'))
  input.dispatchEvent(new Event('blur'))
}

function buttonLabelled(label: string): HTMLElement {
  const button = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')]
    .find(candidate => candidate.textContent?.trim() === label)
  if (!button)
    throw new Error(`No "${label}" button in the dialog`)
  return button
}

async function settle() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, 20))
  await flushPromises()
}

function makeSet(minDistances: FieldMinDistance[]): CategorySet {
  return {
    id: crypto.randomUUID(),
    name: 'Konkurs',
    valueLimitations: [],
    minDistances,
    createdAt: 1,
  }
}

beforeEach(async () => {
  setActivePinia(createPinia())
  await db.categorySets.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('minDistanceEditDialog', () => {
  it('saves an edited distance and leaves the other entry alone', async () => {
    const work: FieldMinDistance = { name: 'work', distance: 5 }
    const album: FieldMinDistance = { name: 'album', distance: 2 }
    const categorySet = makeSet([album, work])
    await db.categorySets.add(categorySet)

    const { open } = mountDialog(categorySet, work)
    open.value = true
    await settle()

    expect(roundsInput().value).toBe('5')

    setNumberField(roundsInput(), '8')
    await settle()

    buttonLabelled('Save').click()
    await settle()

    expect(open.value).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    const stored = (await db.categorySets.get(categorySet.id))!
    expect(stored.minDistances).toEqual([album, { name: 'work', distance: 8 }])
  })

  it('adds a new entry to the set', async () => {
    const categorySet = makeSet([])
    await db.categorySets.add(categorySet)

    const { open } = mountDialog(categorySet, null)
    open.value = true
    await settle()

    setTextField(nameInput(), 'work')
    setNumberField(roundsInput(), '5')
    await settle()

    buttonLabelled('Add').click()
    await settle()

    expect(open.value).toBe(false)

    const stored = (await db.categorySets.get(categorySet.id))!
    expect(stored.minDistances).toEqual([{ name: 'work', distance: 5 }])
  })

  it('refuses a field already covered by another entry and stores nothing', async () => {
    // Two entries for one field are two answers to the same question, which the service rejects as
    // well — the dialog catches it first so the user sees it on the field they just typed.
    const work: FieldMinDistance = { name: 'work', distance: 5 }
    const album: FieldMinDistance = { name: 'album', distance: 2 }
    const categorySet = makeSet([album, work])
    await db.categorySets.add(categorySet)

    const { open } = mountDialog(categorySet, album)
    open.value = true
    await settle()

    setTextField(nameInput(), 'work')
    await settle()

    buttonLabelled('Save').click()
    await settle()

    expect(open.value).toBe(true)

    const stored = (await db.categorySets.get(categorySet.id))!
    expect(stored.minDistances).toEqual([album, work])
  })

  it('raises a typed value below the schema minimum instead of refusing it', async () => {
    // `fieldMinDistanceSchema` starts at 2, and the stepper's `min` is what keeps that rule out of
    // the user's way: 1 is corrected to 2 on blur, so the schema error stays a last line of defence
    // for the JSON import path rather than something the form can produce.
    const categorySet = makeSet([])
    await db.categorySets.add(categorySet)

    const { open } = mountDialog(categorySet, null)
    open.value = true
    await settle()

    setTextField(nameInput(), 'work')
    setNumberField(roundsInput(), '1')
    await settle()

    expect(roundsInput().value).toBe('2')

    buttonLabelled('Add').click()
    await settle()

    const stored = (await db.categorySets.get(categorySet.id))!
    expect(stored.minDistances).toEqual([{ name: 'work', distance: 2 }])
  })

  it('refuses an entry with no round count and stores nothing', async () => {
    const categorySet = makeSet([])
    await db.categorySets.add(categorySet)

    const { open } = mountDialog(categorySet, null)
    open.value = true
    await settle()

    setTextField(nameInput(), 'work')
    await settle()

    buttonLabelled('Add').click()
    await settle()

    expect(open.value).toBe(true)

    const stored = (await db.categorySets.get(categorySet.id))!
    expect(stored.minDistances).toEqual([])
  })
})
