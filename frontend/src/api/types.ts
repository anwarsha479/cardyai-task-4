export type Role = 'member' | 'librarian';

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: UserView;
}

export interface Availability {
  onLoan: number;
  onHold: number;
  available: number;
  queueLength: number;
}

export type ReservationStatus = 'waiting' | 'ready' | 'fulfilled' | 'expired' | 'cancelled';

export interface BookView {
  id: string;
  title: string;
  author: string;
  totalCopies: number;
  availability: Availability;
  myLoan: { id: string; copyNumber: number; dueAt: string } | null;
  myReservation: { id: string; status: ReservationStatus; position: number | null; holdExpiresAt: string | null } | null;
}

export interface BookInput {
  title: string;
  author: string;
  totalCopies: number;
}

export interface BookRef {
  id: string;
  title: string;
  author: string;
}

export interface PersonRef {
  id: string;
  name: string;
  email: string;
}

export interface LoanView {
  id: string;
  book: BookRef;
  copyNumber: number;
  member: PersonRef;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string | null;
  overdue: boolean;
  daysLate: number;
  fineCents: number;
  accruingFineCents: number;
}

export interface ReturnResult {
  loan: LoanView;
  heldFor: { reservationId: string; member: PersonRef; holdExpiresAt: string } | null;
}

export interface ReservationView {
  id: string;
  book: BookRef;
  member: PersonRef;
  status: ReservationStatus;
  position: number | null;
  heldCopyNumber: number | null;
  readyAt: string | null;
  holdExpiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface Account {
  member: PersonRef;
  limits: {
    maxActiveLoans: number;
    loanPeriodDays: number;
    finePerDayCents: number;
    maxFinePerLoanCents: number;
    fineBlockThresholdCents: number;
    reservationHoldHours: number;
  };
  balanceCents: number;
  totalFinesCents: number;
  totalPaidCents: number;
  blocked: boolean;
  accruingFineCents: number;
  counts: { openLoans: number; overdueLoans: number; reservations: number; returnedLoans: number; finedLoans: number; payments: number };
  readyReservations: ReservationView[];
}

export interface PaymentView {
  id: string;
  amountCents: number;
  note: string | null;
  recordedBy: string;
  createdAt: string;
}

/** A page of a list shown with page numbers (`page` is 1-based). */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** A page of the catalogue; pass `nextCursor` back to get the next one. */
export interface BookPage {
  items: BookView[];
  nextCursor: string | null;
  total: number;
}

export interface OpenLoanPage extends Page<LoanView> {
  summary: { open: number; overdue: number; oldestDaysLate: number; accruingFineCents: number };
}

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  openLoans: number;
  overdueLoans: number;
  activeReservations: number;
  balanceCents: number;
  blocked: boolean;
}

export interface MemberPage extends Page<MemberSummary> {
  summary: { members: number; booksOnLoan: number; unpaidCents: number; owing: number; blocked: number };
}

export type SettingKey =
  | 'loanPeriodDays'
  | 'finePerDayCents'
  | 'maxFinePerLoanCents'
  | 'maxActiveLoans'
  | 'reservationHoldHours'
  | 'fineBlockThresholdCents';

export interface SettingView {
  key: SettingKey;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}

export interface ApiErrorBody {
  code: string;
  reason?: string;
  message: string;
  details?: { fields?: Record<string, string[]> } & Record<string, unknown>;
}
