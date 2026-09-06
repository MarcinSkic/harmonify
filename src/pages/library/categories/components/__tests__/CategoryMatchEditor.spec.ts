import type { VueWrapper } from '@vue/test-utils'
import type { Ref } from 'vue'
import type { CategoryMatch } from '@/db/schemas'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { db } from '@/db'
import { LibraryOverlayService } from '@/services'
import CategoryMatchEditor from '../CategoryMatchEditor.vue'

let wrapper: VueWrapper | null = null

/**
 * A plain `ref` host, exactly like `CategoryEditDialog`'s `match`: the deep wrapping it applies on
 * assignment is what made the editor's two-way sync loop, so a shallower harness would hide the bug.
 */
function mountEditor(initial: CategoryMatch | null): { match: Ref<CategoryMatch | null>, w: VueWrapper } {
  const match = ref<CategoryMatch | null>(initial)

  const Host = defineComponent({
    setup() {
      return () => h(CategoryMatchEditor, {
        'modelValue': match.value,
        'onUpdate:modelValue': (value: CategoryMatch | null) => (match.value = value),
      })
    },
  })

  wrapper = mount(Host, { attachTo: document.body })
  return { match, w: wrapper }
}

function fieldInput(w: VueWrapper, rowIndex = 0) {
  return w.findAll('input')[rowIndex * 2]
}

function valueInput(w: VueWrapper, rowIndex = 0) {
  return w.findAll('input')[rowIndex * 2 + 1]
}

function removeButtons(w: VueWrapper) {
  return w.findAll('button').filter(button => button.classes().includes('size-9'))
}

/**
 * Both suggestion sources reach the editor through IndexedDB — the overlay scan it awaits on mount
 * and the registry's `liveQuery` subscription — and neither settles within microtasks alone.
 */
async function settleSuggestions() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, 20))
  await flushPromises()
}

beforeEach(async () => {
  setActivePinia(createPinia())
  await db.trackOverlays.clear()
  await db.overlayFields.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('editing a condition value', () => {
  it('keeps every character typed after the row first became valid', async () => {
    const { match, w } = mountEditor(null)

    await fieldInput(w).setValue('decade')

    // Typing character by character: the first one completes the row, and every one after it used
    // to be swallowed by the rebuild the emitted model triggered.
    for (const typed of ['2', '20', '202', '2020']) {
      await valueInput(w).setValue(typed)
      await w.vm.$nextTick()
    }

    expect(valueInput(w).element.value).toBe('2020')
    expect(match.value).toEqual({ all: [{ is: { decade: '2020' } }] })
  })

  it('reports an incomplete row as no predicate at all', async () => {
    const { match, w } = mountEditor(null)

    await fieldInput(w).setValue('decade')
    await w.vm.$nextTick()

    expect(match.value).toBeNull()
    expect(w.text()).toContain('Enter a value')
  })
})

describe('adding and removing rows', () => {
  it('settles without a recursive update loop when an empty row is added and removed again', async () => {
    const { match, w } = mountEditor({ all: [{ is: { popularity: '3' } }] })

    await w.get('button.w-fit').trigger('click')
    await w.vm.$nextTick()
    expect(removeButtons(w)).toHaveLength(2)
    expect(match.value).toBeNull()

    await removeButtons(w).at(-1)!.trigger('click')
    await expect(w.vm.$nextTick()).resolves.toBeUndefined()

    expect(removeButtons(w)).toHaveLength(1)
    expect(match.value).toEqual({ all: [{ is: { popularity: '3' } }] })
  })

  it('leaves one empty row behind when the last row is removed', async () => {
    const { match, w } = mountEditor({ all: [{ is: { popularity: '3' } }] })

    await removeButtons(w).at(0)!.trigger('click')
    await w.vm.$nextTick()

    expect(removeButtons(w)).toHaveLength(1)
    expect(fieldInput(w).element.value).toBe('')
    expect(match.value).toBeNull()
  })
})

describe('field suggestions', () => {
  it('suggests a field an overlay import wrote without registering it', async () => {
    await LibraryOverlayService.setCustomField({ musicBrainzId: 'mbid-1', title: 'A' }, 'popularity', '3')

    const { w } = mountEditor(null)
    await settleSuggestions()

    await fieldInput(w).setValue('popular')
    await fieldInput(w).trigger('focus')
    await w.vm.$nextTick()

    expect(w.text()).toContain('popularity')
  })

  it('suggests a field the registry knows even when no overlay carries a value for it', async () => {
    await LibraryOverlayService.upsertOverlayField('mood', 'text')

    const { w } = mountEditor(null)
    await settleSuggestions()

    await fieldInput(w).setValue('moo')
    await fieldInput(w).trigger('focus')
    await w.vm.$nextTick()

    expect(w.text()).toContain('mood')
  })
})
