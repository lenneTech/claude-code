<script setup lang="ts">
// ============================================================================
// Composables
// ============================================================================
const appConfig: ReturnType<typeof useAppConfig> = useAppConfig();
</script>

<template>
  <UApp :toaster="appConfig.toaster">
    <NuxtLoadingIndicator color="var(--ui-primary)" :height="2" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
