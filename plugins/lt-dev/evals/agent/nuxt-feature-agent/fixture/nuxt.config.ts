// Trimmed nuxt-base-starter config: the modules and settings a feature page depends on.
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  css: ['~/assets/css/tailwind.css'],
  devtools: { enabled: false },
  ltExtensions: {
    auth: { enabled: true },
  },
  modules: ['@nuxt/ui', '@lenne.tech/nuxt-extensions'],
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || '',
    },
  },
  ssr: true,
});
