# Tasks — 2026-04-25

Tech specs for next batch of work. One main story + three cheap wins.

Order = recommended ship order (cheap wins first, then comments).

---

## Cheap Win 1 — Story 4.1: Top-level error boundary + 429 lockout

### Goal
Stop one bad route from white-screening the app. Surface 429 to user with a self-clearing lockout.

### Non-goals
- Per-route boundaries (V1 ships single global one)
- Sentry / remote error reporting (deferred per pending-items §7)
- Retry UI on every failed fetch — only on the route-level throw

### Design

**Top-level boundary** in `App.svelte`:
- Svelte 5 has no built-in error boundary primitive at component level for *render-time* errors, but **route-level throws and unhandled promise rejections** can be caught with:
  - `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)` in `App.svelte` `onMount`
  - On catch: set `boundaryError = $state<Error | null>(null)`; render fallback when set
- Fallback UI: heading "Something went wrong", short message, "Try again" button (clears state + re-mounts current route via `replace(getPath())`)
- Always allow user to "Go to dashboard" (`navigate('/')`)

**429 lockout in `apiFetch`** (`apps/web/src/lib/api.ts`):
- New module-level `let lockoutUntil = 0`
- Before fetch: if `Date.now() < lockoutUntil` → throw `ApiError(429, { message: 'Too many requests' })` immediately, no network
- On `res.status === 429`: set `lockoutUntil = Date.now() + 5_000` and addToast "Too many requests — wait 5s"
- Export `getLockoutRemainingMs(): number` so forms can disable submit during lockout

### API contracts
None new. `api.ts` already throws `ApiError` on 4xx.

### Files
- `apps/web/src/App.svelte` — onMount listeners + fallback render block
- `apps/web/src/lib/api.ts` — lockout state + 429 handling
- `apps/web/src/components/ErrorFallback.svelte` — new, renders the fallback

### Tasks
1. Add `ErrorFallback.svelte` (heading + message + retry/dashboard buttons)
2. Wire window error/rejection listeners in `App.svelte`
3. Patch `apiFetch` with module-level lockout
4. Playwright: `error-boundary.spec.ts` — force a window error via `page.evaluate(() => { throw new Error('boom') })`, assert fallback heading visible, click retry, fallback gone

### Risks
- Window listeners catch *every* unhandled rejection app-wide. Some queries throw to be caught by `createMutation.onError` — those go through query-promise and are handled, not unhandled. Verify nothing legit gets caught.
- Mitigation: only set boundaryError when error is truly unhandled (svelte-query rejected promises are handled by the lib).

### Estimated size
~100 lines + 1 Playwright test. 1 commit.

---

## Cheap Win 2 — Story 1.3: Unsaved-changes guard

### Goal
User edits a form, navigates away, gets warned. Applies to: ClientForm, EngagementCreate, TaskDetail metadata sidebar.

### Non-goals
- Generic "form-state" framework. Three callsites get one shared hook + done.
- In-page route confirms beyond `confirm()` dialog. (Custom modal = scope creep.)

### Design

**Shared hook** in `apps/web/src/lib/unsaved-guard.svelte.ts`:
```ts
export function useUnsavedGuard(isDirty: () => boolean, message?: string) {
  $effect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  });

  // Wrap router.navigate so in-app nav also confirms.
  return {
    guardedNavigate(to: string) {
      if (isDirty() && !confirm(message ?? 'Discard unsaved changes?')) return;
      navigate(to);
    },
  };
}
```

**Per-form integration:**
- ClientForm: track `isDirty` via diff against initial values (or a single `dirty = $state(false)` flag set on first input). Replace `navigate()` calls in Cancel/Back buttons with `guardedNavigate()`.
- EngagementCreate: Agent A already added a guard inline — refactor to use the hook (consistency).
- TaskDetail: only the metadata sidebar fields. Wire when sidebar gets dirty-state work (story 3.3 — out of scope here, but spec reuses same hook).

### Files
- `apps/web/src/lib/unsaved-guard.svelte.ts` — new
- `apps/web/src/pages/ClientForm.svelte` — wire
- `apps/web/src/pages/EngagementCreate.svelte` — refactor to hook

### Tasks
1. Write hook + verify Svelte 5 `$effect` cleanup runs on component unmount
2. Wire ClientForm
3. Refactor EngagementCreate (drop inline beforeunload/cancel logic)
4. Playwright: `unsaved-guard.spec.ts` — fill ClientForm display name, click Back, expect `dialog.accept(false)` keeps user on form; second attempt with accept(true) navigates away

### Risks
- `confirm()` is synchronous + ugly but built-in. Spec accepts this for V1.
- `beforeunload` doesn't fire reliably on mobile/tab-close in some browsers. Acceptable — it's belt-and-suspenders.

### Estimated size
~80 lines hook + per-form glue. 1 Playwright test. 1 commit.

---

## Cheap Win 3 — Story 4.2: Analytics event wiring (console-only)

### Goal
Decide event names + payloads now. Wire `track()` everywhere they fire. V1 stays `console.info`. Swap to real vendor in V2 = one file change.

### Non-goals
- Vendor decision (deferred per pending-items §1)
- `/api/events` endpoint
- Consent UI

### Design

**Module** `apps/web/src/lib/analytics.ts`:
```ts
const ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED === 'true';

type EventName =
  | 'client_create_completed'
  | 'engagement_create_completed'
  | 'task_create_completed'
  | 'task_status_changed'
  | 'checklist_item_toggled'
  | 'comment_submitted'
  | 'kanban_drag_completed';

export function track(event: EventName, props: Record<string, string | number | boolean> = {}) {
  if (!ENABLED) return;
  const user = getUser();
  console.info('[track]', event, {
    ...props,
    firm_id: user?.firmId,
    user_id: user?.id,
    ts: new Date().toISOString(),
  });
}
```

**Callsites:**
| Event | Location | Props (no PII) |
|---|---|---|
| `client_create_completed` | ClientForm onSuccess | `{ entityType }` |
| `engagement_create_completed` | EngagementCreate onSuccess | `{ engagementTypeCode, autoCreateTasks: boolean }` |
| `task_create_completed` | TaskCreate onSuccess | `{ priority, hasEngagement: boolean }` |
| `task_status_changed` | TaskDetail status mutation onSuccess | `{ from, to }` |
| `checklist_item_toggled` | ChecklistSection toggle onSuccess | `{ isCompleted: boolean }` |
| `comment_submitted` | CommentCompose onSuccess (story 3.6) | `{ hasMentions: boolean, isReply: boolean }` |
| `kanban_drag_completed` | Kanban drag handler (story 3.1 kanban — future) | `{ from, to }` |

**Env**: add `VITE_ANALYTICS_ENABLED=true` to `apps/web/.env.example` (commit) and dev `.env` (don't commit).

### Files
- `apps/web/src/lib/analytics.ts` — new
- `apps/web/src/pages/ClientForm.svelte` — call `track`
- `apps/web/src/pages/EngagementCreate.svelte`
- `apps/web/src/pages/TaskCreate.svelte`
- `apps/web/src/pages/TaskDetail.svelte`
- `apps/web/src/components/ChecklistSection.svelte`
- `apps/web/.env.example`

### Tasks
1. Write `analytics.ts`
2. Wire 5 callsites (kanban + comment deferred — slot in with their stories)
3. Add env example
4. Smoke-verify in dev: `console.info` visible

### Risks
- PII leaks via props. Mitigation: every prop reviewed in PR (table above is the contract).
- Forgetting to update event union when new events added. Mitigation: union type forces compile error if `track('foo' as any)` slips.

### Estimated size
~60 lines lib + ~5 lines per callsite. 0 Playwright tests (`console.info` not worth E2E). 1 commit.

---

## Main story — 3.6: Task Comments + @Mentions

### Goal
Threaded comments on a task. Authors edit/delete own. Mentions notify users. Soft-delete preserves replies.

### Non-goals
- Reactions / emoji
- Attachments (deferred with documents module)
- Real-time push (V1 = poll/refetch on focus)
- Rich text (plain text + mention chips only)

### BE audit (sub-task 0)
Verify before FE work:
- `POST /api/tasks/:id/comments` returns hydrated `{ author, mentions: User[] }`?
- `DELETE` soft-deletes (sets `deletedAt`), list still includes with `deleted: true` flag when `replies.length > 0`?
- Mention notifications emitted on POST?
- `403` on edit/delete when not author + not admin?

If any gap → fix in `apps/api/src/task/task-comment.service.ts` as sub-task 0. Commit separately.

### FE design

**Component layout** (mounts in `TaskDetail` body, below `DependencySection`):
```
CommentSection.svelte
├── CommentCompose.svelte           top-level new comment
└── CommentList.svelte
    └── CommentNode.svelte           recursive (one nesting level — flatten deeper)
        ├── CommentNode (replies)
        └── CommentCompose           reply mode
```

**State:**
- `createQuery(toStore(() => ({ queryKey: ['task', id, 'comments'], ... })))` — already wired in TaskDetail
- Optimistic add via `createMutation` + manual cache update
- Optimistic edit/delete same pattern
- `getUser()` drives edit/delete button visibility

**@mention input:**
- Plain `<textarea>` + custom popup component
- On `@` keystroke: capture caret position, open popup with `UserPicker` filtered by typed query against `/api/users?search=<q>&isActive=true`
- On select: insert `@[FullName](userId)` token in plain text + push `userId` to `mentions[]`
- Render: regex `\[([^\]]+)\]\(([^)]+)\)` → `<span class="text-blue-600">@FullName</span>`

**Soft-deleted rendering:**
- `deleted_at != null` AND has children → `<em class="text-gray-400">[comment deleted]</em>` keeping replies
- `deleted_at != null` AND no children → omit entirely

**Optimistic state shape:**
```ts
type OptimisticComment = Comment & {
  _pending?: boolean;     // POST in flight
  _failed?: boolean;      // POST rejected — show retry
};
```

### API contracts (verify against BE in sub-task 0)

```
POST /api/tasks/:id/comments
Body: { body, mentions: string[], parent_comment_id? }
Response 201: Comment (hydrated)

GET /api/tasks/:id/comments?limit=50&page=1
Response 200: { data: Comment[], meta: { total, page, limit } }

type Comment = {
  id: string;
  body: string;
  authorId: string;
  author: { id, fullName, avatarUrl };
  parentCommentId: string | null;
  mentions: Array<{ id, fullName }>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  replies?: Comment[];
}
```

### Permissions
- `comment:create` — all roles
- `comment:edit` — `own` for everyone (already in matrix)
- `comment:delete` — `own` for non-admin, `all` for admin

FE gates hide edit/delete buttons when `!can('comment','edit',{ownerId: c.authorId})`. BE re-checks.

### Files
- `apps/web/src/components/CommentSection.svelte` — new (orchestrator)
- `apps/web/src/components/CommentCompose.svelte` — new (textarea + submit, reply-mode prop)
- `apps/web/src/components/MentionPopup.svelte` — new (`@` trigger + user search + keyboard nav)
- `apps/web/src/components/CommentNode.svelte` — new (render body, edit-in-place, delete, reply, recursive replies)
- `apps/web/src/pages/TaskDetail.svelte` — mount `<CommentSection />` + drop existing inline comment block if any
- `apps/api/src/task/task-comment.service.ts` — patch if BE audit finds gaps

### Tasks (in order)
1. **BE audit** — curl each endpoint + confirm response shapes. Patch service if needed. Commit `fix(comments): hydrate mentions / preserve replies on soft delete` if work found.
2. **CommentSection.svelte** — wraps existing query, mounts compose + list, handles optimistic cache merges
3. **CommentCompose.svelte** — textarea + submit, reply-mode prop
4. **MentionPopup.svelte** — `@` trigger detection (caret position via Range API), debounced user search, ↑↓ Enter Esc, insert token
5. **CommentNode.svelte** — render body (parse mentions to chips), edit-in-place, delete confirm, reply button → child compose, recursive `replies[]` render (depth 1, flatten beyond)
6. **Wire `track('comment_submitted', ...)`** — analytics callsite from Cheap Win 3
7. **Playwright** — `comments.spec.ts`:
   - Post a comment, mention sibling user, verify mention chip rendered
   - Edit own comment
   - Delete own comment → `[comment deleted]` visible
   - Sibling user logs in, sees comment, no edit/delete buttons

### Risks
- **Mention popup positioning** — caret-following popups in plain `<textarea>` are notoriously bad. Mitigation: position popup *below* the textarea, not at caret. Lose precision but ship.
- **Optimistic cache shape** — nested comments make merges fiddly. Mitigation: invalidate-and-refetch on success (skip optimistic) for V1 if it gets hairy.
- **Mention notification spam** — if BE emits one notification per mention, mass mention = pain. BE concern, defer; just track surface.
- **Edit window** — spec doesn't say if edit unbounded. Default unbounded; add 15-min cap later if abuse seen.

### Acceptance (matches v2 spec lines 537-550)
- [ ] Thread renders with avatar, name, time-ago, body, reply button
- [ ] `@` opens picker filtered to active users; insert chip
- [ ] Reply scoped to parent comment
- [ ] Soft-deleted with replies → `[comment deleted]`
- [ ] Optimistic append with pending indicator, confirm on 201
- [ ] Edit → textarea pre-filled with body
- [ ] Tests: optimistic-then-rollback, mention of active-only user, soft-delete-with-replies render

### Estimated size
~600 lines FE across 4 components. ~100 lines test. 1 BE patch (likely small, may be no-op). 4–6 commits.

---

## Ship plan

| Order | Item | Size | Why first |
|---|---|---|---|
| 1 | CW1 — Error boundary + 429 lockout | ~100 lines | Bug shield. Protects everything below. |
| 2 | CW3 — Analytics console wiring | ~60 + glue | Free. Locks event names before more callsites land. |
| 3 | CW2 — Unsaved-changes guard | ~80 + glue | Reuses analytics pattern. Refactor EngagementCreate. |
| 4 | Story 3.6 — Comments + @mentions | ~600 + tests | Biggest feature; build on stable base. |

Total: ~6 commits, ~1 day solo. Parallelizable: CW1 + CW3 are independent and can run as two agents. CW2 has small ClientForm overlap with CW3 analytics callsite — sequence after.

### Risks across the batch
- All four touch shared FE infra (App.svelte, api.ts, lib/). Ordering above prevents merge conflicts.
- No new BE schema. No migrations.
- Playwright suite grows from 8 → ~12 tests. Run time should stay under 60s (current ~40s).

---

## Out of scope (still pending, defer)
- Story 1.2 polish — partner/tags filter, GST count column, skeleton, DataTable abstraction
- Story 1.3 deeper — GST add/remove section, UserPicker by role, 409 inline mapping
- Story 1.4 — copy-to-clipboard, inline GST add, EngagementCard progress bar, 404 friendly
- Story 3.1 kanban view — own epic, big design surface
- Story 3.2 — 2-level client→engagement picker, assignee≠reviewer error, internal_due_date
- Story 3.3 — explicit save button on metadata sidebar, allowed-transitions dropdown, DONE 409 modal, inline title/desc edit
- Story 3.7 — activity timeline (waits for action enum exhaustive map)
