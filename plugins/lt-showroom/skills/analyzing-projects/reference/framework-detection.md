# Framework Detection Lookup Table

Use the following signals to identify frameworks and libraries. Check manifest files first, then look for config files as confirmation.

## JavaScript / TypeScript Frameworks

### Frontend Frameworks

| Framework | Manifest Signal | Config File Signal |
|-----------|----------------|-------------------|
| Nuxt 4 / Nuxt 3 | `"nuxt": "^4"` or `"nuxt": "^3"` in `dependencies` | `nuxt.config.ts` |
| Next.js | `"next"` in `dependencies` | `next.config.js` / `next.config.ts` |
| SvelteKit | `"@sveltejs/kit"` in `dependencies` | `svelte.config.js` |
| Remix | `"@remix-run/react"` in `dependencies` | `remix.config.js` |
| Astro | `"astro"` in `dependencies` | `astro.config.mjs` |
| Angular | `"@angular/core"` in `dependencies` | `angular.json` |
| Vue (standalone) | `"vue"` without `"nuxt"` | `vite.config.ts` with Vue plugin |
| React (standalone) | `"react"` without `"next"` | `vite.config.ts` with React plugin |

### Backend Frameworks (Node.js)

| Framework | Manifest Signal | Config File Signal |
|-----------|----------------|-------------------|
| NestJS | `"@nestjs/core"` in `dependencies` | `nest-cli.json` |
| Express | `"express"` in `dependencies` | No standard config |
| Fastify | `"fastify"` in `dependencies` | No standard config |
| Hono | `"hono"` in `dependencies` | No standard config |
| Koa | `"koa"` in `dependencies` | No standard config |

### Full-Stack (Node.js)

| Framework | Manifest Signal | Config File Signal |
|-----------|----------------|-------------------|
| T3 Stack | `"@trpc/server"` + `"next"` | `trpc.ts` in `src/` |
| RedwoodJS | `"@redwoodjs/core"` | `redwood.toml` |

## Python Frameworks

| Framework | Manifest Signal | Config File Signal |
|-----------|----------------|-------------------|
| Django | `django` in `requirements.txt` | `manage.py`, `settings.py` |
| FastAPI | `fastapi` in `requirements.txt` | `main.py` with `FastAPI()` |
| Flask | `flask` in `requirements.txt` | `app.py` with `Flask(__name__)` |
| Starlette | `starlette` in `requirements.txt` | No standard config |

## Other Languages

| Framework | Language | Signal |
|-----------|----------|--------|
| Spring Boot | Java/Kotlin | `pom.xml` with `spring-boot-starter` |
| Quarkus | Java/Kotlin | `pom.xml` with `io.quarkus` |
| Gin | Go | `go.mod` with `github.com/gin-gonic/gin` |
| Echo | Go | `go.mod` with `github.com/labstack/echo` |
| Rails | Ruby | `Gemfile` with `gem 'rails'` |
| Laravel | PHP | `composer.json` with `laravel/framework` |
| Flutter | Dart | `pubspec.yaml` with `flutter:` section |

## UI Component Libraries

| Library | Signal |
|---------|--------|
| Nuxt UI | `"@nuxt/ui"` in `dependencies` |
| shadcn/ui | `"shadcn-ui"` or components in `components/ui/` |
| Radix UI | `"@radix-ui/react-*"` in `dependencies` |
| Material UI | `"@mui/material"` in `dependencies` |
| Ant Design | `"antd"` in `dependencies` |
| Headless UI | `"@headlessui/react"` or `"@headlessui/vue"` |
| PrimeVue | `"primevue"` in `dependencies` |
| Vuetify | `"vuetify"` in `dependencies` |
| DaisyUI | `"daisyui"` in `devDependencies` (Tailwind plugin) |

## Styling

| Approach | Signal |
|----------|--------|
| Tailwind CSS | `"tailwindcss"` in `devDependencies`, `tailwind.config.*` |
| CSS Modules | `.module.css` or `.module.scss` files |
| Styled Components | `"styled-components"` in `dependencies` |
| Emotion | `"@emotion/react"` in `dependencies` |
| UnoCSS | `"unocss"` in `devDependencies` |

## Databases

| Database | Signal |
|----------|--------|
| MongoDB | `"mongoose"` or `"mongodb"` in `dependencies` |
| PostgreSQL | `"pg"`, `"@prisma/client"`, `"drizzle-orm"` in `dependencies` |
| MySQL | `"mysql2"` or `"mysql"` in `dependencies` |
| SQLite | `"better-sqlite3"` or `"sqlite3"` in `dependencies` |
| Redis | `"ioredis"` or `"redis"` in `dependencies` |
| Prisma ORM | `"@prisma/client"` in `dependencies`, `schema.prisma` file |
| TypeORM | `"typeorm"` in `dependencies` |
| Drizzle ORM | `"drizzle-orm"` in `dependencies`, `drizzle.config.ts` file |
| Mongoose | `"mongoose"` in `dependencies` |

## Testing Frameworks

| Framework | Signal |
|-----------|--------|
| Jest | `"jest"` in `devDependencies`, `jest.config.*` |
| Vitest | `"vitest"` in `devDependencies`, `vitest.config.*` |
| Playwright | `"@playwright/test"` in `devDependencies`, `playwright.config.*` |
| Cypress | `"cypress"` in `devDependencies`, `cypress.config.*` |
| Testing Library | `"@testing-library/*"` in `devDependencies` |

## Authentication Libraries

| Library | Signal |
|---------|--------|
| Better Auth | `"better-auth"` in `dependencies` |
| Auth.js / NextAuth | `"next-auth"` or `"@auth/core"` in `dependencies` |
| Passport.js | `"passport"` in `dependencies` |
| Jose (JWT) | `"jose"` in `dependencies` |
| jsonwebtoken | `"jsonwebtoken"` in `dependencies` |
| Keycloak | `"keycloak-*"` in `dependencies` |
