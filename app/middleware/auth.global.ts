export default defineNuxtRouteMiddleware(async (to) => {
  const { token, user, fetchMe } = useAuth()

  if (!token.value) {
    return to.path === '/login' ? undefined : navigateTo('/login')
  }
  if (!user.value) await fetchMe()
  if (!token.value) return to.path === '/login' ? undefined : navigateTo('/login')
  if (to.path === '/login') return navigateTo('/')
})
