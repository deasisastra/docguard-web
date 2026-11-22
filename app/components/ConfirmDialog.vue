<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  error?: string
}>()

defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
</script>

<template>
  <Teleport to="body">
    <!-- sengaja tanpa @click di overlay dan tanpa Esc: hanya tombol Ya/Tidak yang menutup -->
    <div v-if="open" class="cd-overlay" role="alertdialog" aria-modal="true" aria-labelledby="cd-title">
      <div class="cd-box">
        <div class="cd-icon" aria-hidden="true">!</div>
        <h2 id="cd-title">{{ title }}</h2>
        <p class="cd-msg">{{ message }}</p>
        <p v-if="detail" class="cd-detail">{{ detail }}</p>
        <p v-if="error" class="error">{{ error }}</p>

        <div class="cd-actions">
          <button type="button" class="btn secondary" :disabled="busy" @click="$emit('cancel')">
            {{ cancelLabel ?? 'Tidak' }}
          </button>
          <button type="button" class="btn danger-solid" :disabled="busy" @click="$emit('confirm')">
            {{ busy ? 'Menghapus…' : (confirmLabel ?? 'Ya') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cd-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.55);
}
.cd-box {
  width: 100%;
  max-width: 420px;
  padding: 28px 24px 22px;
  text-align: center;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}
.cd-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  font-size: 28px;
  font-weight: 700;
  color: #b42318;
  background: #fee4e2;
  border-radius: 50%;
}
.cd-box h2 { margin: 0 0 6px; font-size: 18px; }
.cd-msg { margin: 0; color: #334155; }
.cd-detail { margin: 8px 0 0; font-size: 13px; color: #64748b; word-break: break-word; }
.cd-actions { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
.cd-actions .btn { min-width: 120px; }
</style>
