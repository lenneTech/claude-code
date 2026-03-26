# Feature Extraction Heuristics

Use these heuristics to identify common features from source code patterns. Each entry maps a feature to the code signals that indicate its presence.

## Authentication & Authorization

| Feature | Code Signal |
|---------|-------------|
| User registration | `register`, `signup`, `createUser` endpoint or mutation |
| User login | `login`, `signin`, `authenticate` endpoint or mutation |
| Password reset | `resetPassword`, `forgotPassword` endpoint |
| Email verification | `verifyEmail`, `confirmEmail` endpoint |
| OAuth / Social login | `passport-google`, `passport-github`, `better-auth` with providers |
| Two-factor auth | `totp`, `2fa`, `authenticator` references |
| Role-based access | `@Roles()`, `hasRole()`, `RoleEnum`, `RoleGuard` |
| JWT authentication | `JwtService`, `JwtStrategy`, `@UseGuards(JwtAuthGuard)` |
| Session-based auth | `express-session`, `SessionModule`, `@Session()` decorator |

## File Management

| Feature | Code Signal |
|---------|-------------|
| File upload | `multer`, `MulterModule`, `@UploadedFile()`, `GridFS` |
| Image processing | `sharp`, `jimp`, `imagemagick`, `image-size` |
| Cloud storage | `aws-sdk` + S3, `@google-cloud/storage`, `azure-storage` |
| File download | `res.download()`, `StreamableFile`, `/files/:id` endpoint |
| Avatar upload | `setAvatar`, `avatar.controller`, `avatar.service` |

## Real-Time Features

| Feature | Code Signal |
|---------|-------------|
| WebSocket | `@WebSocketGateway`, `socket.io`, `ws` package |
| Server-Sent Events | `EventEmitter`, `SseStream`, `text/event-stream` |
| Live notifications | `NotificationsGateway`, `emit('notification')` |
| Real-time updates | `@SubscribeMessage`, `socket.emit` patterns |

## Email & Messaging

| Feature | Code Signal |
|---------|-------------|
| Email sending | `nodemailer`, `@nestjs-modules/mailer`, `sendgrid`, `resend`, `SES` |
| Email templates | `handlebars`, `mjml`, `react-email`, template files in `templates/` |
| SMS | `twilio`, `vonage`, `aws-sns` |
| Push notifications | `web-push`, Firebase FCM, `@novu/node` |
| Webhooks | `/webhooks/` routes, `webhook.controller`, `stripe.webhook` |

## Background Processing

| Feature | Code Signal |
|---------|-------------|
| Job queues | `@nestjs/bull`, `bullmq`, `BullModule.registerQueue` |
| Scheduled tasks | `@Cron()`, `@nestjs/schedule`, `cron`, `node-cron` |
| Event-driven processing | `EventEmitter2`, `@OnEvent()`, `EventBus` |

## Search & Data

| Feature | Code Signal |
|---------|-------------|
| Full-text search | `elasticsearch`, `meilisearch`, `typesense`, `$text: { $search: }` |
| Pagination | `findAndCount`, `skip()`, `take()`, `limit()`, `offset()`, `page` query param |
| Filtering / Sorting | `FilterQuery`, `SortOrder`, query params with `filter`, `sort` |
| Data export | `csv-parser`, `xlsx`, `json2csv`, `/export` endpoint |
| Data import | `multer` + CSV/Excel parsing, `/import` endpoint |
| Aggregations | `$group`, `$sum`, `$avg` in MongoDB, `GROUP BY` in SQL |

## Payments & Commerce

| Feature | Code Signal |
|---------|-------------|
| Stripe payments | `stripe`, `StripeModule`, `stripe.checkout`, `stripe.paymentIntent` |
| Subscriptions | `stripe.subscription`, `plan`, `tier`, `subscription.model` |
| Invoicing | `invoice.model`, `billing.service`, `stripe.invoice` |

## Multi-tenancy & Organizations

| Feature | Code Signal |
|---------|-------------|
| Multi-tenancy | `tenantId`, `organizationId`, `workspace`, `team` model |
| Team management | `team.model`, `member.model`, `invite.service` |
| Organization settings | `organization.service`, `settings.model` |

## Developer Features

| Feature | Code Signal |
|---------|-------------|
| API documentation | `@nestjs/swagger`, `SwaggerModule.setup`, `@ApiOperation` |
| GraphQL API | `@nestjs/graphql`, `GraphQLModule`, `*.resolver.ts`, `.graphql` files |
| REST API | `@Controller`, `@Get`, `@Post` decorators |
| Versioning | `/v1/`, `/v2/`, `@Version()` decorator |
| Rate limiting | `@nestjs/throttler`, `express-rate-limit`, `ThrottlerGuard` |
| Health checks | `@nestjs/terminus`, `HealthController`, `/health` endpoint |
| Metrics / Monitoring | `prom-client`, `@opentelemetry/`, `datadog-metrics` |

## Internationalization

| Feature | Code Signal |
|---------|-------------|
| i18n | `@nestjs/i18n`, `vue-i18n`, `next-intl`, `i18next`, `locale` fields |
| Multi-language content | `translations`, `locales/`, `*.en.json`, `*.de.json` |

## Analytics & Tracking

| Feature | Code Signal |
|---------|-------------|
| Usage analytics | `analytics.service`, `event.model`, `trackEvent` |
| View/click tracking | `viewCount`, `clickCount`, scroll depth tracking |
| User activity logs | `activityLog`, `auditLog`, `userActivity.model` |

## AI / ML Integration

| Feature | Code Signal |
|---------|-------------|
| OpenAI integration | `openai`, `@anthropic/sdk`, `langchain` |
| Embeddings / Vector search | `pgvector`, `pinecone`, `weaviate`, `chroma` |
| AI-generated content | `ChatOpenAI`, `anthropic.messages.create`, `generateText` |
