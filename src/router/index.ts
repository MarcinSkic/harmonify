import type { RouteLocationNormalized } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { useConnectionStore, useGameDataStore } from '@/stores'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/pages/home/HomeView.vue'),
    },
    {
      path: '/game',
      component: () => import('@/pages/game/layout/GameLayout.vue'),
      beforeEnter: beforeGameEnter,
      children: [
        {
          path: ':id/setup',
          name: 'setup',
          component: () => import('@/pages/game/setup/SetupView.vue'),

        },
        {
          path: ':id',
          name: 'round',
          component: () => import(`@/pages/game/round/RoundView.vue`),
        },
        {
          path: ':id/roundResult',
          name: 'roundResult',
          component: () => import(`@/pages/game/roundResult/RoundResultView.vue`),
        },
        {
          path: ':id/result',
          name: 'result',
          component: () => import(`@/pages/game/result/ResultView.vue`),
        },
      ],
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/pages/library/LibraryView.vue'),
    },
    {
      path: '/cover',
      name: 'cover',
      component: () => import(`@/pages/cover/CoverCreatorView.vue`),
    },
    {
      path: '/disclaimer',
      name: 'disclaimer',
      component: () => import(`@/pages/disclaimer/DisclaimerView.vue`),
    },
  ],
})

async function beforeGameEnter(to: RouteLocationNormalized) {
  const connectionStore = useConnectionStore()

  if (connectionStore.ws)
    return

  const gameDataStore = useGameDataStore()
  const roomId = to.params.id.toString()

  try {
    await new Promise<void>((resolve, reject) => {
      connectionStore.openConnection(`/game/${roomId}`, {
        handleOpen() {},
        handleError() {
          reject(new Error('Couldn\'t connect to server'))
        },
        handleMessage(message) {
          if (message.$type === 'message/playerInfoDto') {
            gameDataStore.joinGame(roomId, message.data)
            resolve()
          }
        },
      })
    })

    return { name: 'setup', params: to.params }
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (e) {
    return { name: 'home' }
  }
}

export default router
