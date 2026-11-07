# Implementation Plan: Library Lending

**Date**: 2026-11-05 | **Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md)

## Summary

A NestJS API and a React SPA backed by PostgreSQL. Copies are numbered 1..N inside each book, the
same way task 3 numbers seats inside a grid. A partial unique index allows one open loan per copy,
so the last copy can never be lent twice. Every change to a book's availability (checkout,
reservation, return, hold expiry, copy count change) runs in one transaction that first locks the
book row `FOR UPDATE`, so the queue is served in order and a held copy cannot be taken by someone
else. Fines and holds use an injected clock, and configuration lives in the database and is read
on every operation.

The structure, error envelope, auth guards, clock, settings service and test harness are copied
from task 3, so the four projects work the same way.

## Technical Context

| Item | Decision |
|------|----------|
| Language | TypeScript (strict) for backend and frontend |
| Runtime | Node.js 22 LTS |
| Backend | NestJS 11, TypeORM 0.3, `pg`, `@nestjs/jwt`, `bcryptjs`, `class-validator`, `@nestjs/swagger` |
| Database | Local PostgreSQL 16+ server (managed with DBeaver), no Docker. Schema only through migrations (`synchronize: false`). |
| Frontend | React 18, Vite, Material UI 7, React Router 6 |
| Tests | Jest + Supertest. Unit tests for the pure rules; e2e tests against a separate test database with a fixed clock. |
| Config | One `.env` in the task folder, validated at startup. No hard-coded hosts, ports or secrets. |
| Ports | DB 5432 (local server), API 3050, web 5177 (tasks 1–3 use up to 3040/5176). |

## Quality Gates

| Gate | Check |
|------|-------|
| G1 | Every role and rule is enforced on the server (LL-01, LL-DM-4). |
| G2 | No copy can have two open loans, whatever the caller does (LL-DM-3). |
| G3 | Every rule reads configuration when it runs, never at startup (LL-DM-5). |
| G4 | Fines and expiry depend only on the injected clock (LL-DM-1). |
| G5 | Every spec test ID has a passing test (SC-01). |
| G6 | No environment values in code; all in `.env.example` and the env schema. |

## Project Structure

```text
task-4-library-lending/
├── .env.example   README.md
├── specs/               spec.md, plan.md, tasks.md
├── backend/
│   ├── src/
│   │   ├── main.ts  app.module.ts  app-setup.ts
│   │   ├── config/env.validation.ts
│   │   ├── common/          clock/, exceptions/app-error.ts, filters/, pipes/, decorators/trim
│   │   ├── database/        data-source.ts, migrations/, seeds/ (seed-data.ts, seed.ts, run-seed.ts)
│   │   ├── auth/  users/    login, me, JWT + roles guards
│   │   ├── settings/        the six lending settings
│   │   ├── books/           catalogue: create, edit (copy count), list and search with availability
│   │   └── lending/
│   │       ├── copy-queue.ts            lockBook, copiesInUse, offerFreeCopies, processExpiredHolds, unpaidBalance
│   │       ├── loans.service.ts         checkout, return, open loans list
│   │       ├── reservations.service.ts  reserve, cancel
│   │       ├── accounts.service.ts      member account page, member list, payments
│   │       ├── hold-expiry.service.ts   background job
│   │       └── utils/lending-rules.util.ts (+ .spec.ts)   all pure rules
│   └── test/                *.e2e-spec.ts, support/ (test app, fixed clock, factories, library world)
└── frontend/src/
    ├── api/  auth/  layout/  components/  theme.ts  format.ts
    ├── catalogue/  CataloguePage, BookFormDialog
    ├── account/    AccountPage (member), AccountView (shared)
    ├── loans/      LoansPage (librarian returns)
    ├── members/    MembersPage, MemberDetailPage, PaymentDialog
    └── settings/   SettingsPage
```

## Data Model

```text
users          id uuid PK, email unique (lower-case), name, password_hash,
               role user_role ('member','librarian'), created_at
settings       key PK, value int, updated_by FK users NULL, updated_at
books          id uuid PK, title varchar(200) non-blank, author varchar(200) non-blank,
               total_copies int CHECK 0..100, created_at, updated_at
loans          id uuid PK, book_id FK, copy_number smallint CHECK >= 1, member_id FK users,
               checked_out_at, due_at CHECK > checked_out_at, returned_at NULL, returned_by FK users NULL,
               days_late int NULL, fine_cents int CHECK >= 0 DEFAULT 0, created_at
               CHECK (returned_at IS NULL) = (days_late IS NULL)
               CHECK returned_at IS NOT NULL OR fine_cents = 0
               UNIQUE INDEX ux_loans_open_copy (book_id, copy_number) WHERE returned_at IS NULL
               UNIQUE INDEX ux_loans_open_member_book (book_id, member_id) WHERE returned_at IS NULL
reservations   id uuid PK, queue_seq bigint identity UNIQUE, book_id FK, member_id FK users,
               status reservation_status ('waiting','ready','fulfilled','expired','cancelled'),
               held_copy_number smallint NULL, ready_at NULL, hold_expires_at NULL, closed_at NULL,
               loan_id FK loans NULL, created_at
               CHECK status <> 'waiting' OR held_copy_number IS NULL
               CHECK status <> 'ready' OR (held_copy_number, ready_at, hold_expires_at all set)
               CHECK status <> 'fulfilled' OR loan_id IS NOT NULL
               UNIQUE INDEX ux_reservations_ready_copy (book_id, held_copy_number) WHERE status = 'ready'
               UNIQUE INDEX ux_reservations_one_active (book_id, member_id) WHERE status IN ('waiting','ready')
fine_payments  id uuid PK, member_id FK users, amount_cents int CHECK > 0, note varchar(200) NULL,
               recorded_by FK users, created_at
```

A copy is **on loan** while it has a loan with `returned_at` null, **held** while a `ready`
reservation names it, and **free** otherwise. Availability, queue position and balance are
calculated on every read and never stored. `queue_seq` gives a strict first-come order even when
two reservations share a timestamp.

## Where the last copy is protected

1. **Database (the guarantee).** `ux_loans_open_copy` refuses a second open loan of a copy from any
   connection. Two checkouts that pick the same last copy cannot both commit.
2. **Book lock (order).** Every availability change locks the book row `FOR UPDATE`, so changes to
   one book run one at a time. A checkout therefore sees the copies held for the queue, and a
   return hands its copy to the queue before anyone else can take it.
3. **Service (friendly errors).** The service checks for a free copy first so it can say
   `NO_COPY_AVAILABLE`; a `23505` on `ux_loans_open_copy` is mapped to the same error.
4. **Interface (convenience only).** Borrow buttons are hidden when nothing is free.

## Transactions

Every write starts with `lockBook(manager, bookId)` and `processExpiredHolds(manager, now, bookId)`.

- **Checkout**: open loan of this book → `ALREADY_BORROWED`; balance > threshold →
  `BORROWING_BLOCKED`; open loans ≥ max → `LOAN_LIMIT_REACHED`; the member's `ready` reservation
  gives its held copy (reservation → `fulfilled`), otherwise the lowest free copy, otherwise
  `NO_COPY_AVAILABLE`. Insert the loan due `now + loanPeriodDays`.
- **Return**: loan must be open (`INVALID_STATE`); `daysLate`, fine; then `offerFreeCopies(now)`.
- **Reserve**: `ALREADY_BORROWED`, `ALREADY_RESERVED`, `BORROWING_BLOCKED`, free copy → `COPIES_AVAILABLE`; insert `waiting`.
- **Cancel reservation**: owner only; `waiting` → `cancelled`; `ready` → `cancelled` then `offerFreeCopies(now)`; otherwise `INVALID_STATE`.
- **Copy count change**: lower count refused with `COPIES_IN_USE` if a removed copy is on loan or held; then `offerFreeCopies(now)`.
- **Payment**: lock the member's user row `FOR UPDATE`; amount ≤ balance or `PAYMENT_EXCEEDS_BALANCE`.

`offerFreeCopies(manager, bookId, at)`: while there is a free copy and a waiting reservation, the
first waiting reservation (lowest `queue_seq`) becomes `ready` for the lowest free copy with
`ready_at = at`, `hold_expires_at = at + reservationHoldHours`.

`processExpiredHolds(manager, now, bookId)`: repeatedly take the earliest `ready` reservation with
`hold_expires_at <= now`, mark it `expired` with `closed_at = hold_expires_at`, then
`offerFreeCopies(at = hold_expires_at)`. Because the next hold starts at the previous expiry
instant, the outcome is the same whether the job runs on time or days late.

`HoldExpiryService` runs `processExpiredHolds` for every book with an expired hold, one book per
transaction, every `HOLD_SWEEP_INTERVAL_SECONDS` (env; `0` turns it off, as the e2e tests do and
call it directly with the fixed clock).

## API

All routes under `/api`. Swagger UI at `/api/docs`.

| Method & path | Roles | Purpose |
|---------------|-------|---------|
| POST /auth/login, GET /auth/me | public / any | Sign in, current user |
| GET /books?search=&filter=&limit=&cursor= | any | One page of the catalogue (keyset cursor, `limit` ≤ 60), with availability; members also get `myLoan`, `myReservation` |
| GET /books/:id | any | One book |
| POST /books, PATCH /books/:id | librarian | Add, edit (including copy count) |
| POST /books/:id/checkout | member | Borrow a copy |
| POST /books/:id/reservations | member | Join the queue |
| POST /reservations/:id/cancel | member (owner) | Leave the queue or give up a hold |
| GET /loans?overdue=&search=&page=&pageSize= | librarian | One page of open loans, plus desk totals |
| POST /loans/:id/return | librarian | Return, with fine and who the copy is now held for |
| GET /members?search=&page=&pageSize= | librarian | One page of members with loans, overdue, balance, blocked, plus totals |
| GET /members/:id/account | librarian, or the member themself | Account totals, counts and ready holds |
| GET /members/:id/loans?state=open\|returned\|fined, /reservations, /payments | librarian, or the member themself | One page of that list (`page`, `pageSize` ≤ 100) |
| POST /members/:id/payments | librarian | Record a fine payment |
| GET /settings, PATCH /settings | any / librarian | Read, change settings |

## Paging

- **Catalogue**: keyset paging on `(lower(title), id)`. The response carries an opaque `nextCursor`, so every page costs the same however deep it is, and books added meanwhile are never repeated or skipped. `ix_books_sort` backs the sort; `pg_trgm` GIN indexes on title and author back the "contains" search. The UI loads the next page as the user scrolls near the end of the grid, with a "Load more" button as a fallback.
- **Account lists, loans desk, members**: offset paging with `page` and `pageSize` (≤ 100) and a `total`, shown with page controls. The account endpoint returns only totals and counts; open loans are capped by the loan limit, so the overdue total is cheap.

## Rules (`lending/utils/lending-rules.util.ts`)

| Function | Rule | Error |
|----------|------|-------|
| `dueAt(checkedOutAt, days)` | + days × 24 h | – |
| `daysLate(dueAt, returnedAt)` | 0 if on time, else started days late | – |
| `computeFine(daysLate, perDay, cap)` | min(daysLate × perDay, cap) | – |
| `isBlocked(balance, threshold)` | balance > threshold | `BORROWING_BLOCKED` |
| `holdExpiresAt(at, hours)` | + hours | – |
| `isHoldExpired(expiresAt, now)` | now ≥ expiresAt | – |
| `lowestFreeCopy(total, taken)` | lowest of 1..total not taken | `NO_COPY_AVAILABLE` |

## Settings

The task 3 `SettingsService` pattern with the six definitions in `settings.constants.ts`; values
are read from the table on every call; an update validates and saves the whole change at once.

## Seed

`seed-data.ts` holds the accounts, 40 books (title, author, copies) and 25 loans as (member, book,
days ago, returned days ago or open), plus payments and reservations. `seed.ts` computes due dates
and fines with the same rules as the API, checks the copy and loan-limit rules, and writes
everything in one transaction, so the database constraints check it again. It does nothing if the
librarian account already exists.

## Frontend

The `api` client and auth context come from task 3. The look is this project's own ("Folio"): warm
paper background, burgundy and brass accents, Fraunces serif headings with Source Sans 3 text, and
a dark left sidebar (a slide-out menu on phones) instead of a top bar. Navigation depends on the role:

- **Member**: Catalogue (book cards with search and filters: Borrow, Reserve, queue position, ready holds), My account (summary tiles and tabs for loans, reservations, fines and history).
- **Librarian**: Catalogue (Add and Edit books), Loans & returns (open and overdue, Return with the fine shown), Members (list, account page, Record payment), Lending rules (the six settings).

## Complexity Tracking

None. No gate is broken.
