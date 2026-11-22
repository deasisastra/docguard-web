<script setup lang="ts">
const route = useRoute()
const { api } = useApi()
const { user } = useAuth()

const id = Number(route.params.id)
const doc = ref<any>(null)
const loading = ref(true)
const loadError = ref('')

const pdfBase = ref('')
const pdfError = ref('')

const currencies = ['IDR', 'USD', 'EUR', 'JPY', 'CNY', 'SGD', 'GBP', 'AUD', 'MYR', 'HKD', 'CHF', 'THB']
const f = reactive({
  amount: '', currency: '', invoice_number: '', issuer: '',
  issue_date: '', due_date: '', invoice_choice: '', transaction_ref: '',
})
const saving = ref(false)
const rejecting = ref(false)
const reason = ref('')
const fixTotal = ref(false)
const fixReason = ref('')
const rejectError = ref('')
const problem = ref<{ message: string; reasons: { code: string; message: string }[] } | null>(null)
const notice = ref<{ open: boolean; kind: 'success' | 'error'; title: string; message?: string; detail?: string; actionLabel?: string }>({
  open: false, kind: 'success', title: '',
})

const inv = computed(() => doc.value?.invoice)
const candidates = computed<any[]>(() => inv.value?.candidates ?? [])
const isNear = computed(() => inv.value?.match_status === 'near')
const cur = computed(() => f.currency || inv.value?.currency || '')
const readOnly = computed(() => !user.value?.is_admin || !!doc.value?.confirmed_at || !!doc.value?.rejected_at)
const canSubmit = computed(() => !saving.value && !(isNear.value && !f.invoice_choice))

const verdictText: Record<string, string> = { same: 'sama persis', similar: 'mirip', different: 'berbeda' }

function fill(d: any) {
  f.amount = d.invoice?.amount_read ?? ''
  f.currency = d.invoice?.currency ?? ''
  f.invoice_number = d.fields?.doc_number ?? ''
  f.issuer = d.fields?.sender ?? ''
  f.issue_date = d.fields?.doc_date ?? ''
  f.due_date = d.invoice?.due_date ?? ''
}

async function loadPdf() {
  try {
    const blob = await api(`/documents/${id}/file`, { responseType: 'blob' })
    pdfBase.value = URL.createObjectURL(blob as Blob)
  } catch {
    pdfError.value = 'Berkas PDF tidak dapat dimuat.'
  }
}
const pdfUrl = computed(() => (pdfBase.value ? `${pdfBase.value}#toolbar=0&navpanes=0&view=FitH` : ''))

onMounted(async () => {
  try {
    const r = await api(`/documents/${id}`)
    doc.value = r.data ?? r
    fill(doc.value)
    loadPdf()
  } catch (e: any) {
    loadError.value = (e?.status ?? e?.statusCode) === 404 ? 'Dokumen tidak ditemukan.' : 'Dokumen gagal dimuat.'
  } finally {
    loading.value = false
  }
})
onBeforeUnmount(() => {
  if (pdfBase.value) URL.revokeObjectURL(pdfBase.value)
})

// Perkiraan hasil di layar. Keputusan resmi tetap dari server.
const cents = (v: any) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && String(v ?? '') !== '' ? Math.round(n * 100) : null
}
const hist = ref<any>(null)
async function loadHistory(invoiceId: string | null) {
  hist.value = null
  if (!invoiceId) return
  try {
    hist.value = await api(`/invoices/${invoiceId}/history`)
  } catch {
    hist.value = null
  }
}
const targetId = computed<string | null>(() => {
  if (isNear.value && !doc.value?.confirmed_at) {
    return f.invoice_choice && f.invoice_choice !== 'new' ? f.invoice_choice : null
  }
  return inv.value?.invoice_id ? String(inv.value.invoice_id) : null
})
watch(targetId, (v) => loadHistory(v), { immediate: true })

// Saldo invoice yang akan dipakai, dalam sen. Nilai sisa selalu terkini dari server.
const target = computed(() => {
  if (isNear.value && !doc.value?.confirmed_at) {
    if (!f.invoice_choice) return null
    if (f.invoice_choice === 'new') {
      const a = cents(f.amount)
      return a == null ? null : { total: a, used: 0, remaining: a }
    }
    const c = candidates.value.find((x) => String(x.invoice_id) === f.invoice_choice)
    return c ? { total: cents(c.total), used: cents(c.used), remaining: cents(c.remaining) } : null
  }
  if (inv.value?.match_status === 'exact') {
    const h = hist.value?.invoice
    return h
      ? { total: cents(h.total), used: cents(h.used), remaining: cents(h.remaining) }
      : { total: cents(inv.value.total), used: cents(inv.value.used), remaining: cents(inv.value.remaining) }
  }
  const a = cents(f.amount)
  return a == null ? null : { total: a, used: 0, remaining: a }
})

const outcome = computed(() => {
  const req = cents(doc.value?.request?.requested_amount)
  if (req == null) return null
  if (isNear.value && !f.invoice_choice) return { kind: 'pick' as const }
  const t = target.value
  if (!t || t.remaining == null) return null
  return {
    kind: (req > t.remaining ? 'over' : 'ok') as 'over' | 'ok',
    req, t, after: t.remaining - req, over: req - t.remaining,
  }
})
const m = (c: number | null | undefined) => (c == null ? '–' : money(c / 100, cur.value))

function fail(message: string, reasons: any[] = []) {
  problem.value = { message, reasons }
}

// Total invoice tercatat vs nominal yang diisi petugas
const totalDiff = computed(() => {
  if (doc.value?.confirmed_at || doc.value?.rejected_at) return null
  let recorded: number | null = null
  if (isNear.value) {
    if (!f.invoice_choice || f.invoice_choice === 'new') return null
    recorded = cents(candidates.value.find((c) => String(c.invoice_id) === f.invoice_choice)?.total)
  } else if (inv.value?.match_status === 'exact') {
    recorded = cents(inv.value.total)
  }
  const typed = cents(f.amount)
  if (recorded == null || typed == null || recorded === typed) return null
  return { recorded: recorded / 100, typed: typed / 100 }
})
watch(totalDiff, (v) => {
  if (!v) { fixTotal.value = false; fixReason.value = '' }
})

async function confirm() {
  problem.value = null
  const amount = f.amount.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return fail('Nominal harus angka, contoh 13215 atau 13215.50.')
  if (!f.transaction_ref.trim()) return fail('Isi nomor transaksi.')

  const body: Record<string, any> = { amount, transaction_ref: f.transaction_ref.trim() }
  for (const k of ['currency', 'invoice_number', 'issuer', 'issue_date', 'due_date', 'invoice_choice'] as const) {
    if ((f as any)[k]) body[k] = (f as any)[k]
  }

  if (fixTotal.value && totalDiff.value) {
    if (fixReason.value.trim().length < 5) return fail('Isi alasan koreksi total (minimal 5 karakter).')
    body.correct_total = true
    body.correction_reason = fixReason.value.trim()
  }
  saving.value = true
  try {
    const r = await api(`/documents/${id}/confirm`, { method: 'POST', body })
    doc.value = r.data ?? r
    notice.value = {
      open: true, kind: 'success', title: 'Pemakaian tercatat',
      message: 'Dokumen sudah dikonfirmasi.',
      detail: doc.value.invoice?.remaining_after != null
        ? `Sisa invoice sekarang ${money(doc.value.invoice.remaining_after, doc.value.invoice.currency)}`
        : undefined,
      actionLabel: 'Ke riwayat',
    }
  } catch (e: any) {
    const d = e?.data ?? {}
    const reasons = d.reasons
      ?? (d.errors ? Object.values(d.errors).flat().map((m: any) => ({ code: 'validation', message: String(m) })) : [])
    fail(d.message ?? 'Konfirmasi gagal.', reasons)
    notice.value = {
      open: true, kind: 'error', title: 'Konfirmasi ditolak',
      message: d.message ?? 'Konfirmasi gagal.', detail: 'Rincian ada di bagian atas formulir.',
    }
  } finally {
    saving.value = false
  }
}

function startReject() {
  rejecting.value = true
  rejectError.value = ''
  nextTick(() => document.getElementById('why')?.focus())
}

async function reject() {
  rejectError.value = ''
  problem.value = null
  if (reason.value.trim().length < 5) {
    rejectError.value = 'Alasan penolakan minimal 5 karakter.'
    return
  }
  saving.value = true
  try {
    const r = await api(`/documents/${id}/reject`, { method: 'POST', body: { reason: reason.value.trim() } })
    doc.value = r.data ?? r
    rejecting.value = false
    notice.value = {
      open: true, kind: 'success', title: 'Dokumen ditolak',
      message: 'Penolakan dan alasannya sudah tersimpan.', actionLabel: 'Ke riwayat',
    }
  } catch (e: any) {
    const d = e?.data ?? {}
    rejectError.value = d.message ?? 'Penolakan gagal.'
    notice.value = { open: true, kind: 'error', title: 'Penolakan gagal', message: d.message ?? 'Terjadi kesalahan.' }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppHeader />
  <NoticeDialog v-bind="notice" @close="notice.open = false" @action="navigateTo('/riwayat')" />

  <main class="wrap">
    <NuxtLink to="/riwayat" class="back">← Riwayat</NuxtLink>
    <h1>Periksa dan konfirmasi</h1>

    <p v-if="loading" class="muted">Memuat…</p>
    <div v-else-if="loadError" class="error" role="alert">{{ loadError }}</div>

    <p v-else-if="doc && !doc.risk" class="muted">
      Dokumen ini belum selesai diproses atau gagal dibaca. Muat ulang beberapa saat lagi.
    </p>

    <!-- baca saja -->
    <template v-else-if="doc && readOnly">
      <p class="muted" style="margin: 0 0 16px">
        <template v-if="doc.confirmed_at">Sudah dikonfirmasi pada {{ fmtDateTime(doc.confirmed_at) }}.</template>
        <template v-else-if="doc.rejected_at">Ditolak pada {{ fmtDateTime(doc.rejected_at) }}. Alasan: {{ doc.reject_reason }}</template>
        <template v-else>Hanya petugas yang dapat mengonfirmasi dokumen.</template>
      </p>
      <ResultCard :doc="doc" open />
      <InvoiceHistory v-if="hist" :hist="hist" :current-id="doc.id" style="margin-top: 16px" />
    </template>

    <!-- konfirmasi petugas -->
    <div v-else-if="doc" class="grid">
      <section class="card pdf">
        <div class="pdfbar">
          <strong>{{ doc.original_name }}</strong>
          <a v-if="pdfBase" :href="pdfBase" target="_blank" rel="noopener">Buka di tab baru</a>
        </div>
        <iframe v-if="pdfUrl" :src="pdfUrl" title="Dokumen PDF" />
        <p v-else-if="pdfError" class="error">{{ pdfError }}</p>
        <p v-else class="muted">Memuat PDF…</p>
      </section>

      <form class="card form" @submit.prevent="confirm">
        <div class="banner" :class="doc.risk.status">{{ statusLabel[doc.risk.status] }}</div>


        <div v-if="problem" class="error" role="alert">
          <strong>{{ problem.message }}</strong>
          <p v-if="problem.reasons.length" style="margin: 4px 0 0">
            Sistem menilai ulang memakai data yang sudah kamu periksa. Status kuning di atas
            adalah penilaian awal dari hasil baca yang belum pasti, sedangkan pelanggaran di bawah
            ini berlaku untuk data yang sudah kamu isi. Jika data sudah benar, tolak dokumen ini.
          </p>
          <ul v-if="problem.reasons.length" style="margin: 6px 0 0; padding-left: 18px">
            <li v-for="(r, i) in problem.reasons" :key="i">{{ reasonOf(r).title }}<template v-if="reasonOf(r).hint"> — {{ reasonOf(r).hint }}</template></li>
          </ul>
          <button v-if="problem.reasons.length && !rejecting" type="button" class="btn danger" style="margin-top: 8px" @click="startReject">
            Tolak dokumen ini
          </button>
        </div>

        <ul v-if="doc.risk.reasons?.length" class="reasons">
          <li v-for="r in doc.risk.reasons" :key="r.code">
            <strong>{{ reasonOf(r).title }}</strong>
            <span v-if="reasonOf(r).hint">{{ reasonOf(r).hint }}</span>
          </li>
        </ul>

        <div class="fields">
          <div>
            <span class="lbl">Nominal terbaca sistem</span>
            <div class="readonly">{{ money(inv?.amount_read, inv?.currency) }}</div>
          </div>
          <div>
            <label for="amt">Nominal setelah diperiksa</label>
            <input id="amt" v-model="f.amount" inputmode="decimal" />
          </div>
          <div>
            <label for="no">Nomor invoice</label>
            <input id="no" v-model="f.invoice_number" />
          </div>
          <div>
            <label for="iss">Penerbit</label>
            <input id="iss" v-model="f.issuer" />
          </div>
          <div>
            <label for="cur">Mata uang</label>
            <select id="cur" v-model="f.currency">
              <option value="">Pilih</option>
              <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label for="idt">Tanggal terbit</label>
            <input id="idt" v-model="f.issue_date" type="date" />
          </div>
          <div>
            <label for="due">Jatuh waktu</label>
            <input id="due" v-model="f.due_date" type="date" />
          </div>
          <div>
            <span class="lbl">Tanggal transaksi</span>
            <div class="readonly">{{ doc.request?.use_date ?? '-' }}</div>
          </div>
        </div>

        <p v-if="inv?.bill_to" class="muted" style="margin: 0">
          Pembeli menurut dokumen: <strong>{{ inv.bill_to }}</strong>
        </p>

        <fieldset v-if="isNear" class="choice">
          <legend>Ada invoice yang mirip. Pilih satu.</legend>

          <label v-for="c in candidates" :key="c.invoice_id" class="cand" :class="{ on: f.invoice_choice === String(c.invoice_id) }">
            <input v-model="f.invoice_choice" type="radio" name="choice" :value="String(c.invoice_id)" />
            <div>
              <strong>Sama dengan invoice #{{ c.invoice_id }} · {{ c.number }}</strong>
              <span class="muted">{{ c.issuer }} · sisa {{ money(c.remaining, c.currency) }} dari {{ money(c.total, c.currency) }}</span>
              <span v-if="c.compare" class="cmp">
                <i :class="c.compare.number?.verdict">Nomor {{ verdictText[c.compare.number?.verdict] }}</i>
                <i :class="c.compare.issuer?.verdict">Penerbit {{ verdictText[c.compare.issuer?.verdict] }}</i>
                <i v-if="c.compare.amount_same !== null" :class="c.compare.amount_same ? 'same' : 'different'">
                  Nominal {{ c.compare.amount_same ? 'sama' : 'berbeda' }}
                </i>
              </span>
            </div>
          </label>

          <label class="cand" :class="{ on: f.invoice_choice === 'new' }">
            <input v-model="f.invoice_choice" type="radio" name="choice" value="new" />
            <div><strong>Invoice baru</strong><span class="muted">Bukan salah satu di atas. Dicatat sebagai invoice dengan saldo sendiri.</span></div>
          </label>
        </fieldset>

        <p v-else-if="inv?.match_status === 'exact'" class="muted" style="margin: 0">
          Dikenali sebagai invoice #{{ inv.invoice_id }}. Sisa {{ money(inv.remaining, inv.currency) }}
          <template v-if="inv.total"> dari {{ money(inv.total, inv.currency) }}</template>.
        </p>
        <p v-else class="muted" style="margin: 0">Invoice ini belum tercatat. Akan dicatat sebagai invoice baru.</p>

        <InvoiceHistory v-if="hist" :hist="hist" />
        <div v-if="totalDiff" class="totalfix">
          <strong>Total invoice berbeda dari catatan</strong>
          <p>
            Tercatat {{ money(totalDiff.recorded, cur) }}, sedangkan nominal yang kamu isi {{ money(totalDiff.typed, cur) }}.
            Periksa angka pada gambar dokumen.
          </p>
          <label class="check">
            <input v-model="fixTotal" type="checkbox" />
            Koreksi total invoice tercatat menjadi {{ money(totalDiff.typed, cur) }}
          </label>
          <template v-if="fixTotal">
            <label for="fixr">Alasan koreksi</label>
            <input id="fixr" v-model="fixReason" placeholder="Contoh: total sebelumnya salah baca dari pindaian" />
            <small class="muted">Nilai lama, nilai baru, alasan, petugas, dan waktunya tersimpan. Total tidak boleh lebih kecil dari pemakaian yang sudah tercatat.</small>
          </template>
          <small v-else class="muted">Tanpa dicentang, total tercatat tetap dipertahankan.</small>
        </div>
        <div>
          <label for="trx">Nomor transaksi</label>
          <input id="trx" v-model="f.transaction_ref" placeholder="Contoh: TRX-2026-0001" />
        </div>

        <div class="outcome" aria-live="polite">
          <strong>Perhitungan saldo invoice</strong>
          <p v-if="!outcome" class="muted" style="margin: 6px 0 0">Belum bisa dihitung.</p>
          <p v-else-if="outcome.kind === 'pick'" style="margin: 6px 0 0">Pilih salah satu invoice di atas dulu.</p>
          <template v-else>
            <table class="calc">
              <tbody>
                <tr><td>Total invoice</td><td>{{ m(outcome.t.total) }}</td></tr>
                <tr><td>Sudah dipakai sebelumnya</td><td>− {{ m(outcome.t.used) }}</td></tr>
                <tr class="sub"><td>Sisa sekarang</td><td>{{ m(outcome.t.remaining) }}</td></tr>
                <tr><td>Pemakaian ini (nominal transaksi)</td><td>− {{ m(outcome.req) }}</td></tr>
                <tr class="sum" :class="{ bad: outcome.kind === 'over' }"><td>Sisa setelah dikonfirmasi</td><td>{{ m(outcome.after) }}</td></tr>
              </tbody>
            </table>
            <p v-if="outcome.kind === 'over'" class="bad" style="margin: 6px 0 0">
              Melebihi sisa sebesar {{ m(outcome.over) }}. Kemungkinan ditolak.
            </p>
          </template>
          <small>Perkiraan di layar. Keputusan akhir dihitung ulang oleh sistem saat konfirmasi.</small>
        </div>

        <p class="muted" style="margin: 0">Setiap koreksi tersimpan dengan nilai lama, nilai baru, siapa, dan kapan.</p>

        <div v-if="rejecting" class="rejectbox">
          <label for="why">Alasan penolakan</label>
          <textarea id="why" v-model="reason" rows="3" placeholder="Contoh: nominal tidak sesuai dokumen pendukung" />
          <small class="muted">Penolakan bersifat final. Alasan, nama petugas, dan waktunya tersimpan.</small>
          <p v-if="rejectError" class="error" role="alert" style="margin: 0">{{ rejectError }}</p>
        </div>

        <div class="acts">
          <template v-if="!rejecting">
            <button class="btn" :disabled="!canSubmit">{{ saving ? 'Menyimpan…' : 'Konfirmasi dan catat pemakaian' }}</button>
            <button type="button" class="btn danger" @click="startReject">Tolak dokumen</button>
          </template>
          <template v-else>
            <button type="button" class="btn danger-solid" :disabled="saving" @click="reject">{{ saving ? 'Menyimpan…' : 'Tolak dokumen' }}</button>
            <button type="button" class="btn secondary" @click="rejecting = false">Batal</button>
          </template>
        </div>
      </form>
    </div>
  </main>
</template>

<style scoped>
.wrap { max-width: 1280px; margin: 24px auto 48px; padding: 0 24px; }
.back { font-weight: 600; text-decoration: none; }
h1 { margin: 8px 0 20px; }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px; align-items: start; }
.pdf { position: sticky; top: 16px; padding: 0; overflow: hidden; }
.pdfbar { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); font-size: 14px; }
.pdf iframe { display: block; width: 100%; height: 78vh; border: 0; background: #eef1f6; }
.pdf .error, .pdf .muted { margin: 16px; }
.form { display: grid; gap: 18px; }
.banner { padding: 14px 16px; border-radius: 10px; font-weight: 600; }
.banner.green { background: var(--green-bg); color: var(--green); }
.banner.yellow { background: var(--yellow-bg); color: var(--yellow); }
.banner.red { background: var(--red-bg); color: var(--red); }
.reasons { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.reasons li { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: #f8fafc; border-radius: 8px; }
.reasons span { font-size: 13px; color: var(--muted); }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.readonly { min-height: 44px; display: flex; align-items: center; padding: 0 2px; font-weight: 700; color: var(--red); }
.fields > div:nth-child(8) .readonly { color: var(--text); }
.choice { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px 14px; margin: 0; display: grid; gap: 10px; }
.choice legend { padding: 0 6px; font-size: 13px; font-weight: 600; }
.cand { display: flex; gap: 12px; align-items: flex-start; margin: 0; padding: 12px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; font-weight: 400; font-size: 14px; }
.cand.on { border-color: var(--primary); background: #f3f6ff; }
.cand input[type='radio'] { width: 18px; height: 18px; padding: 0; margin-top: 2px; flex: none; accent-color: var(--primary); }
.cand > div { display: grid; gap: 4px; min-width: 0; }
.cmp { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.cmp i { font-style: normal; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #eef1f6; color: var(--muted); }
.cmp i.same { background: var(--green-bg); color: var(--green); }
.cmp i.similar { background: var(--yellow-bg); color: var(--yellow); }
.cmp i.different { background: var(--red-bg); color: var(--red); }
.outcome { padding: 12px 14px; border-radius: 10px; background: #f4f5f9; font-size: 14px; display: block; }
.outcome small { display: block; margin-top: 4px; color: var(--muted); }
.rejectbox { display: grid; gap: 10px; padding: 14px; border: 1px solid #e0a3a3; border-radius: 10px; background: #fff8f8; }
.bad { color: var(--red); font-weight: 700; }
.acts { display: flex; gap: 12px; flex-wrap: wrap; }
.calc { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
.calc td { padding: 5px 0; }
.calc td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.calc .sub td { border-top: 1px solid var(--line); font-weight: 600; }
.calc .sum td { border-top: 2px solid var(--text); font-weight: 700; }
.calc .sum.bad td { color: var(--red); }
@media (max-width: 1000px) {
  .grid { grid-template-columns: 1fr; }
  .pdf { position: static; }
  .pdf iframe { height: 60vh; }
  .fields { grid-template-columns: 1fr; }
}
.totalfix { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid #e6c36a; background: #fff8e6; border-radius: 10px; font-size: 14px; }
.totalfix p { margin: 0; }
.totalfix .check { display: flex; align-items: center; gap: 8px; margin: 0; cursor: pointer; }
.totalfix .check input { width: auto; height: auto; }
</style>
