<script setup lang="ts">
// ============================================================================
// Variables
// ============================================================================
const descriptions = [
  {
    title: 'Ein Satz',
    text: 'Handwerk Digital Nord zeigt, wie Betriebe aus Norddeutschland ihre Arbeit mit digitalen Werkzeugen verändern.',
  },
  {
    title: 'Kurzprofil',
    text: 'Handwerk Digital Nord ist eine kostenlose Plattform mit Berichten, Interviews und Projektbeispielen aus dem Handwerk der Region. Die Beteiligten erzählen selbst, was funktioniert hat und was nicht.',
  },
];

const logos = [
  { title: 'Logo für helle Hintergründe', file: '/presse/logo-hell.svg' },
  { title: 'Logo für dunkle Hintergründe', file: '/presse/logo-dunkel.svg' },
];

useSeoMeta({
  title: 'Presse',
  description: 'Texte, Logos und Kontakt für Berichte über Handwerk Digital Nord.',
});
</script>

<template>
  <div class="w-full">
    <!-- Intro -->
    <section class="bg-elevated py-10 md:py-16" aria-labelledby="presse-title">
      <div class="container mx-auto grid gap-8 px-4 md:grid-cols-12 md:items-center">
        <div class="flex flex-col gap-5 md:col-span-7">
          <h1 id="presse-title" class="text-4xl font-bold text-highlighted md:text-5xl">Presse und Medien</h1>
          <p class="text-lg text-default md:text-xl">
            Hier findest du alles für einen Bericht über Handwerk Digital Nord: Texte zum Übernehmen, Logos und den
            direkten Kontakt zur Redaktion.
          </p>
        </div>
        <NuxtImg
          src="/images/presse.jpg"
          alt="Redaktion von Handwerk Digital Nord im Gespräch mit einem Tischler"
          class="w-full md:col-span-5"
          width="640"
          height="480"
        />
      </div>
    </section>

    <!-- Texts -->
    <section class="py-10 md:py-16" aria-labelledby="texte-title">
      <div class="container mx-auto flex flex-col gap-8 px-4">
        <div class="flex max-w-3xl flex-col gap-4">
          <h2 id="texte-title" class="text-3xl font-semibold text-highlighted">Texte über Handwerk Digital Nord zum Übernehmen</h2>
          <p class="text-lg text-default">
            Ein Satz für eine Ankündigung oder ein Kurzprofil für eine Partnerseite: Hier findest du die passende
            Beschreibung.
          </p>
        </div>
        <div class="grid gap-6 lg:grid-cols-2">
          <UCard v-for="description in descriptions" :key="description.title">
            <div class="flex flex-col gap-3">
              <h3 class="text-xl font-semibold text-highlighted">{{ description.title }}</h3>
              <p class="text-default">{{ description.text }}</p>
            </div>
          </UCard>
        </div>
      </div>
    </section>

    <!-- Logos -->
    <section class="bg-elevated py-10 md:py-16" aria-labelledby="logos-title">
      <div class="container mx-auto flex flex-col gap-8 px-4">
        <div class="flex max-w-3xl flex-col gap-4">
          <h2 id="logos-title" class="text-3xl font-semibold text-highlighted">Das passende Logo für deinen Beitrag</h2>
          <p class="text-lg text-default">
            Hier findest du das Logo von Handwerk Digital Nord für deine Berichterstattung. Verwende die Originaldateien
            und achte auf einen ruhigen, gut lesbaren Hintergrund.
          </p>
        </div>
        <div class="grid gap-6 lg:grid-cols-2">
          <UCard v-for="logo in logos" :key="logo.title">
            <div class="flex flex-col gap-4">
              <h3 class="text-xl font-semibold text-highlighted">{{ logo.title }}</h3>
              <div>
                <UButton :to="logo.file" external download icon="i-lucide-download" variant="outline">
                  SVG herunterladen
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </section>

    <!-- Press contact -->
    <section class="bg-inverted py-10 md:py-16" aria-labelledby="kontakt-title">
      <div class="container mx-auto grid gap-8 px-4 md:grid-cols-2 md:items-center">
        <div class="flex flex-col gap-4">
          <h2 id="kontakt-title" class="text-3xl font-semibold text-inverted">
            Du brauchst weiteres Material oder möchtest ein Gespräch anfragen?
          </h2>
          <p class="text-lg text-inverted">
            Du berichtest über Digitalisierung im Handwerk oder möchtest die Plattform vorstellen? Schreib uns mit
            deinem Medium, deinem Thema und deinem gewünschten Termin. Für Gespräche und zusätzliches Material stimmen
            wir die passende Ansprechperson mit dir ab.
          </p>
        </div>
        <div class="flex flex-col gap-4">
          <p class="text-lg text-inverted">
            <span class="font-semibold">Pressekontakt:</span><br />
            Redaktion Handwerk Digital Nord<br />
            <a href="mailto:presse@handwerk-digital-nord.example" class="underline underline-offset-4">
              presse@handwerk-digital-nord.example
            </a>
          </p>
          <div>
            <UButton to="mailto:presse@handwerk-digital-nord.example" color="primary" size="lg" icon="i-lucide-mail">
              Presseanfrage per E-Mail
            </UButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
