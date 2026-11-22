export function useOpenPdf() {
  const { api } = useApi()
  return async (id: number) => {
    const w = window.open('', '_blank')
    try {
      const blob = await api(`/documents/${id}/file`, { responseType: 'blob' })
      if (w) w.location.href = URL.createObjectURL(blob as Blob)
    } catch {
      w?.close()
      alert('Berkas PDF tidak dapat dibuka.')
    }
  }
}
