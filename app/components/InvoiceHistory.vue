<script setup lang="ts">
const props = defineProps<{ hist: any; currentId?: number }>()
const cur = computed(() => props.hist.invoice.currency)
const others = computed(() => (props.hist.documents as any[]).filter((d) => d.id !== props.currentId))
const stateText: Record<string, string> = { confirmed: 'Dikonfirmasi', rejected: 'Ditolak', pending: 'Belum diputuskan' }
</script>

<template>
  <details class="hist" open>
    <summary>
      Riwayat invoice ini · {{ hist.utilizations.length }} pemakaian · {{ others.length }} dokumen lain
    </summary>

    <p class="sumline">
      Total {{ money(hist.invoice.total, cur) }} − dipakai {{ money(hist.invoice.used, cur) }}
      = <strong>sisa {{ money(hist.invoice.remaining, cur) }}</strong>
    </p>

    <p v-if="!hist.utilizations.length" class="muted">Belum ada pemakaian yang tercatat.</p>
    <table v-else class="tbl">
      <thead><tr><th>Tanggal</th><th>Nomor transaksi</th><th class="r">Nominal</th><th>Petugas</th></tr></thead>
      <tbody>
        <tr v-for="u in hist.utilizations" :key="u.id">
          <td>{{ u.used_on ?? fmtDateTime(u.created_at) }}</td>
          <td>{{ u.transaction_ref }}</td>
          <td class="r">{{ money(u.amount, cur) }}</td>
          <td>{{ u.by ?? '-' }}</td>
        </tr>
      </tbody>
    </table>

    <template v-if="others.length">
      <h4>Dokumen lain untuk invoice ini</h4>
      <ul class="docs">
        <li v-for="d in others" :key="d.id">
          <NuxtLink :to="`/documents/${d.id}`">#{{ d.id }} {{ d.original_name }}</NuxtLink>
          <span class="muted">{{ fmtDateTime(d.uploaded_at) }} · permintaan {{ money(d.requested_amount, cur) }}</span>
          <span class="st" :class="d.state">{{ stateText[d.state] }}</span>
        </li>
      </ul>
    </template>
  </details>
</template>

<style scoped>
.hist { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.hist summary { cursor: pointer; font-weight: 600; font-size: 14px; }
.sumline { margin: 10px 0; font-size: 14px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; color: var(--muted); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--line); }
.tbl td { padding: 7px 8px; border-bottom: 1px solid #eef1f6; }
.r { text-align: right; }
h4 { margin: 14px 0 6px; font-size: 13px; }
.docs { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 13px; }
.docs li { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.st { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #eef1f6; color: var(--muted); }
.st.confirmed { background: var(--green-bg); color: var(--green); }
.st.rejected { background: var(--red-bg); color: var(--red); }
</style>
