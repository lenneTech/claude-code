<script setup lang="ts">
// ============================================================================
// Composables
// ============================================================================
const { user, signOut } = useLtAuth();

// ============================================================================
// Navigation — wrapper because `navigateTo` is auto-imported in <script setup>
// but not exposed to the template scope (template gets the component's `this`,
// not the module scope).
// ============================================================================
function goTo(path: string): ReturnType<typeof navigateTo> {
  return navigateTo(path);
}

// ============================================================================
// Variables
// ============================================================================
const pages = [
  {
    title: 'Sicherheit',
    description: 'Verwalte 2FA, Passkeys und Kontosicherheit',
    icon: 'i-lucide-shield-check',
    to: '/app/settings/security',
  },
];

// ============================================================================
// Functions
// ============================================================================
async function handleSignOut(): Promise<void> {
  await signOut();
  await navigateTo('/auth/login');
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <!-- Welcome Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold">Willkommen{{ user?.name ? `, ${user.name}` : '' }}!</h1>
      <p class="mt-2 text-muted">
        {{ user?.email }}
      </p>
    </div>

    <!-- Quick Actions -->
    <div class="mb-8">
      <h2 class="mb-4 text-xl font-semibold">Schnellzugriff</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UCard v-for="page in pages" :key="page.to" class="cursor-pointer transition-shadow hover:shadow-lg" @click="goTo(page.to)">
          <div class="flex items-start gap-4">
            <div class="rounded-lg bg-primary/10 p-3">
              <UIcon :name="page.icon" class="size-6 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold">{{ page.title }}</h3>
              <p class="mt-1 text-sm text-muted">{{ page.description }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- User Info Card -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-user" class="size-6 text-primary" />
          <h2 class="font-semibold">Dein Konto</h2>
        </div>
      </template>

      <div class="space-y-3">
        <div class="flex justify-between">
          <span class="text-muted">Name</span>
          <span class="font-medium">{{ user?.name || '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">E-Mail</span>
          <span class="font-medium">{{ user?.email || '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted">E-Mail verifiziert</span>
          <UBadge :color="user?.emailVerified ? 'success' : 'warning'">
            {{ user?.emailVerified ? 'Ja' : 'Nein' }}
          </UBadge>
        </div>
      </div>

      <template #footer>
        <UButton color="error" variant="outline" icon="i-lucide-log-out" @click="handleSignOut"> Abmelden </UButton>
      </template>
    </UCard>
  </div>
</template>
