<script setup lang="ts">
const { user, logout } = useAuth()
const route = useRoute()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

// Tutup menu saat pindah halaman.
watch(() => route.fullPath, () => { open.value = false })

// Tutup menu dengan Esc atau saat mengetuk di luar header.
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
function onClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.addEventListener('click', onClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('click', onClick)
})
</script>

<template>
  <header ref="root" class="topbar">
    <span class="brand">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D3FBF" stroke-width="2" aria-hidden="true">
        <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" />
      </svg>
      DocGuard
    </span>

    <button
      type="button"
      class="burger"
      :aria-expanded="open"
      aria-controls="main-menu"
      :aria-label="open ? 'Tutup menu' : 'Buka menu'"
      @click="open = !open"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <template v-if="!open"><path d="M4 7h16M4 12h16M4 17h16" /></template>
        <template v-else><path d="M6 6l12 12M18 6L6 18" /></template>
      </svg>
    </button>

    <div id="main-menu" class="menu" :class="{ open }">
      <nav aria-label="Menu utama">
        <NuxtLink to="/">Periksa</NuxtLink>
        <NuxtLink to="/riwayat">Riwayat</NuxtLink>
      </nav>

      <div class="profile">
        <span class="who">
          <strong>{{ user?.name }}</strong>
          <span class="muted">{{ user?.unit }} · {{ user?.is_admin ? 'Petugas' : 'Pengguna' }}</span>
        </span>
        <button type="button" class="btn secondary out" @click="logout">Keluar</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar { position: relative; display: flex; align-items: center; gap: 28px; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; white-space: nowrap; }

.burger {
  display: none; align-items: center; justify-content: center;
  width: 44px; height: 44px; margin-left: auto;
  border: 1px solid #b9c0d0; border-radius: 10px; background: #fff; color: var(--text); cursor: pointer;
}
.burger:hover { background: #f4f5f9; }

.menu { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-width: 0; }
nav { display: flex; gap: 4px; }
nav a { padding: 8px 14px; border-radius: 8px; color: #4B5563; font-weight: 600; text-decoration: none; }
nav a:hover { background: #EEF1F6; }
nav a.router-link-exact-active { background: #E6ECFB; color: #1D3FBF; }

.profile { display: flex; align-items: center; gap: 12px; }
.who { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.3; font-size: 14px; }
.who .muted { font-size: 13px; }
.out { height: 36px; }

/* Layar sempit: menu masuk ke tombol garis tiga */
@media (max-width: 720px) {
  .topbar { padding-left: 16px; padding-right: 16px; gap: 12px; }
  .burger { display: inline-flex; }

  .menu {
    display: none;
    position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
    flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 12px;
    padding: 12px 16px 16px; background: #fff;
    border-bottom: 1px solid var(--line); box-shadow: 0 12px 24px rgba(20, 28, 51, .12);
  }
  .menu.open { display: flex; }

  nav { flex-direction: column; gap: 4px; }
  nav a { display: flex; align-items: center; min-height: 44px; }

  .profile {
    flex-direction: column; align-items: stretch; gap: 12px;
    padding: 12px; background: #F8FAFC; border: 1px solid var(--line); border-radius: 10px;
  }
  .who { align-items: flex-start; }
  .out { width: 100%; height: 44px; }
}
</style>
