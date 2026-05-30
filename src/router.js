import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from './stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
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
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

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
    return { path: '/auth', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    return { path: '/dashboard' }
  }
  // Redirect to onboarding if authenticated but profile not yet set up
  if (
    authStore.isAuthenticated &&
    !authStore.profile?.display_name &&
    to.path !== '/onboarding'
  ) {
    return { path: '/onboarding' }
  }
})

export default router
