<script setup lang="ts">
const props = defineProps<{
  open: boolean
  kind: 'success' | 'error'
  title: string
  message?: string
  detail?: string
  actionLabel?: string
}>()
const emit = defineEmits<{ close: []; action: [] }>()

const box = ref<HTMLElement | null>(null)
watch(() => props.open, async (v) => {
  if (!v) return
  await nextTick()
  box.value?.querySelector<HTMLButtonElement>('button')?.focus()
})
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="emit('close')" @keydown="onKey">
      <div ref="box" class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-msg">
        <div class="icon" :class="kind">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path v-if="kind === 'success'" class="draw" d="M5 12.5l4.5 4.5L19 7.5" />
            <template v-else>
              <path class="draw" d="M7 7l10 10" />
              <path class="draw" d="M17 7L7 17" />
            </template>
          </svg>
        </div>
        <h2 id="dlg-title">{{ title }}</h2>
        <p id="dlg-msg">{{ message }}</p>
        <p v-if="detail" class="detail">{{ detail }}</p>
        <div class="acts">
          <button v-if="actionLabel" type="button" class="btn" @click="emit('action')">{{ actionLabel }}</button>
          <button type="button" class="btn secondary" @click="emit('close')">Tutup</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: rgba(20, 28, 51, .5); animation: fade .15s ease-out; }
.dlg { width: min(420px, 100%); background: #fff; border-radius: 16px; padding: 32px 24px 24px; text-align: center; box-shadow: 0 20px 60px rgba(20, 28, 51, .3); animation: pop .22s cubic-bezier(.2, .9, .3, 1.2); }
.icon { width: 76px; height: 76px; margin: 0 auto 16px; border-radius: 50%; display: grid; place-items: center; }
.icon.success { background: #e1f3e8; color: #14803f; }
.icon.error { background: #fde0e0; color: #b42318; }
.draw { stroke-dasharray: 30; stroke-dashoffset: 30; animation: draw .35s .15s ease-out forwards; }
h2 { margin: 0 0 8px; font-size: 20px; }
p { margin: 0; color: var(--muted); font-size: 15px; word-break: break-word; }
.detail { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #f4f5f9; color: var(--text); font-size: 14px; }
.acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 24px; }
@keyframes fade { from { opacity: 0; } }
@keyframes pop { from { opacity: 0; transform: scale(.9); } }
@keyframes draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) {
  .overlay, .dlg { animation: none; }
  .draw { animation: none; stroke-dashoffset: 0; }
}
</style>
