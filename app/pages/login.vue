<script setup lang="ts">
const { login } = useAuth()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    await navigateTo('/')
  } catch (e: any) {
    error.value =
      e?.data?.message ??
      (e?.status === 422 || e?.statusCode === 422 ? 'Email atau kata sandi salah.' : e?.message) ??
      'Tidak dapat masuk.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div style="max-width: 400px; margin: 96px auto; padding: 0 16px">
    <h1 style="font-size: 28px; margin: 0 0 4px">DocGuard</h1>
    <p class="muted" style="margin: 0 0 24px">Masuk untuk memeriksa dokumen underlying.</p>

    <form class="card" style="display: grid; gap: 16px" @submit.prevent="submit">
      <div>
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" autocomplete="username" required />
      </div>
      <div>
        <label for="password">Kata sandi</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required />
      </div>
      <div v-if="error" class="error" role="alert">{{ error }}</div>
      <button class="btn" :disabled="loading">{{ loading ? 'Memproses…' : 'Masuk' }}</button>
    </form>
  </div>
</template>
