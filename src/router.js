import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from './stores/auth'

const routes = [
  {
    path: '/',
    component: () => import('./views/LandingView.vue'),
  },
  {
    path: '/auth',
    component: () => import('./views/AuthView.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/onboarding',
    component: () => import('./views/OnboardingView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/dashboard',
    component: () => import('./views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    component: () => import('./views/ProfileView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/gigs/new',
    component: () => import('./views/CreateGigView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/join',
    component: () => import('./views/JoinGigView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/gigs/:id',
    component: () => import('./views/GigView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/gigs/:id/summary',
    component: () => import('./views/SummaryView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/gigs/:gigId/songs/:songId/arrangement',
    component: () => import('./views/ArrangementView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/folders/:id',
    component: () => import('./views/FolderView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const hasDisplayName = () => {
    const profileName = authStore.profile?.display_name?.trim?.()
    const metaName = authStore.user?.user_metadata?.display_name?.trim?.()
    return Boolean(profileName || metaName)
  }

  // Wait for auth to initialize before guarding (watcher-based, no polling)
  if (authStore.loading) {
    await new Promise((resolve) => {
      const stop = watch(
        () => authStore.loading,
        (loading) => {
          if (!loading) {
            stop()
            resolve()
          }
        }
      )
    })
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { path: '/', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    return { path: '/dashboard' }
  }
  // Redirect to onboarding only after one fresh profile check.
  if (authStore.isAuthenticated && to.path !== '/onboarding') {
    if (!hasDisplayName()) {
      try {
        await authStore.fetchProfile()
      } catch {
        // Ignore and fall back to existing guard behavior below.
      }
    }
    if (!hasDisplayName()) {
      return { path: '/onboarding' }
    }
  }
})

export default router
