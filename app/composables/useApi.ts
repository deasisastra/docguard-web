export const useApi = () => {
  const { token, logout } = useAuth()
  const base = useRuntimeConfig().public.apiBase

  async function api<T = any>(path: string, opts: Record<string, any> = {}): Promise<T> {
    try {
      return await $fetch<T>(`${base}${path}`, {
        ...opts,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token.value}`,
          ...(opts.headers ?? {}),
        },
      })
    } catch (e: any) {
      if ((e?.status ?? e?.statusCode) === 401) await logout()
      throw e
    }
  }
  return { api }
}
