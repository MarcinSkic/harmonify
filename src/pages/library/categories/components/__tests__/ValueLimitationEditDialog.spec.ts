import type { VueWrapper } from '@vue/test-utils'
import type { Ref } from 'vue'
import type { CategorySet, FieldLimitation } from '@/db/schemas'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { db } from '@/db'
import ValueLimitationEditDialog from '../ValueLimitationEditDialog.vue'

let wrapper: VueWrapper | null = null

interface Harness {
  open: Ref<boolean>
  limitation: Ref<FieldLimitation | null>
}

/** Mirrors how `CategorySetCard` drives the dialog: an `open` flag and the entry being edited. */
function mountDialog(categorySet: CategorySet, initial: FieldLimitation | null): Harness {
  const open = ref(false)
  const limitation = shallowRef<FieldLimitation | null>(initial)

  const Host = defineComponent({
    setup() {
      return () => h(ValueLimitationEditDialog, {
        'open': open.value,
        'categorySet': categorySet,
        'limitation': limitation.value,
        'onUpdate:open': (value: boolean) => (open.value = value),
      })
    },
  })

  wrapper = mount(Host, { attachTo: document.body })
  return { open, limitation }
}

/** The dialog content is teleported, so it is read off the document rather than off the wrapper. */
function inputs(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input')]
}

function selfLimitInput(): HTMLInputElement {
  const input = inputs().find(candidate => candidate.id === 'limitation-self-limit')
  if (!input)
    throw new Error('No self-limit input in the dialog')
  return input
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

beforeEach(async () => {
  setActivePinia(createPinia())
  await db.categorySets.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('editing an entry that carries exceptions', () => {
  it('keeps exceptions untouched and leaves the other limitation alone when only selfLimit changes', async () => {
    const workLimitation: FieldLimitation = {
      name: 'work',
      selfLimit: 3,
      exceptions: [{ value: 'Puella Magi Madoka Magica', selfLimit: 5 }],
    }
    const albumLimitation: FieldLimitation = { name: 'album', selfLimit: 2 }

    const categorySet: CategorySet = {
      id: crypto.randomUUID(),
      name: 'Konkurs',
      valueLimitations: [workLimitation, albumLimitation],
      minDistances: [],
      createdAt: 1,
    }
    await db.categorySets.add(categorySet)

    const { open } = mountDialog(categorySet, workLimitation)
    open.value = true
    await settle()

    expect(selfLimitInput().value).toBe('3')

    setNumberField(selfLimitInput(), '2')
    await settle()

    buttonLabelled('Save').click()
    await settle()

    expect(open.value).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    const stored = (await db.categorySets.get(categorySet.id))!
    const savedWork = stored.valueLimitations.find(l => l.name === 'work')!
    expect(savedWork.selfLimit).toBe(2)
    expect(savedWork.exceptions).toEqual(workLimitation.exceptions)

    const savedAlbum = stored.valueLimitations.find(l => l.name === 'album')!
    expect(savedAlbum).toEqual(albumLimitation)
  })
})
