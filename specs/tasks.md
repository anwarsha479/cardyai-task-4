# Tasks: Library Lending

**Input**: [spec.md](spec.md), [plan.md](plan.md)
**Tests**: Included. Each test name starts with the spec test ID it proves.

Format: `[ID] [P?] [Story] Description`. `[P]` = can run in parallel (different files).

| Label | Story |
|-------|-------|
| US1 | Sign in with a role |
| US2 | Catalogue |
| US3 | Checkout |
| US4 | Returns and fines |
| US5 | Reservation queue |
| US6 | Holds expire on time |
| US7 | No double lending |
| US8 | Member account page |
| US9 | Configuration |
| US10 | Demo seed |

## Phase 1: Setup

- [x] T001 Create `task-4-library-lending/` with `.env.example` and a local `.env` pointing at the local PostgreSQL server.
- [x] T002 [P] Create `backend/` (package.json scripts, tsconfig, nest-cli, Jest unit config, `test/jest-e2e.json`) and install dependencies.
- [x] T003 [P] Create `frontend/` (Vite, React, MUI, Router, `vite.config.ts` reading the task `.env`) and install dependencies.

## Phase 2: Foundational

- [x] T004 Copy the shared pieces from task 3 and adapt them: `config/env.validation.ts`, `common/` (clock, app-error with the lending reason codes, filter, pipe, trim), `app-setup.ts`, `main.ts`.
- [x] T005 Write the migrations: users, settings, books, loans, reservations, fine_payments with the partial unique indexes. List them in `database/data-source.ts`.
- [x] T006 Create the entities: `User`, `Setting`, `Book`, `Loan`, `Reservation`, `FinePayment`.
- [x] T007 Create the test support: `global-setup.ts`, `test-env.ts`, `test-app.ts` (fixed clock), `fixed-clock.ts`, `auth-helpers.ts`, `factories.ts`, `library-world.ts`.

## Phase 3: US1 – Sign in with a role

- [x] T008 [US1] Auth module (login, me, global JWT guard, roles guard, decorators) and users service.
- [x] T009 [US1] Tests T-AUTH-01..05 in `test/auth.e2e-spec.ts`.

## Phase 4: US9 – Settings (needed by the rules)

- [x] T010 [US9] Settings module with the six lending settings; GET for any role, PATCH for librarian.

## Phase 5: US2 – Catalogue

- [x] T011 [US2] Pure rules in `lending/utils/lending-rules.util.ts` with unit tests in `lending-rules.util.spec.ts`.
- [x] T012 [US2] `lending/copy-queue.ts`: lockBook, copiesInUse, offerFreeCopies, processExpiredHolds, unpaidBalance.
- [x] T013 [US2] Books module: create, edit (copy count refused with `COPIES_IN_USE`), list and search with availability.
- [x] T014 [US2] Tests T-CAT-01..04 in `test/catalogue.e2e-spec.ts`.

## Phase 6: US3–US7 – Lending 🎯 MVP

- [x] T015 [US3] `LoansService.checkout`, `return`, `listOpen` and the loans controller.
- [x] T016 [US5] `ReservationsService.reserve`, `cancel` and the reservations controller.
- [x] T017 [US6] `HoldExpiryService` running on `HOLD_SWEEP_INTERVAL_SECONDS`.
- [x] T018 [US3] Tests T-LOAN-01..04 in `test/loans.e2e-spec.ts`.
- [x] T019 [US4] Tests T-FINE-01..05 in `test/fines.e2e-spec.ts`.
- [x] T020 [US5] Tests T-RES-01..05 in `test/reservations.e2e-spec.ts`.
- [x] T021 [US6] Tests T-EXP-01..04 in `test/expiry.e2e-spec.ts`.
- [x] T022 [US7] Tests T-RACE-01..05 in `test/concurrency.e2e-spec.ts`.

## Phase 7: US8 – Member account page

- [x] T023 [US8] `AccountsService`: account page, member list, payments; members controller.
- [x] T024 [US8] Tests T-ACC-01..02 in `test/accounts.e2e-spec.ts`.

## Phase 8: US9 – Configuration changes behaviour

- [x] T025 [US9] Tests T-CFG-01..07 in `test/config.e2e-spec.ts`.

## Phase 9: US10 – Demo seed

- [x] T026 [US10] `seed-data.ts`, `seed.ts`, `run-seed.ts`.
- [x] T027 [US10] Tests T-SEED-01..03 in `test/seed.e2e-spec.ts`.

## Phase 10: Frontend

- [x] T028 Shell: theme, API client, auth context, login, layout with role-based navigation.
- [x] T029 [P] Catalogue page with Borrow and Reserve (member) and the book form dialog (librarian).
- [x] T030 [P] My account page and the shared account view.
- [x] T031 [P] Loans page with Return; Members list, member page with Record payment; Settings page.

## Phase 11: Polish

- [x] T032 README: setup, architecture, data model, where the last copy is protected, demo accounts, tests.
- [x] T033 Run every test, build both apps, and check both roles in the browser.

## Phase 12: Paging (FR-13)

- [x] T034 Keyset-paged `GET /books` with server-side filters; migration `AddBookListIndexes` (sort index, trigram search indexes).
- [x] T035 Paged account lists (`/members/:id/loans`, `/reservations`, `/payments`), loans desk and member list, with totals.
- [x] T036 Tests T-CAT-05..06, T-ACC-03..04, T-LOAN-05.
- [x] T037 Catalogue loads pages as the user scrolls; account, loans and member tables get page controls; overdue dates in red.

## Dependencies

Phase 1 → Phase 2 → US1 → US9 settings → US2 → US3–7 → US8 → US9 tests → US10 → frontend → polish.
Inside a phase, `[P]` tasks touch different files and can be done in any order.
