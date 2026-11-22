export interface DgUser {
  id: number
  name: string
  email: string
  unit?: string | null
  is_admin: boolean
}

export const useAuth = () => {
  const token = useCookie<string | null>('dg_token', {
    maxAge: 60 * 60 * 8,
    sameSite: 'lax',
  })
  const user = useState<DgUser | null>('dg_user', () => null)
  const apiBase = useRuntimeConfig().public.apiBase

  async function login(email: string, password: string) {
    const res = await $fetch<any>(`${apiBase}/login`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: { email, password },
    })
    const t = res.token ?? res.access_token
    if (!t) throw new Error('Respons login tidak memuat token')
    token.value = t
    user.value = res.user ?? null
  }

  async function fetchMe() {
    if (!token.value) return null
    try {
      user.value = await $fetch<DgUser>(`${apiBase}/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token.value}` },
      })
    } catch {
      token.value = null
      user.value = null
    }
    return user.value
  }

  function logout() {
    token.value = null
    user.value = null
    return navigateTo('/login')
  }

  return { token, user, login, fetchMe, logout }
}
