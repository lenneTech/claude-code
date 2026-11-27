<script setup lang="ts">
// ============================================================================
// Variables
// ============================================================================
const values = [
  {
    title: 'Aus der Region',
    description: 'Wir stellen Betriebe vor, die ihre Arbeit mit digitalen Werkzeugen leichter machen.',
    icon: 'i-lucide-map-pin',
  },
  {
    title: 'Aus der Praxis',
    description: 'Jeder Bericht entsteht mit den Menschen, die das Projekt umgesetzt haben.',
    icon: 'i-lucide-hammer',
  },
  {
    title: 'Offen für alle',
    description: 'Die Plattform ist kostenlos, ohne Anmeldung und ohne Werbung.',
    icon: 'i-lucide-door-open',
  },
];

useSeoMeta({
  title: 'Über uns',
  description: 'Wer hinter Handwerk Digital Nord steht und was die Plattform will.',
});
</script>

<template>
  <div class="w-full">
    <!-- Intro -->
    <section class="bg-elevated py-10 md:py-16" aria-labelledby="intro-title">
      <div class="container mx-auto grid gap-8 px-4 md:grid-cols-12 md:items-center">
        <div class="flex flex-col gap-5 md:col-span-7">
          <h1 id="intro-title" class="text-4xl font-bold text-highlighted md:text-5xl">Über Handwerk Digital Nord</h1>
          <p class="text-lg text-default md:text-xl">
            Handwerk Digital Nord zeigt, wie Betriebe aus der Region ihre Arbeit mit digitalen Werkzeugen verändern:
            vom Tischler mit Online-Terminbuchung bis zum Sanitärbetrieb, der seine Einsätze per App plant.
          </p>
        </div>
        <NuxtImg
          src="/images/team.jpg"
          alt="Das Team von Handwerk Digital Nord bei einem Werkstattbesuch"
          class="w-full md:col-span-5"
          width="640"
          height="480"
        />
      </div>
    </section>

    <!-- Mission -->
    <section class="py-10 md:py-16" aria-labelledby="mission-title">
      <div class="container mx-auto flex flex-col gap-8 px-4">
        <div class="flex flex-col gap-4">
          <h2 id="mission-title" class="text-3xl font-semibold text-highlighted">Wofür wir stehen</h2>
          <p class="text-lg text-default">
            Wir sammeln Erfahrungen aus echten Projekten, damit andere Betriebe davon lernen können. Was funktioniert hat,
            was nicht und was es gekostet hat, erzählen die Beteiligten selbst.
          </p>
        </div>
        <div class="grid gap-6 md:grid-cols-3">
          <UCard v-for="value in values" :key="value.title">
            <div class="flex flex-col gap-3">
              <UIcon :name="value.icon" class="size-6 text-primary" />
              <h3 class="text-xl font-semibold text-highlighted">{{ value.title }}</h3>
              <p class="text-default">{{ value.description }}</p>
            </div>
          </UCard>
        </div>
      </div>
    </section>

    <!-- Team -->
    <section class="bg-elevated py-10 md:py-16" aria-labelledby="team-title">
      <div class="container mx-auto flex flex-col gap-4 px-4">
        <h2 id="team-title" class="text-3xl font-semibold text-highlighted">Das Team hinter der Plattform</h2>
        <p class="text-lg text-default">
          Die Redaktion sitzt in Lüneburg und ist regelmäßig in den Betrieben unterwegs. Für Fragen zu einzelnen Berichten
          erreichst du uns über das Kontaktformular oder direkt per E-Mail.
        </p>
        <div>
          <UButton to="/kontakt" color="primary" size="lg">Kontakt aufnehmen</UButton>
        </div>
      </div>
    </section>
  </div>
</template>
