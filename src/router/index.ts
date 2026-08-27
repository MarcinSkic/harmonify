import type { RouteLocationNormalized } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { toast } from 'vue-sonner'
import { db } from '@/db'
import { useConnectionStore, useGameDataStore, useNavidromeStore } from '@/stores'

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
      path: '/local',
      component: () => import('@/pages/local/layout/LocalGameLayout.vue'),
      children: [
        {
          path: 'setup',
          name: 'localSetup',
          component: () => import('@/pages/local/setup/LocalSetupView.vue'),
        },
        {
          path: ':id/round',
          name: 'localRound',
          beforeEnter: beforeLocalGameEnter,
          component: () => import('@/pages/local/round/LocalRoundView.vue'),
        },
        {
          path: ':id/result',
          name: 'localResult',
          beforeEnter: beforeLocalGameEnter,
          component: () => import('@/pages/local/result/LocalResultView.vue'),
        },
      ],
    },
    {
      path: '/results',
      name: 'results',
      component: () => import('@/pages/results/GameResultsView.vue'),
    },
    {
      path: '/results/:id',
      name: 'resultDetail',
      component: () => import('@/pages/results/GameResultDetailView.vue'),
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/pages/library/LibraryView.vue'),
    },
    {
      path: '/library/categories',
      name: 'libraryCategories',
      component: () => import('@/pages/library/categories/CategoriesView.vue'),
    },
    {
      path: '/library/category-sets',
      name: 'categorySets',
      component: () => import('@/pages/library/categories/CategorySetsView.vue'),
    },
    {
      path: '/navidrome',
      name: 'navidrome',
      component: () => import('@/pages/navidrome/NavidromeLibraryView.vue'),
      beforeEnter: beforeNavidromeEnter,
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

async function beforeNavidromeEnter() {
  const navidromeStore = useNavidromeStore()

  if (navidromeStore.isConnected)
    return

  // On a page reload the guard runs before the application-wide session check, so it waits for it
  // instead of bouncing a perfectly valid session back to home.
  if (navidromeStore.session && await navidromeStore.verifySession() === 'connected')
    return

  toast.error('Connect to Navidrome to browse its library')
  navidromeStore.openConnectDialog()

  return { name: 'home' }
}

async function beforeLocalGameEnter(to: RouteLocationNormalized) {
  const gameId = to.params.id.toString()
  const game = await db.localGames.get(gameId)

  if (!game)
    return { name: 'localSetup' }
}

export default router
