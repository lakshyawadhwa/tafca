# Phase 0: Project Setup & Scaffolding

## Goal
Set up the monorepo structure, local dev infrastructure (Docker), shared package, and base configurations so all subsequent phases have a working foundation.

---

## 0.1 Monorepo Initialization

### Commands
```bash
mkdir ca-practice-os && cd ca-practice-os
pnpm init
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".svelte-kit/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "db:migrate": {},
    "db:seed": {}
  }
}
```

### Root `package.json` scripts
```json
{
  "name": "ca-practice-os",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "dev:api": "turbo run dev --filter=api",
    "dev:web": "turbo run dev --filter=web",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:migrate": "turbo run db:migrate --filter=api",
    "db:seed": "turbo run db:seed --filter=api"
  },
  "devDependencies": {
    "turbo": "^2.x",
    "typescript": "^5.x"
  },
  "packageManager": "pnpm@9.x"
}
```

---

## 0.2 Docker Compose (Local Dev)

### `docker-compose.yml`
```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    container_name: capracticeos-db
    environment:
      POSTGRES_DB: ca_practice_os
      POSTGRES_USER: capracticeos
      POSTGRES_PASSWORD: localdev123
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: capracticeos-redis
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  minio:
    image: minio/minio:latest
    container_name: capracticeos-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # Console UI
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  redisdata:
  miniodata:
```

### Start local infra
```bash
docker compose up -d
```

### Create S3 bucket in MinIO
```bash
# Via MinIO client (mc)
docker exec capracticeos-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec capracticeos-minio mc mb local/ca-practice-os-documents

# Or via MinIO Console: http://localhost:9001
```

---

## 0.3 Shared Package (`packages/shared`)

### Initialize
```bash
mkdir -p packages/shared/src/{enums,constants,types,dto}
cd packages/shared && pnpm init
```

### `packages/shared/package.json`
```json
{
  "name": "@ca-practice-os/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "typescript": "^5.x"
  }
}
```

### `packages/shared/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

### Files to Create

#### `src/enums/index.ts` — Re-exports all enums

#### `src/enums/user-role.enum.ts`
```typescript
export enum UserRole {
  PARTNER = 'PARTNER',
  MANAGER = 'MANAGER',
  JUNIOR_CA = 'JUNIOR_CA',
  ARTICLE = 'ARTICLE',
  ADMIN = 'ADMIN',
}
```

#### `src/enums/task-status.enum.ts`
```typescript
export enum TaskStatus {
  TO_DO = 'TO_DO',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_CLIENT = 'AWAITING_CLIENT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PARTNER_APPROVAL = 'PARTNER_APPROVAL',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}
```

#### All other enums (one file each)
Create one enum file for each of the 29 enum types listed in the architecture plan:
- `task-priority.enum.ts` — LOW, MEDIUM, HIGH, URGENT
- `task-action.enum.ts` — CREATED, STATUS_CHANGED, ASSIGNEE_CHANGED, etc. (14 values)
- `entity-type.enum.ts` — INDIVIDUAL, HUF, PARTNERSHIP_FIRM, etc. (11 values)
- `constitution.enum.ts` — PROPRIETORSHIP, PARTNERSHIP, COMPANY, etc. (7 values)
- `client-status.enum.ts` — ACTIVE, INACTIVE, PROSPECT
- `engagement-category.enum.ts` — GST, INCOME_TAX, TDS, etc. (9 values)
- `engagement-status.enum.ts` — ACTIVE, ON_HOLD, COMPLETED, CANCELLED
- `recurrence.enum.ts` — ONE_OFF, MONTHLY, QUARTERLY, HALF_YEARLY, ANNUALLY
- `subscription-tier.enum.ts` — FREE, STARTER, PROFESSIONAL, ENTERPRISE
- `document-type.enum.ts` — GENERAL, CLIENT_PROVIDED, WORKING_PAPER, etc. (17 values)
- `document-source.enum.ts` — TEAM_UPLOAD, CLIENT_UPLOAD, AUTO_GENERATED
- `document-request-status.enum.ts` — PENDING, REMINDED, FULFILLED, CANCELLED
- `checklist-item-status.enum.ts` — PENDING, REQUESTED, RECEIVED, VERIFIED, WAIVED
- `portal.enum.ts` — GST, INCOME_TAX, MCA, TRACES, etc. (12 values)
- `dsc-class.enum.ts` — CLASS_2, CLASS_3
- `dsc-type.enum.ts` — INDIVIDUAL, ORGANISATION, DGFT
- `dsc-status.enum.ts` — ACTIVE, EXPIRED, REVOKED, RENEWED
- `dsc-holder-type.enum.ts` — CLIENT, PARTNER
- `leave-type.enum.ts` — CASUAL, SICK, EXAM, TRAINING, PUBLIC_HOLIDAY, OTHER
- `leave-status.enum.ts` — PENDING, APPROVED, REJECTED, CANCELLED
- `notification-type.enum.ts` — 18 values from PRD section 12.1
- `notification-channel.enum.ts` — IN_APP, EMAIL, WHATSAPP
- `notification-status.enum.ts` — PENDING, SENT, FAILED, READ
- `compliance-entry-status.enum.ts` — PENDING, IN_PROGRESS, FILED, MISSED, NOT_APPLICABLE
- `credential-action.enum.ts` — VIEWED, COPIED, UPDATED, CREATED
- `gst-registration-type.enum.ts` — REGULAR, COMPOSITION, CASUAL, SEZ, ISD
- `custom-field-type.enum.ts` — TEXT, NUMBER, DATE, DROPDOWN, BOOLEAN, URL

#### `src/constants/task-status-transitions.ts`
```typescript
import { TaskStatus } from '../enums/task-status.enum';

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TO_DO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [
    TaskStatus.AWAITING_CLIENT,
    TaskStatus.UNDER_REVIEW,
    TaskStatus.PARTNER_APPROVAL,
    TaskStatus.TO_DO,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.AWAITING_CLIENT]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.UNDER_REVIEW]: [
    TaskStatus.IN_PROGRESS,
    TaskStatus.PARTNER_APPROVAL,
    TaskStatus.DONE,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.PARTNER_APPROVAL]: [
    TaskStatus.UNDER_REVIEW,
    TaskStatus.IN_PROGRESS,
    TaskStatus.DONE,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.DONE]: [],
  [TaskStatus.CANCELLED]: [],
};
```

#### `src/constants/regex-patterns.ts`
```typescript
export const REGEX = {
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  TAN: /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/,
  CIN: /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  E164_PHONE: /^\+[1-9]\d{6,14}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  SNAKE_CASE_KEY: /^[a-z][a-z0-9_]{0,49}$/,
};
```

#### `src/constants/limits.ts`
```typescript
export const LIMITS = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  MAX_TAGS_PER_ENTITY: 10,
  MAX_TAG_LENGTH: 50,
  MAX_CHECKLIST_ITEMS_PER_TASK: 30,
  MAX_CUSTOM_FIELDS_PER_FIRM: 20,
  MAX_CUSTOM_FIELD_OPTIONS: 50,
  MAX_MENTIONS_PER_COMMENT: 10,
  MAX_CONCURRENT_SESSIONS: 5,
  MAX_DOCUMENT_REMINDER_COUNT: 3,
  PRESIGNED_URL_EXPIRY_SECONDS: 900, // 15 minutes
  COMMENT_MAX_LENGTH: 5000,
  TASK_TITLE_MAX_LENGTH: 300,
  TASK_DESCRIPTION_MAX_LENGTH: 10000,
};
```

#### `src/constants/mime-types.ts`
```typescript
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/zip',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
```

#### `src/types/address.type.ts`
```typescript
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string; // default: "IN"
}
```

#### `src/types/firm-settings.type.ts`
```typescript
export interface FirmSettings {
  default_internal_deadline_buffer_days: number;
  auto_task_generation_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
  compliance_calendar_auto_populate: boolean;
  require_partner_approval_for: string[];
}
```

#### `src/types/notification-preferences.type.ts`
```typescript
export interface NotificationPreferences {
  in_app: boolean;
  email: boolean;
  whatsapp: boolean;
  muted_until: string | null; // ISO date string or null
}
```

#### `src/types/recurrence-config.type.ts`
```typescript
export interface RecurrenceConfig {
  frequency: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'ANNUALLY';
  day_of_month: number;
  month_of_quarter?: number;
  advance_create_days: number;
  auto_assign: boolean;
}
```

#### `src/index.ts`
```typescript
export * from './enums';
export * from './constants/task-status-transitions';
export * from './constants/regex-patterns';
export * from './constants/limits';
export * from './constants/mime-types';
export * from './types/address.type';
export * from './types/firm-settings.type';
export * from './types/notification-preferences.type';
export * from './types/recurrence-config.type';
```

---

## 0.4 NestJS Backend Scaffold (`apps/api`)

### Initialize
```bash
cd apps
npx @nestjs/cli new api --package-manager pnpm --skip-git
cd api
```

### Install dependencies
```bash
# Core
pnpm add @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
pnpm add @prisma/client
pnpm add ioredis @nestjs/bullmq bullmq
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm add bcrypt class-validator class-transformer
pnpm add uuid

# Dev
pnpm add -D prisma @types/passport-jwt @types/bcrypt @types/uuid
```

### Add workspace dependency
```json
// In apps/api/package.json
{
  "dependencies": {
    "@ca-practice-os/shared": "workspace:*"
  }
}
```

### `apps/api/package.json` scripts
```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  }
}
```

---

## 0.5 SvelteKit Frontend Scaffold (`apps/web`)

### Initialize
```bash
cd apps
npx sv create web
# Select: SvelteKit minimal, TypeScript, TailwindCSS
cd web
```

### Install dependencies
```bash
pnpm add @ca-practice-os/shared
```

### `apps/web/package.json` scripts
```json
{
  "scripts": {
    "dev": "vite dev --port 5173",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  }
}
```

---

## 0.6 Environment Configuration

### `.env.example` (root)
```env
# Database
DATABASE_URL=postgresql://capracticeos:localdev123@localhost:5432/ca_practice_os

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=change-me-to-64-char-random-string-in-production-use-openssl-rand
JWT_ISSUER=ca-practice-os

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=ca-practice-os-documents
S3_PRESIGNED_URL_EXPIRY=900

# Encryption (Credential Locker)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Email
EMAIL_PROVIDER=postmark
POSTMARK_SERVER_TOKEN=
EMAIL_FROM=noreply@capracticeos.com

# WhatsApp
WHATSAPP_PROVIDER=gupshup
WHATSAPP_API_KEY=
WHATSAPP_FROM_NUMBER=

# App
APP_PORT=3000
APP_URL=http://localhost:5173
NODE_ENV=development
LOG_LEVEL=debug
```

### Copy for local dev
```bash
cp .env.example apps/api/.env
```

---

## 0.7 `.gitignore`
```
node_modules/
dist/
.svelte-kit/
.env
.env.local
*.log
.turbo/
.DS_Store
```

---

## 0.8 Verification Checklist

- [ ] `docker compose up -d` starts PostgreSQL, Redis, MinIO without errors
- [ ] `psql -h localhost -U capracticeos -d ca_practice_os` connects
- [ ] `redis-cli ping` returns PONG
- [ ] MinIO console accessible at http://localhost:9001
- [ ] `pnpm install` at root resolves all workspace dependencies
- [ ] `pnpm dev:api` starts NestJS on port 3000
- [ ] `pnpm dev:web` starts SvelteKit on port 5173
- [ ] `packages/shared` is importable from both `apps/api` and `apps/web`
