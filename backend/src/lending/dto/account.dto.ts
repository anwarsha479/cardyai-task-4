import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PageQueryDto } from '../../common/dto/pagination.dto';
import { LoanViewDto, PersonRefDto, ReservationViewDto } from './lending-views.dto';

export class AccountLimitsDto {
  @ApiProperty() maxActiveLoans: number;
  @ApiProperty() loanPeriodDays: number;
  @ApiProperty() finePerDayCents: number;
  @ApiProperty() maxFinePerLoanCents: number;
  @ApiProperty() fineBlockThresholdCents: number;
  @ApiProperty() reservationHoldHours: number;
}

export class AccountCountsDto {
  @ApiProperty() openLoans: number;
  @ApiProperty() overdueLoans: number;
  @ApiProperty({ description: 'Waiting and ready reservations' }) reservations: number;
  @ApiProperty() returnedLoans: number;
  @ApiProperty({ description: 'Returned loans that were charged a fine' }) finedLoans: number;
  @ApiProperty() payments: number;
}

/** Totals and counts only; the lists themselves are paged by the /members/:id/loans, /reservations and /payments routes. */
export class AccountDto {
  @ApiProperty({ type: PersonRefDto }) member: PersonRefDto;
  @ApiProperty({ type: AccountLimitsDto }) limits: AccountLimitsDto;
  @ApiProperty({ description: 'Fines charged minus payments' }) balanceCents: number;
  @ApiProperty() totalFinesCents: number;
  @ApiProperty() totalPaidCents: number;
  @ApiProperty({ description: 'Balance is over the threshold, so checkout is refused' }) blocked: boolean;
  @ApiProperty({ description: 'What the overdue loans would cost if returned now' }) accruingFineCents: number;
  @ApiProperty({ type: AccountCountsDto }) counts: AccountCountsDto;
  @ApiProperty({ type: ReservationViewDto, isArray: true, description: 'Copies held for the member right now' })
  readyReservations: ReservationViewDto[];
}

export const LOAN_STATES = ['open', 'returned', 'fined'] as const;
export type LoanState = (typeof LOAN_STATES)[number];

export class MemberLoansQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: LOAN_STATES, default: 'open', description: 'open: soonest due first; returned and fined: latest return first' })
  @IsOptional()
  @IsIn(LOAN_STATES)
  state: LoanState = 'open';
}

export class PaymentViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() amountCents: number;
  @ApiPropertyOptional({ nullable: true }) note: string | null;
  @ApiProperty({ description: 'Librarian who recorded it' }) recordedBy: string;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
}

class PageFieldsDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
}

export class LoanPageDto extends PageFieldsDto {
  @ApiProperty({ type: LoanViewDto, isArray: true }) items: LoanViewDto[];
}

export class ReservationPageDto extends PageFieldsDto {
  @ApiProperty({ type: ReservationViewDto, isArray: true }) items: ReservationViewDto[];
}

export class PaymentPageDto extends PageFieldsDto {
  @ApiProperty({ type: PaymentViewDto, isArray: true }) items: PaymentViewDto[];
}

export class MemberSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() openLoans: number;
  @ApiProperty() overdueLoans: number;
  @ApiProperty() activeReservations: number;
  @ApiProperty() balanceCents: number;
  @ApiProperty() blocked: boolean;
}

export class ListMembersQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Matches name or email, case-insensitive' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  search?: string;
}

/** Totals across every member, whatever the search or page. */
export class MemberDeskSummaryDto {
  @ApiProperty() members: number;
  @ApiProperty() booksOnLoan: number;
  @ApiProperty() unpaidCents: number;
  @ApiProperty({ description: 'Members with an unpaid balance' }) owing: number;
  @ApiProperty() blocked: number;
}

export class MemberPageDto extends PageFieldsDto {
  @ApiProperty({ type: MemberSummaryDto, isArray: true }) items: MemberSummaryDto[];
  @ApiProperty({ type: MemberDeskSummaryDto }) summary: MemberDeskSummaryDto;
}
