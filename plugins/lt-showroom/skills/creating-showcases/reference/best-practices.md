# Best Practices for Showcase Content

## Language & Tone

- **English by default** — All showcase content in English unless the project is explicitly German-only
- **Factual and specific** — Describe what the project does, not what it could do
- **Developer-friendly** — Assume a technical audience; use proper framework/library names
- **No marketing fluff** — Avoid "cutting-edge", "revolutionary", "game-changing" — describe actual capabilities
- **Action-oriented titles** — For feature-grid items: "Real-time Collaboration" not "We have real-time collaboration"

## Recommended Block Structure

### Standard Software Showcase

```
1. tech-stack          — Auto-generated from analysis (required)
2. text                — Project overview: what it does, who it's for, key problem solved
3. feature-grid        — 3-6 core features with icons and concise descriptions
4. screenshot-gallery  — Visual screenshots (added after /showroom:screenshot)
5. text                — Architecture: key design decisions, patterns, scalability approach
6. cta                 — Link to live demo and/or repository
```

### Extended Showcase (for complex projects)

```
1. tech-stack
2. text                — Project overview
3. feature-grid        — Core features
4. screenshot-gallery  — Screenshots
5. text                — Architecture highlights
6. text                — Technical depth (notable implementation challenges)
7. timeline            — Development phases or milestones (optional)
8. team                — Contributors (optional)
9. testimonial         — Client or user quote (optional)
10. faq               — Common technical questions (optional)
11. cta               — Live demo and repository links
```

## Content Block Guidelines

### tech-stack Block

- List all major technologies, not minor utilities
- Group by category: `language`, `frontend`, `backend`, `database`, `infrastructure`, `testing`
- Maximum 12-15 items — omit trivial dependencies
- Use exact official names: "NestJS" not "Nest", "Nuxt 4" not "NuxtJS"

### text Blocks (Overview)

- 2-3 paragraphs maximum
- First paragraph: what the project does and who uses it
- Second paragraph: key differentiators or notable technical aspects
- Third paragraph (optional): deployment, scale, or business context

### feature-grid Block

- 3-6 features (4 is optimal for symmetrical grid layout)
- Each title: 2-5 words
- Each description: 1-2 sentences maximum, technically precise
- Icon from Heroicons: choose semantically appropriate icons
  - Security → `heroicons:shield-check`
  - Performance → `heroicons:bolt`
  - Real-time → `heroicons:signal`
  - Files → `heroicons:document`
  - Search → `heroicons:magnifying-glass`
  - API → `heroicons:code-bracket`
  - Auth → `heroicons:key`
  - Analytics → `heroicons:chart-bar`
  - Email → `heroicons:envelope`
  - Notifications → `heroicons:bell`

### screenshot-gallery Block

- Add this block immediately after feature-grid as a placeholder, even before screenshots are captured
- Use `layout: "tabs"` for projects with multiple viewports
- Screenshots are populated by the `screenshot-generator` agent

### Architecture text Block

- Focus on non-obvious design decisions
- Mention patterns by name: "CQRS", "Repository pattern", "Event-driven architecture"
- Note scalability considerations if present (pagination, caching, async processing)
- Reference specific technologies: "MongoDB with Mongoose for ODM", "BullMQ for background jobs"

### cta Block

- Always include a primary button
- If a live demo exists: primary = "View live demo"
- If only a repository: primary = "View source on GitHub"
- Secondary button for the other option when both are available

## What to Avoid

- Generic descriptions: "A modern web application" — be specific about domain and function
- Version numbers in the overview text (they become stale) — versions belong in tech-stack block only
- Lorem ipsum or placeholder content — all showcase content should be real
- More than 6 items in a feature-grid — use a text block for additional features instead
- Duplicate information across blocks — each block covers a distinct aspect
- Internal/confidential URLs — only use public or demo URLs

## Screenshot Best Practices

- Capture with representative demo data — empty states communicate nothing
- Use realistic data, not "Test User", "Lorem Ipsum", "test@test.com"
- Desktop screenshots are the most important — always capture first
- Dark mode screenshots are a bonus, not required
- Avoid capturing loading states, error screens, or incomplete UI
- If the UI has onboarding modals, dismiss them before capturing
