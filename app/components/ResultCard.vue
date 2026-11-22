<script setup lang="ts">
const props = withDefaults(defineProps<{ doc: any; open?: boolean }>(), { open: false })
const { user } = useAuth()
const openPdf = useOpenPdf()

const d = computed(() => props.doc)
const cur = computed(() => d.value.invoice?.currency ?? '')
const reqCur = computed(() => d.value.request?.requested_currency ?? cur.value)
const sameCur = computed(() => !d.value.request?.requested_currency || !cur.value || d.value.request.requested_currency === cur.value)
const cents = (v: any) => (v == null ? null : Math.round(Number(v) * 100))
const dueDate = computed(() => d.value.invoice?.due_date ?? d.value.fields?.due_date ?? null)

// Sisa setelah dipakai: angka resmi bila sudah dikonfirmasi, selain itu perkiraan.
const after = computed(() => {
  if (!sameCur.value) return null
  const inv = d.value.invoice
  if (inv?.remaining_after != null) return { kind: 'final', value: inv.remaining_after }
  const rem = cents(inv?.remaining)
  const req = cents(d.value.request?.requested_amount)
  if (rem == null || req == null) return null
  if (req > rem) return { kind: 'over', value: (req - rem) / 100 }
  return { kind: 'estimate', value: (rem - req) / 100 }
})
const unsure = computed(() => d.value.invoice?.match_status !== 'exact')

// Bar saldo: terpakai | permintaan ini | sisa setelah dipakai. Ketiganya berjumlah sama dengan total.
// inv.used dan inv.remaining adalah kondisi sebelum pemakaian ini.
const bar = computed(() => {
  const inv = d.value.invoice
  if (!sameCur.value) return null
  if (inv?.total == null || inv?.used == null || Number(inv.total) <= 0) return null
  const total = Number(inv.total)
  const used = Math.min(Number(inv.used), total)
  const before = inv.remaining != null ? Number(inv.remaining) : total - used
  const req = Number(d.value.request?.requested_amount ?? 0)
  const take = Math.min(req, before)
  return {
    used, take, rem: before - take, over: Math.max(req - before, 0), total,
    pUsed: (used / total) * 100,
    pTake: (take / total) * 100,
  }
})
</script>

<template>
  <details class="card" :open="open">
    <summary class="head">
      <strong class="name">{{ d.original_name }}</strong>
      <span class="chip" :class="d.risk?.status ?? 'red'">{{ d.risk ? statusShort[d.risk.status] : 'Gagal' }}</span>
      <span class="muted">#{{ d.id }} · {{ fmtDateTime(d.uploaded_at) }}</span>
    </summary>

    <div class="body">
      <div v-if="d.status === 'failed'" class="error" role="alert">Gagal diproses: {{ d.error }}</div>

      <template v-else-if="d.risk">
        <div class="banner" :class="d.risk.status">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <template v-if="d.risk.status === 'green'"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></template>
            <template v-else-if="d.risk.status === 'yellow'"><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></template>
            <template v-else><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" /></template>
          </svg>
          {{ statusLabel[d.risk.status] }}
        </div>

        <dl class="facts">
          <div><dt>Nomor invoice</dt><dd>{{ d.fields?.doc_number ?? '-' }}</dd></div>
          <div><dt>Penerbit</dt><dd>{{ d.fields?.sender ?? '-' }}</dd></div>
          <div><dt>Nominal terbaca</dt><dd>{{ money(d.invoice?.amount_read, cur) }}</dd></div>
          <div><dt>Pencocokan</dt><dd>{{ matchText[d.invoice?.match_status] ?? '-' }}</dd></div>
          <div><dt>Tanggal dokumen</dt><dd>{{ d.fields?.doc_date ?? '-' }}</dd></div>
          <div v-if="dueDate"><dt>Jatuh waktu</dt><dd>{{ dueDate }}</dd></div>
          <div><dt>Tanggal transaksi</dt><dd>{{ d.request?.use_date ?? '-' }}</dd></div>
          <div><dt>Permintaan</dt><dd>{{ money(d.request?.requested_amount, reqCur) }}</dd></div>
          <div><dt>Sisa sebelum pemakaian ini</dt><dd>{{ money(d.invoice?.remaining, cur) }}</dd></div>
          <div v-if="d.invoice?.bill_to"><dt>Pembeli</dt><dd>{{ d.invoice.bill_to }}</dd></div>
          <div>
            <dt>Sisa setelah dipakai</dt>
            <dd v-if="!after">-</dd>
            <dd v-else-if="after.kind === 'over'" class="bad">Melebihi sisa {{ money(after.value, cur) }}</dd>
            <dd v-else>
              {{ money(after.value, cur) }}
              <small v-if="after.kind === 'estimate'">perkiraan<template v-if="unsure">, nominal belum diperiksa</template></small>
            </dd>
          </div>
        </dl>

        <div v-if="bar" class="meter">
          <div
            class="bar"
            role="img"
            :aria-label="`Terpakai ${bar.pUsed.toFixed(0)} persen, permintaan ini ${bar.pTake.toFixed(0)} persen, sisa setelah dipakai ${(100 - bar.pUsed - bar.pTake).toFixed(0)} persen`"
          >
            <span class="seg used" :style="{ width: bar.pUsed + '%' }" />
            <span class="seg take" :class="{ over: bar.over > 0 }" :style="{ width: bar.pTake + '%' }" />
          </div>
          <div class="legend">
            <span><i class="dot used" />Sudah dipakai sebelumnya {{ money(bar.used, cur) }}</span>
            <span><i class="dot take" />Permintaan ini<template v-if="!d.confirmed_at"> (belum tercatat)</template> {{ money(bar.take, cur) }}</span>
            <span><i class="dot free" />Sisa setelah dipakai {{ money(bar.rem, cur) }}</span>
            <span v-if="bar.over > 0" class="bad">Kelebihan {{ money(bar.over, cur) }}</span>
          </div>
        </div>

        <ul v-if="d.risk.reasons?.length" class="reasons">
          <li v-for="r in d.risk.reasons" :key="r.code" class="reason">
            <strong>{{ reasonOf(r).title }}</strong>
            <span v-if="reasonOf(r).hint">{{ reasonOf(r).hint }}</span>
          </li>
        </ul>

        <p v-if="!d.confirmed_at" class="muted" style="margin: 0">
          Nominal terbaca dari dokumen belum tentu benar. Angka resmi baru tercatat setelah petugas mengonfirmasi.
        </p>

        <div class="actions">
          <button type="button" class="btn secondary" @click="openPdf(d.id)">Lihat PDF</button>
          <NuxtLink v-if="user?.is_admin && !d.confirmed_at && !d.rejected_at" :to="`/documents/${d.id}`" class="go">Periksa dan konfirmasi →</NuxtLink>
          <span v-if="d.rejected_at" class="bad">Ditolak: {{ d.reject_reason }}</span>
          <span v-if="d.confirmed_at" class="done">Sudah dikonfirmasi</span>
        </div>

        <details>
          <summary class="muted">Data mentah (untuk pengembangan)</summary>
          <pre style="overflow: auto; font-size: 12px">{{ JSON.stringify(d, null, 2) }}</pre>
        </details>
      </template>
    </div>
  </details>
</template>

<style scoped>
.head { display: flex; gap: 12px; align-items: center; cursor: pointer; list-style: none; flex-wrap: wrap; }
.head::-webkit-details-marker { display: none; }
.name { font-size: 15px; }
.body { display: grid; gap: 16px; margin-top: 16px; }
.chip { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.chip.green, .banner.green { background: #E3F4EA; color: #14532D; }
.chip.yellow, .banner.yellow { background: #FFF1CC; color: #6B3F06; }
.chip.red, .banner.red { background: #FDE2E2; color: #7F1D1D; }
.banner { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; font-weight: 600; }
.facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 0; }
.facts dt { font-size: 12px; color: #4B5563; }
.facts dd { margin: 4px 0 0; font-weight: 600; }
.facts small { display: block; font-weight: 400; font-size: 12px; color: #4B5563; }
.bad { color: #7F1D1D; font-weight: 600; }
.meter { display: grid; gap: 8px; }
.bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: #E5E9F0; }
.seg.used { background: #2B3650; }
.seg.take { background: #1D3FBF; }
.seg.take.over { background: #B42318; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: #4B5563; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }
.dot.used { background: #2B3650; } .dot.take { background: #1D3FBF; } .dot.free { background: #E5E9F0; border: 1px solid #AEB6C4; }
.reasons { margin: 0; padding: 0; display: grid; gap: 8px; }
.reason { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: #F8FAFC; border-radius: 8px; list-style: none; }
.reason span { font-size: 13px; color: #4B5563; }
.actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.go { display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border-radius: 10px; background: #1D3FBF; color: #fff; font-weight: 600; text-decoration: none; }
.go:hover { background: #17329A; }
.done { font-weight: 600; color: #14532D; }
@media (max-width: 800px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
