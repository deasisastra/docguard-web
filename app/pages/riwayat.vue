<script setup lang="ts">
const { api } = useApi()
const { user } = useAuth()
const openPdf = useOpenPdf()

const q = ref('')
const risk = ref('')
const confirmed = ref('')
const from = ref('')
const to = ref('')
const page = ref(1)
const rows = ref<any[]>([])
const meta = ref<any>(null)
const loading = ref(false)
const error = ref('')
let t: ReturnType<typeof setTimeout> | null = null

// hapus dokumen
const target = ref<any | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const flash = ref('')
let flashTimer: ReturnType<typeof setTimeout> | null = null

async function load() {
  loading.value = true
  error.value = ''
  const p = new URLSearchParams({ page: String(page.value) })
  if (q.value) p.set('q', q.value)
  if (risk.value) p.set('risk', risk.value)
  if (confirmed.value) p.set('confirmed', confirmed.value)
  if (from.value) p.set('from', from.value)
  if (to.value) p.set('to', to.value)
  try {
    const r = await api(`/history?${p}`)
    rows.value = r.data
    meta.value = r.meta
  } catch {
    error.value = 'Riwayat gagal dimuat.'
  } finally {
    loading.value = false
  }
}

function reset() {
  q.value = risk.value = confirmed.value = from.value = to.value = ''
}

function askDelete(d: any) {
  deleteError.value = ''
  target.value = d
}

function cancelDelete() {
  if (!deleting.value) target.value = null
}

async function doDelete() {
  if (!target.value || deleting.value) return
  const doc = target.value
  deleting.value = true
  deleteError.value = ''
  try {
    await api(`/documents/${doc.id}`, { method: 'DELETE' })
    target.value = null
    // halaman terakhir yang kosong: mundur satu halaman
    if (rows.value.length === 1 && page.value > 1) page.value--
    await load()
    flash.value = `Dokumen #${doc.id} (${doc.original_name}) sudah dihapus.`
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => (flash.value = ''), 5000)
  } catch (e: any) {
    deleteError.value = e?.data?.message ?? 'Dokumen gagal dihapus. Coba lagi.'
  } finally {
    deleting.value = false
  }
}

watch([risk, confirmed, from, to], () => { page.value = 1; load() })
watch(q, () => {
  if (t) clearTimeout(t)
  t = setTimeout(() => { page.value = 1; load() }, 350)
})
onMounted(load)
onBeforeUnmount(() => {
  if (t) clearTimeout(t)
  if (flashTimer) clearTimeout(flashTimer)
})
</script>

<template>
  <AppHeader />

  <ConfirmDialog
    :open="!!target"
    title="Hapus dokumen ini?"
    message="Apakah Anda yakin akan menghapus dokumen ini? Tindakan ini tidak dapat dibatalkan."
    :detail="target ? `${target.original_name} · #${target.id}` : ''"
    confirm-label="Ya, hapus"
    cancel-label="Tidak"
    :busy="deleting"
    :error="deleteError"
    @confirm="doDelete"
    @cancel="cancelDelete"
  />

  <main class="page">
    <div>
      <h1 style="margin: 0 0 4px">Riwayat pemeriksaan</h1>
      <p class="muted" style="margin: 0">
        {{ user?.is_admin ? 'Semua dokumen.' : 'Dokumen yang kamu unggah.' }} Cari berdasarkan nama berkas, nomor invoice, atau penerbit.
      </p>
    </div>

    <form class="card filters" @submit.prevent="load">
      <div class="wide">
        <label for="q">Cari</label>
        <input id="q" v-model="q" type="search" placeholder="Nama berkas, nomor invoice, atau penerbit" />
      </div>
      <div>
        <label for="r">Status</label>
        <select id="r" v-model="risk">
          <option value="">Semua</option>
          <option value="green">Hijau</option>
          <option value="yellow">Kuning</option>
          <option value="red">Merah</option>
        </select>
      </div>
      <div>
        <label for="c">Konfirmasi</label>
        <select id="c" v-model="confirmed">
          <option value="">Semua</option>
          <option value="no">Belum diputuskan</option>
          <option value="yes">Sudah dikonfirmasi</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>
      <div>
        <label for="f">Dari tanggal</label>
        <input id="f" v-model="from" type="date" />
      </div>
      <div>
        <label for="t">Sampai tanggal</label>
        <input id="t" v-model="to" type="date" />
      </div>
      <button type="button" class="btn secondary" @click="reset">Atur ulang</button>
    </form>

    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <div v-if="flash" class="flash" role="status">{{ flash }}</div>

    <section class="card list">
      <p class="muted" style="margin: 0">
        <template v-if="loading">Memuat…</template>
        <template v-else-if="meta">{{ meta.total }} dokumen ditemukan</template>
      </p>

      <p v-if="!loading && !rows.length" class="muted">Tidak ada dokumen yang cocok dengan filter.</p>

      <article v-for="d in rows" :key="d.id" class="row">
        <div class="main">
          <strong>{{ d.original_name }}</strong>
          <span class="muted">#{{ d.id }} · {{ fmtDateTime(d.uploaded_at) }}</span>
        </div>
        <div class="inv">
          <span>{{ d.fields?.doc_number ?? '-' }}</span>
          <span class="muted">{{ d.fields?.sender ?? '-' }}</span>
        </div>
        <div class="amt">
          <span>{{ money(d.request?.requested_amount, d.request?.requested_currency ?? d.invoice?.currency) }}</span>
          <span class="muted">permintaan</span>
        </div>
        <div class="state">
          <span class="chip" :class="d.risk?.status ?? 'red'">{{ d.risk ? statusShort[d.risk.status] : 'Gagal' }}</span>
          {{ d.confirmed_at ? 'Terkonfirmasi' : d.rejected_at ? 'Ditolak' : 'Belum diputuskan' }}
        </div>
        <div class="act">
          <button type="button" class="btn secondary" style="height: 36px" @click="openPdf(d.id)">PDF</button>
          <!-- dokumen terkonfirmasi sudah tercatat di ledger, jadi tidak bisa dihapus -->
          <button v-if="!d.confirmed_at" type="button" class="btn danger" style="height: 36px" @click="askDelete(d)">Hapus</button>
          <span v-else class="slot" />
          <NuxtLink :to="`/documents/${d.id}`" class="lnk">{{ user?.is_admin && !d.confirmed_at && !d.rejected_at ? 'Periksa' : 'Detail' }}</NuxtLink>
        </div>
      </article>

      <div v-if="meta && meta.last_page > 1" class="pager">
        <button class="btn secondary" :disabled="page <= 1 || loading" @click="page--; load()">← Sebelumnya</button>
        <span class="muted">Halaman {{ meta.current_page }} dari {{ meta.last_page }}</span>
        <button class="btn secondary" :disabled="page >= meta.last_page || loading" @click="page++; load()">Berikutnya →</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* main adalah grid: kolomnya harus boleh menyempit (minmax(0, 1fr)), kalau tidak halaman melebar mengikuti isi */
.page { max-width: 1100px; margin: 32px auto; padding: 0 16px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }

.filters { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; }
.filters > div { min-width: 0; }

.flash { padding: 10px 14px; border-radius: 10px; background: #E3F4EA; color: #14532D; font-size: 14px; font-weight: 600; }

.list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
.row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1.6fr) minmax(0, 1.1fr) minmax(0, 1.2fr) 260px; gap: 16px; align-items: center; padding: 14px 4px; border-top: 1px solid #E5E9F0; }
.row > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 14px; }
.row .main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .inv span, .row .amt span { overflow: hidden; text-overflow: ellipsis; }

.row .state { align-items: center; text-align: center; }
.act { flex-direction: row !important; align-items: center; justify-content: flex-end; gap: 10px !important; }
.lnk { font-weight: 600; display: inline-block; width: 56px; text-align: right; }
.slot { display: inline-block; width: 66px; }

.chip { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.chip.green { background: #E3F4EA; color: #14532D; }
.chip.yellow { background: #FFF1CC; color: #6B3F06; }
.chip.red { background: #FDE2E2; color: #7F1D1D; }

.pager { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #E5E9F0; }

/* Tablet dan ponsel */
@media (max-width: 900px) {
  .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filters .wide, .filters > .btn { grid-column: 1 / -1; }

  /* baris 1: nama berkas | baris 2: invoice dan nominal | baris 3: status dan tombol */
  .row { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 10px; }
  .row .main { grid-column: 1 / -1; }
  .row .state { align-items: flex-start; text-align: left; }
  .row .act { justify-content: flex-end; }
  .lnk { width: auto; text-align: left; }
  .slot { display: none; }
}

/* Ponsel kecil */
@media (max-width: 480px) {
  .page { margin: 20px auto; }
  .filters, .list { padding: 16px; }
  .pager { flex-wrap: wrap; justify-content: center; gap: 8px; }
}
</style>
