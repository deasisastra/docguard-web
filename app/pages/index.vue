<script setup lang="ts">
const { api } = useApi()

const file = ref<File | null>(null)
const previewBase = ref('')
const amount = ref('')
const currency = ref('')
const currencies = ['IDR', 'USD', 'EUR', 'JPY', 'CNY', 'SGD', 'GBP', 'AUD', 'MYR', 'HKD', 'CHF', 'THB']
const useDate = ref(todayISO())
const loading = ref(false)
const error = ref('')
const results = ref<any[]>([])
const notice = ref<{ open: boolean; kind: 'success' | 'error'; title: string; message?: string; detail?: string; actionLabel?: string }>({
  open: false, kind: 'success', title: '',
})
async function goResult() {
  notice.value.open = false
  await nextTick()
  document.getElementById('hasil-terbaru')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const elapsed = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

// Kunci pencegah unggah ganda: berkas + data transaksi yang sudah berhasil dikirim.
// Tombol aktif lagi bila berkas diganti ATAU nominal/mata uang/tanggal berubah
// (invoice yang sama boleh dipakai bertahap dengan nominal berbeda).
const sentKey = ref('')
const currentKey = computed(() => {
  if (!file.value) return ''
  const f = file.value
  const amt = amount.value.replace(/\s/g, '').replace(',', '.')
  return [f.name, f.size, f.lastModified, currency.value, amt, useDate.value].join('|')
})
const alreadySent = computed(() => !!currentKey.value && currentKey.value === sentKey.value)

// toolbar dan panel thumbnail disembunyikan, halaman dipas selebar bingkai
const previewUrl = computed(() => (previewBase.value ? `${previewBase.value}#toolbar=0&navpanes=0&view=FitH` : ''))

onBeforeUnmount(() => {
  if (previewBase.value) URL.revokeObjectURL(previewBase.value)
  if (timer) clearInterval(timer)
})

function onFile(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
  error.value = ''
  if (previewBase.value) URL.revokeObjectURL(previewBase.value)
  previewBase.value = file.value ? URL.createObjectURL(file.value) : ''
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function poll(id: number) {
  for (let i = 0; i < 90; i++) {
    const res = await api(`/documents/${id}`)
    const d = res.data ?? res
    const done = d.risk?.status || d.error || ['failed', 'error'].includes(d.status)
    if (done) return d
    await wait(1000)
  }
  throw new Error('Pemrosesan terlalu lama. Pastikan "php artisan queue:work" berjalan.')
}

async function submit() {
  if (loading.value) return   // cegah klik ganda / Enter saat masih memeriksa
  error.value = ''
  const amt = amount.value.replace(/\s/g, '').replace(',', '.')
  if (!file.value) return (error.value = 'Pilih berkas PDF dulu.')
  if (!/^\d+(\.\d{1,2})?$/.test(amt)) return (error.value = 'Nominal harus angka, contoh 5000 atau 5000.50.')
  if (!currency.value) return (error.value = 'Pilih mata uang transaksi.')
  if (alreadySent.value) {
    return (error.value = 'Dokumen ini sudah diunggah. Ganti berkas, atau ubah nominal, mata uang, atau tanggal transaksi untuk mengunggah lagi.')
  }

  const key = currentKey.value
  const body = new FormData()
  body.append('file', file.value)
  body.append('requested_amount', amt)
  body.append('use_date', useDate.value)
  body.append('requested_currency', currency.value)

  loading.value = true
  elapsed.value = 0
  timer = setInterval(() => elapsed.value++, 1000)
  try {
    const res = await api('/documents', { method: 'POST', body })
    const created = res.data ?? res
    sentKey.value = key   // unggahan diterima server: kunci tombol
    const doc = await poll(created.id)
    results.value.unshift(doc)
    if (doc.status === 'failed' || doc.error) {
      sentKey.value = ''   // gagal dibaca: boleh coba lagi
      notice.value = {
        open: true, kind: 'error', title: 'Dokumen gagal diperiksa',
        message: doc.original_name, detail: doc.error ?? 'Dokumen tidak dapat dibaca.',
      }
    } else {
      notice.value = {
        open: true, kind: 'success', title: 'Dokumen selesai diunggah',
        message: `${doc.original_name} sudah diunggah dan diperiksa.`,
        detail: doc.risk ? `Hasil: ${statusLabel[doc.risk.status]}` : undefined,
        actionLabel: 'Lihat hasil',
      }
    }
  } catch (e: any) {
    notice.value = {
      open: true, kind: 'error', title: 'Gagal mengunggah',
      message: e?.data?.message ?? e?.message ?? 'Terjadi kesalahan. Coba lagi.',
    }
  } finally {
    loading.value = false
    if (timer) clearInterval(timer)
  }
}
</script>

<template>
  <AppHeader />
  <NoticeDialog v-bind="notice" @close="notice.open = false" @action="goResult" />

  <main style="max-width: 1100px; margin: 32px auto; padding: 0 16px; display: grid; gap: 24px">
    <div>
      <h1 style="margin: 0 0 4px">Periksa dokumen underlying</h1>
      <p class="muted" style="margin: 0">Unggah invoice PDF. Sistem membaca, mengenali invoice yang sama, dan menghitung sisa nominalnya.</p>
    </div>

    <form class="card upload" @submit.prevent="submit">
      <div class="filefield">
        <span class="lbl">Berkas invoice (PDF)</span>
        <label for="f" class="drop" :class="{ has: file }">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
          </svg>
          <span v-if="file" class="fname">{{ file.name }}</span>
          <span v-else class="hint">Klik untuk memilih berkas PDF</span>
          <span class="pick">{{ file ? 'Ganti berkas' : 'Pilih berkas' }}</span>
        </label>
        <input id="f" class="sr" type="file" accept="application/pdf" @change="onFile" />
      </div>

      <div class="formrow">
        <div>
          <label for="cur">Mata uang</label>
          <select id="cur" v-model="currency">
            <option value="" disabled>Pilih</option>
            <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div>
          <label for="a">Nominal transaksi</label>
          <input id="a" v-model="amount" inputmode="decimal" placeholder="Contoh: 5000" />
        </div>
        <div>
          <label for="d">Tanggal transaksi</label>
          <input id="d" v-model="useDate" type="date" />
        </div>
        <button class="btn" :disabled="loading || alreadySent">
          {{ loading ? `Memeriksa… ${elapsed}s` : alreadySent ? 'Sudah diunggah' : 'Unggah dan periksa' }}
        </button>
      </div>

      <p v-if="alreadySent && !loading" class="muted" style="margin: 0" role="status">
        Dokumen ini sudah diunggah. Ganti berkas, atau ubah nominal, mata uang, atau tanggal transaksi untuk mengunggah lagi.
      </p>

      <div v-if="previewUrl" class="preview">
        <div class="pv-frame">
          <div class="pv-bar">
            <span class="pv-name">{{ file?.name }}</span>
            <a :href="previewBase" target="_blank" rel="noopener">Buka di tab baru</a>
          </div>
          <iframe :src="previewUrl" title="Pratinjau PDF" />
        </div>
        <aside class="pv-tips">
          <h3>Cek sebelum unggah</h3>
          <ul>
            <li>Halaman lurus dan tidak terpotong.</li>
            <li>Total, nomor invoice, dan tanggal terbaca jelas.</li>
            <li>Tidak buram, tanpa bayangan. Pindaian 300 dpi paling baik.</li>
            <li>Bahasa Indonesia atau Inggris.</li>
          </ul>
        </aside>
      </div>

      <p v-if="loading" class="muted" style="margin: 0">
        Sedang membaca dokumen. Pindaian kertas bisa memakan waktu sekitar satu menit.
      </p>
      <p class="muted" style="margin: 0">
        Hanya PDF. Berkas yang sama boleh diunggah lagi untuk pemakaian bertahap, dengan nominal atau tanggal transaksi yang berbeda.
      </p>
      <div v-if="error" class="error" role="alert">{{ error }}</div>
    </form>

    <div v-if="results.length" class="rhead">
      <h2 style="margin: 0; font-size: 18px">Hasil sesi ini ({{ results.length }})</h2>
      <NuxtLink to="/riwayat" style="font-weight: 600">Lihat semua riwayat →</NuxtLink>
    </div>
    <ResultCard v-for="(d, i) in results" :id="i === 0 ? 'hasil-terbaru' : undefined" :key="d.id" :doc="d" :open="i === 0" />
  </main>
</template>

<style scoped>
.preview { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
.pv-frame { border: 1px solid #D9DEE7; border-radius: 10px; overflow: hidden; background: #EEF1F6; }
.pv-bar { display: flex; justify-content: space-between; gap: 12px; padding: 10px 14px; background: #fff; border-bottom: 1px solid #D9DEE7; font-size: 13px; }
.pv-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-frame iframe { display: block; width: 100%; height: 600px; border: 0; background: #EEF1F6; }
.pv-tips { background: #F8FAFC; border-radius: 10px; padding: 16px 18px; font-size: 14px; }
.pv-tips h3 { margin: 0 0 8px; font-size: 14px; }
.pv-tips ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: #4B5563; }
.rhead { display: flex; justify-content: space-between; align-items: center; }
@media (max-width: 900px) {
  .formrow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .formrow .btn { grid-column: 1 / -1; }
}
</style>
