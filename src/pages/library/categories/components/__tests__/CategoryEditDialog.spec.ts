import type { VueWrapper } from '@vue/test-utils'
import type { Ref } from 'vue'
import type { Category } from '@/db/schemas'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { db } from '@/db'
import CategoryEditDialog from '../CategoryEditDialog.vue'

let wrapper: VueWrapper | null = null

interface Harness {
  open: Ref<boolean>
  editing: Ref<Category | null>
}

/** Mirrors how `CategoriesView` drives the dialog: an `open` flag and the category being edited. */
function mountDialog(): Harness {
  const open = ref(false)
  const editing = shallowRef<Category | null>(null)

  const Host = defineComponent({
    setup() {
      return () => h(CategoryEditDialog, {
        'open': open.value,
        'category': editing.value,
        'onUpdate:open': (value: boolean) => (open.value = value),
      })
    },
  })

  wrapper = mount(Host, { attachTo: document.body })
  return { open, editing }
}

/** The dialog content is teleported, so it is read off the document rather than off the wrapper. */
function inputs(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input')]
}

/**
 * The predicate editor's own inputs, told apart from the name/description/points ones by their
 * placeholders — the operator decides how many a row renders.
 */
const CONDITION_PLACEHOLDERS = ['Field', 'Value', 'Number', 'From', 'To']

function conditionInputs(): HTMLInputElement[] {
  return inputs().filter(input => CONDITION_PLACEHOLDERS.includes(input.placeholder))
}

function type(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input'))
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

function storedCategory(displayName: string, tagValue: string): Category {
  return {
    id: crypto.randomUUID(),
    displayName,
    match: { all: [{ is: { grouping: tagValue } }] },
    createdAt: Date.now(),
  }
}

beforeEach(async () => {
  setActivePinia(createPinia())
  await db.categories.clear()
  await db.trackOverlays.clear()
  await db.overlayFields.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('saving a new category', () => {
  it('closes the dialog and stores the whole condition value', async () => {
    const { open, editing } = mountDialog()

    editing.value = null
    open.value = true
    await settle()

    type(inputs().find(input => input.id === 'category-display-name')!, 'Decade')
    type(conditionInputs()[0], 'decade')
    for (const typed of ['2', '20', '202', '2020'])
      type(conditionInputs()[1], typed)
    await settle()

    buttonLabelled('Create').click()
    await settle()

    expect(open.value).toBe(false)
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    const stored = await db.categories.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0].match).toEqual({ all: [{ is: { decade: '2020' } }] })
  })
})

describe('reopening the dialog', () => {
  it('starts from the conditions of the category being opened', async () => {
    const first = storedCategory('Openings', 'op')
    const second = storedCategory('Endings', 'ed')
    await db.categories.bulkAdd([first, second])

    const { open, editing } = mountDialog()

    editing.value = first
    open.value = true
    await settle()
    expect(conditionInputs().map(input => input.value)).toEqual(['grouping', 'op'])

    open.value = false
    await settle()

    editing.value = second
    open.value = true
    await settle()
    expect(conditionInputs().map(input => input.value)).toEqual(['grouping', 'ed'])
  })

  it('starts empty on a second "Add category" after an incomplete row was left behind', async () => {
    const { open, editing } = mountDialog()

    editing.value = null
    open.value = true
    await settle()

    // Incomplete: the field alone leaves `match` null, so the dialog's reset writes null over null.
    type(conditionInputs()[0], 'grouping')
    await settle()

    open.value = false
    await settle()

    open.value = true
    await settle()

    expect(conditionInputs().map(input => input.value)).toEqual(['', ''])
  })
})
