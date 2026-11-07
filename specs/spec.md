# Feature Specification: Library Lending with Reservation Queue and Fines

**Created**: 2026-11-05
**Status**: Approved for build
**Input**: `4-Project-Library-Lending.pdf` (LL) and the common guidelines (CG), as followed by tasks 1–3

This is the single spec for task 4. The technical design is in [plan.md](plan.md) and the build
steps are in [tasks.md](tasks.md). Test IDs (`T-XXX-nn`) appear at the start of the name of the
automated test that proves them.

## Source Requirements

| ID | Requirement (paraphrased from the PDF) |
|----|-----------------------------------------|
| LL-01 | Two roles, member and librarian, enforced on the server. Librarians manage the catalogue, process returns, record fine payments and manage configuration. |
| LL-02 | Catalogue: books with title, author and number of copies. Titles must be present and copy counts must not be negative. |
| LL-03 | Checkout with a due date from the configured loan period. A member cannot exceed the maximum number of active loans. |
| LL-04 | Return calculates an overdue fine per day late, up to a cap. |
| LL-05 | A member whose unpaid fines exceed a threshold cannot check out books, enforced in code. |
| LL-06 | Reservation queue: with no copy available a member joins a first-come queue. A returned copy is held for the first member for a limited window; if the hold expires it passes to the next member. |
| LL-07 | Member page with active loans, due dates, fines and reservations. |
| LL-08 | Admin-configurable values used in the business logic: at least loan period (days), fine per day, maximum active loans and reservation hold window. |
| LL-09 | Seed data: 40 books with varying copy counts, 10 members and 25 loans, some overdue. |
| LL-DM-1 | Done means: fine calculation and reservation expiry are tested with a fixed clock. |
| LL-DM-2 | Done means: queue order is correct. |
| LL-DM-3 | Done means: two members cannot both get the last copy. |
| LL-DM-4 | Done means: roles are enforced on the server. |
| LL-DM-5 | Done means: changing a configured value changes behaviour without a code change. |
| CG-1 | Full TypeScript stack; NestJS and PostgreSQL preferred. |
| CG-2 | Runnable from the README on a clean machine. |
| CG-3 | README covers setup, architecture, data model and how to run the tests. |
| CG-4 | At least ten automated tests. |

## User Scenarios & Testing

### User Story 1 – Sign in with a role (Priority: P1)

Everyone signs in with email and password. The server takes the role from the token and checks it
on every request, whatever the UI shows.

**Acceptance Scenarios**:

1. **Given** a seeded account, **When** the user signs in with the right password, **Then** they get a token, their name and role; a wrong password or unknown email gets 401 with the same message. (T-AUTH-01)
2. **Given** no token or an invalid token, **When** any endpoint other than login is called, **Then** the answer is 401. (T-AUTH-02)
3. **Given** a member, **When** they add or edit a book, process a return, record a payment, list all loans or members, or change settings, **Then** the answer is 403. (T-AUTH-03)
4. **Given** a librarian, **When** they check out or reserve a book, **Then** the answer is 403. (T-AUTH-04)
5. **Given** another member, **When** a member reads their account or cancels their reservation, **Then** the answer is 403. (T-AUTH-05)

### User Story 2 – Catalogue (Priority: P1)

A librarian adds books with a title, an author and a number of copies, and can change any of them.
Copies are numbered 1 to N. Lowering the count is refused when it would remove a copy that is on
loan or held for a reservation. Raising it gives the new copies to the reservation queue first.

**Acceptance Scenarios**:

1. **Given** a title, author and 3 copies, **When** the librarian adds the book, **Then** it is saved and listed with 3 copies available. (T-CAT-01)
2. **Given** a blank title or author, a negative, fractional or too large copy count, **When** the book is saved, **Then** it is refused with a validation error on that field; 0 copies is accepted. (T-CAT-02)
3. **Given** copy 3 on loan, **When** the librarian lowers the count to 2, **Then** it is refused with `COPIES_IN_USE` naming copy 3; lowering over free copies is accepted. (T-CAT-03)
4. **Given** books, **When** anyone searches the catalogue by title or author, **Then** matching books show total, on loan, on hold, available and queue length, and a member sees their own loan or reservation on each. (T-CAT-04)
5. **Given** a large catalogue, **When** anyone browses it, **Then** it arrives one page at a time in title order, with no book repeated or skipped, and the Available and My books filters are applied on the server. (T-CAT-05, T-CAT-06)

### User Story 3 – Checkout (Priority: P1) 🎯 MVP

A member borrows a book themselves. They get the lowest-numbered free copy and a due date
`loanPeriodDays` after the checkout instant.

**Acceptance Scenarios**:

1. **Given** a book with free copies, **When** a member checks it out, **Then** the loan is saved with copy 1 and `dueAt` = now + loan period; the next member gets copy 2. (T-LOAN-01)
2. **Given** a member with `maxActiveLoans` open loans, **When** they check out another book, **Then** it is refused with `LOAN_LIMIT_REACHED`; after a return they can borrow again. (T-LOAN-02)
3. **Given** a book with no free copy, **When** a member checks it out, **Then** it is refused with `NO_COPY_AVAILABLE`; a member who already has a copy of the book gets `ALREADY_BORROWED`. (T-LOAN-03)
4. **Given** unpaid fines above `fineBlockThresholdCents`, **When** the member checks out, **Then** it is refused with `BORROWING_BLOCKED`; at exactly the threshold, or after a payment brings the balance down to it, checkout works. (T-LOAN-04)
5. **Given** many open loans, **When** a librarian opens the loans desk, **Then** they come one page at a time, soonest due first, searchable by book or member, with totals across all loans. (T-LOAN-05)

### User Story 4 – Returns and fines (Priority: P1)

A librarian processes a return. A loan returned at or before its due instant has no fine. Otherwise
every started day after the due instant counts as one day late, and the fine is
`daysLate × finePerDayCents`, capped at `maxFinePerLoanCents`. The fine is stored on the loan at
return. A librarian records payments; a member's unpaid balance is their fines minus their payments.

**Acceptance Scenarios**:

1. **Given** a loan due at 12:00, **When** it is returned at exactly 12:00, **Then** the fine is 0. (T-FINE-01)
2. **Given** that loan, **When** it is returned 1 ms late, 3 days late, or 3 days and 1 ms late, **Then** it is 1, 3 or 4 days late and the fine is that many times the daily fine. (T-FINE-02)
3. **Given** a loan returned far beyond the cap, **When** the fine is calculated, **Then** it is the cap. (T-FINE-03)
4. **Given** a balance, **When** the librarian records a payment, **Then** the balance goes down; a payment above the balance is refused with `PAYMENT_EXCEEDS_BALANCE`, and zero, negative or fractional amounts are validation errors. (T-FINE-04)
5. **Given** a returned loan, **When** it is returned again, **Then** it is refused with `INVALID_STATE`. (T-FINE-05)

### User Story 5 – Reservation queue (Priority: P1)

A member reserves a book when no copy is free. Reservations are served strictly in the order they
were made. When a copy becomes free (return, cancelled or expired hold, new copy) it is held for the
first waiting member for `reservationHoldHours`. Only that member can check out the held copy.

**Acceptance Scenarios**:

1. **Given** a free copy, **When** a member reserves the book, **Then** it is refused with `COPIES_AVAILABLE`; a second reservation by the same member gets `ALREADY_RESERVED`, and a member who has the book on loan gets `ALREADY_BORROWED`. (T-RES-01)
2. **Given** members A, B and C reserving in that order, **When** copies are returned one at a time, **Then** A, then B, then C get the hold, and their queue positions read 1, 2, 3 before the first return. (T-RES-02)
3. **Given** a copy held for A, **When** B checks out the book, **Then** B gets `NO_COPY_AVAILABLE`; A checks it out and the reservation is `fulfilled`. (T-RES-03)
4. **Given** a queue, **When** a waiting member cancels, **Then** the order of the rest is kept; when the member holding a copy cancels, the copy goes to the next member. (T-RES-04)
5. **Given** a queue, **When** the librarian adds copies, **Then** the new copies go to the queue in order. (T-RES-05)

### User Story 6 – Holds expire on time (Priority: P1)

A hold expires at exactly `holdExpiresAt`. The copy then passes to the next waiting member, whose
hold starts at that same instant, or becomes free if nobody is waiting. Every checkout,
reservation, return and catalogue change on a book first processes its expired holds, and a
background job processes all books, so the result never depends on when the job runs.

**Acceptance Scenarios**:

1. **Given** a hold made at 12:00 with a 48-hour window, **When** the expiry job runs at 47:59:59.999 later, **Then** nothing changes; at exactly 48 hours the hold is `expired` and the next member's hold starts then and ends 48 hours later. (T-EXP-01)
2. **Given** that hold at its expiry instant and no job run, **When** the first member checks out, **Then** they get `NO_COPY_AVAILABLE`; the next member checks it out successfully. (T-EXP-02)
3. **Given** the last member in the queue, **When** their hold expires, **Then** the copy is free for anyone. (T-EXP-03)
4. **Given** a job that runs days late, **When** it runs, **Then** each hold in the chain is processed at its own expiry instant. (T-EXP-04)

### User Story 7 – No double lending (Priority: P1)

Two members can never get the same copy, even when they click at the same moment.

**Acceptance Scenarios**:

1. **Given** one copy left and two members, **When** both check it out at the same moment, **Then** exactly one succeeds and the other gets `NO_COPY_AVAILABLE`, 25 times in a row. (T-RACE-01)
2. **Given** ten members and one copy, **When** they all check it out at once, **Then** exactly one succeeds. (T-RACE-02)
3. **Given** an open loan of a copy, **When** a second open loan of the same copy is written straight to the database, **Then** the database refuses it. (T-RACE-03)
4. **Given** a waiting member, **When** a return and another member's checkout of that book happen at once, **Then** the returned copy is held for the waiting member and the other checkout is refused. (T-RACE-04)
5. **Given** several members reserving at once and one member double-clicking, **When** all finish, **Then** each member has one reservation with a distinct queue position. (T-RACE-05)

### User Story 8 – Member account page (Priority: P1)

Each member sees their open loans with due dates and overdue days, an estimate of the fine building
up on overdue loans, their returned loans with fines, their payments, their unpaid balance and
whether they are blocked, and their active reservations with queue position or hold expiry. A
librarian sees the same page for any member and the list of all members.

**Acceptance Scenarios**:

1. **Given** a member with loans, fines, payments and reservations, **When** the account is read, **Then** every part above is shown with the right numbers. (T-ACC-01)
2. **Given** members, **When** a librarian lists them, **Then** each shows open loans, overdue loans, balance and blocked state. (T-ACC-02)
3. **Given** a long history, **When** an account list is read, **Then** it is paged with a total, and page sizes over 100 are refused. (T-ACC-03)
4. **Given** many members, **When** a librarian lists or searches them, **Then** they come one page at a time by name, with totals across all members. (T-ACC-04)

### User Story 9 – Configuration (Priority: P1)

A librarian sets the values below. The rules read them each time they run, so a change applies to
the next checkout, return or hold with no restart. Loans and holds already made keep their dates.

| Setting | Default | Range |
|---------|---------|-------|
| `loanPeriodDays` | 14 | 1–90 |
| `finePerDayCents` | 25 | 0–10000 |
| `maxFinePerLoanCents` | 1000 | 0–100000 |
| `maxActiveLoans` | 5 | 1–20 |
| `reservationHoldHours` | 48 | 1–336 |
| `fineBlockThresholdCents` | 1000 | 0–100000 |

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** settings are read, **Then** the defaults apply; a change is saved with who made it and when. (T-CFG-01)
2. **Given** an out-of-range, non-integer or unknown setting, **When** it is saved, **Then** it is refused and nothing changes. (T-CFG-02)
3. **Given** `loanPeriodDays` changed to 7, **When** a member checks out, **Then** the loan is due in 7 days. (T-CFG-03)
4. **Given** `finePerDayCents` and `maxFinePerLoanCents` changed, **When** a late loan is returned, **Then** the new rate and cap apply. (T-CFG-04)
5. **Given** `maxActiveLoans` changed, **When** a member checks out, **Then** the new limit applies. (T-CFG-05)
6. **Given** `reservationHoldHours` changed to 2, **When** a copy is held, **Then** the hold ends 2 hours later. (T-CFG-06)
7. **Given** `fineBlockThresholdCents` lowered, **When** a member with fines below the old threshold checks out, **Then** they are blocked. (T-CFG-07)

### User Story 10 – Demo seed (Priority: P2)

`npm run seed` loads 1 librarian, 10 members, 40 books with 1–5 copies, 25 loans (open, overdue and
returned with fines), some payments and a few reservation queues. Running it again does nothing.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** the seed runs, **Then** the counts match and some open loans are overdue. (T-SEED-01)
2. **Given** the seeded data, **When** the rules are checked, **Then** no copy is lent twice, no member is over the loan limit, and every fine matches the fine rule. (T-SEED-02)
3. **Given** a seeded database, **When** the seed runs again, **Then** nothing is added. (T-SEED-03)

### Edge Cases

- Money is stored in whole cents. The UI shows it in the currency set by `VITE_CURRENCY`.
- A loan returned at exactly its due instant is on time; any part of a day after it counts as a day.
- A hold at the exact `holdExpiresAt` instant is already expired.
- A book with 0 copies can be reserved; its queue is served when copies are added.
- A member who is blocked cannot reserve either, so the queue is not held up by members who cannot borrow.
- Lowering a setting does not change loans, fines or holds already made.

## Requirements

### Functional Requirements

- **FR-01** Roles are `member` and `librarian`. Every endpoint except login needs a valid token, and the role comes from the token. (LL-01)
- **FR-02** Only librarians change the catalogue, process returns, record payments, list loans and members, and change settings. Only members check out, reserve and cancel their own reservations. (LL-01)
- **FR-03** Book: title 1–200 characters, author 1–200, copies an integer 0–100. (LL-02)
- **FR-04** Checkout refuses, in order: already borrowed, blocked by fines, at the loan limit, no free copy. Due date is now + `loanPeriodDays`. (LL-03, LL-05)
- **FR-05** Fine = min(daysLate × `finePerDayCents`, `maxFinePerLoanCents`), with daysLate the number of started days after the due instant. (LL-04)
- **FR-06** Blocked when unpaid balance > `fineBlockThresholdCents`. (LL-05)
- **FR-07** Reservations are served in creation order; a free copy is held for the first waiting member for `reservationHoldHours`; an expired hold passes on at its expiry instant. (LL-06)
- **FR-08** A partial unique index allows one open loan per copy, so the last copy cannot be lent twice. (LL-DM-3)
- **FR-09** Member account page as in User Story 8. (LL-07)
- **FR-10** The six settings above are read by the rules each time they run. (LL-08, LL-DM-5)
- **FR-11** Errors use `{ error: { code, reason?, message, details? } }`. Rule failures are 409 `RULE_VIOLATION` with a `reason`.
- **FR-12** Seed data as in User Story 10. (LL-09)
- **FR-13** Every list that can grow is paged on the server: the catalogue by cursor, account lists, the loans desk and the member list by page number.

### Key Entities

- **User**: name, email, password hash, role.
- **Book**: title, author, total copies.
- **Loan**: book, copy number, member, checkout time, due time, return time, days late, fine.
- **Reservation**: book, member, queue order, status (`waiting`, `ready`, `fulfilled`, `expired`, `cancelled`), held copy, hold start and end.
- **FinePayment**: member, amount, note, recorded by and when.
- **Setting**: key, value, last changed by and when.

## Success Criteria

- **SC-01** Every test ID above is covered by a passing automated test (at least ten, CG-4). Unit tests `T-UNIT-*` cover the pure lending rules.
- **SC-02** Each "Done means" item has its own tests: fixed-clock fines and expiry (T-FINE-*, T-EXP-*), queue order (T-RES-02, T-RES-04, T-EXP-04), last copy (T-RACE-*), roles (T-AUTH-*), configuration (T-CFG-03..07).
- **SC-03** A clean machine with Node.js 22 and a local PostgreSQL server runs the app from the README.

## Assumptions

- **A-01** Members check out books themselves (self-service). The brief gives librarians returns, payments, catalogue and configuration, but not checkout.
- **A-02** The fine cap and the blocking threshold are settings too, because the business logic uses them.
- **A-03** Only fines already charged at return count towards the balance and the block. The fine still building up on an overdue loan is shown as an estimate.
- **A-04** A member may have at most one copy of a book and one active reservation per book.
- **A-05** Payments reduce the member's overall balance; they are not tied to one loan. A payment cannot exceed the balance.
- **A-06** No sign-up, password reset or user management screens. Accounts come from the seed.
- **A-07** Notifications (email when a hold is ready) are out of scope; the member sees the hold on their account page.
- **A-08** AI features are optional extras and are not part of this build.
