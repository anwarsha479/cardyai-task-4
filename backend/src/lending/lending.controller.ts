import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { AccountsService } from './accounts.service';
import { PageQueryDto } from '../common/dto/pagination.dto';
import {
  AccountDto,
  ListMembersQueryDto,
  LoanPageDto,
  MemberLoansQueryDto,
  MemberPageDto,
  PaymentPageDto,
  ReservationPageDto,
} from './dto/account.dto';
import { LoanViewDto, ReservationViewDto } from './dto/lending-views.dto';
import { ListLoansQueryDto, OpenLoanPageDto, RecordPaymentDto, ReturnResultDto } from './dto/loan.dto';
import { LoansService } from './loans.service';
import { ReservationsService } from './reservations.service';

@ApiTags('lending')
@ApiBearerAuth()
@Controller()
export class LendingController {
  constructor(
    private readonly loans: LoansService,
    private readonly reservations: ReservationsService,
    private readonly accounts: AccountsService,
  ) {}

  @Post('books/:id/checkout')
  @Roles(Role.Member)
  @ApiCreatedResponse({ type: LoanViewDto, description: 'Copy lent, due after the loan period' })
  @ApiConflictResponse({ description: 'ALREADY_BORROWED, BORROWING_BLOCKED, LOAN_LIMIT_REACHED, NO_COPY_AVAILABLE' })
  @ApiForbiddenResponse({ description: 'Member role required' })
  checkout(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) bookId: string): Promise<LoanViewDto> {
    return this.loans.checkout(user, bookId);
  }

  @Post('books/:id/reservations')
  @Roles(Role.Member)
  @ApiCreatedResponse({ type: ReservationViewDto, description: 'Joined the end of the queue' })
  @ApiConflictResponse({ description: 'COPIES_AVAILABLE, ALREADY_RESERVED, ALREADY_BORROWED, BORROWING_BLOCKED' })
  @ApiForbiddenResponse({ description: 'Member role required' })
  reserve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) bookId: string): Promise<ReservationViewDto> {
    return this.reservations.reserve(user, bookId);
  }

  @Post('reservations/:id/cancel')
  @Roles(Role.Member)
  @HttpCode(200)
  @ApiOkResponse({ type: ReservationViewDto })
  @ApiConflictResponse({ description: 'INVALID_STATE' })
  @ApiForbiddenResponse({ description: 'Member role required, or the reservation belongs to someone else' })
  cancelReservation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ReservationViewDto> {
    return this.reservations.cancel(user, id);
  }

  @Get('loans')
  @Roles(Role.Librarian)
  @ApiOkResponse({ type: OpenLoanPageDto, description: 'One page of open loans, soonest due first, with desk totals' })
  @ApiForbiddenResponse({ description: 'Librarian role required' })
  listLoans(@Query() query: ListLoansQueryDto): Promise<OpenLoanPageDto> {
    return this.loans.listOpen(query);
  }

  @Post('loans/:id/return')
  @Roles(Role.Librarian)
  @HttpCode(200)
  @ApiOkResponse({ type: ReturnResultDto, description: 'Returned with the fine charged, and who the copy is now held for' })
  @ApiConflictResponse({ description: 'INVALID_STATE (already returned)' })
  @ApiForbiddenResponse({ description: 'Librarian role required' })
  returnLoan(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ReturnResultDto> {
    return this.loans.returnLoan(user, id);
  }

  @Get('members')
  @Roles(Role.Librarian)
  @ApiOkResponse({ type: MemberPageDto, description: 'One page of members by name, with totals across all members' })
  @ApiForbiddenResponse({ description: 'Librarian role required' })
  listMembers(@Query() query: ListMembersQueryDto): Promise<MemberPageDto> {
    return this.accounts.listMembers(query);
  }

  @Get('members/:id/loans')
  @ApiOkResponse({ type: LoanPageDto, description: 'One page of the member’s open, returned or fined loans' })
  @ApiForbiddenResponse({ description: "A member reading someone else's loans" })
  memberLoans(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MemberLoansQueryDto,
  ): Promise<LoanPageDto> {
    return this.accounts.loans(user, id, query);
  }

  @Get('members/:id/reservations')
  @ApiOkResponse({ type: ReservationPageDto, description: 'One page of the member’s waiting and ready reservations' })
  @ApiForbiddenResponse({ description: "A member reading someone else's reservations" })
  memberReservations(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQueryDto,
  ): Promise<ReservationPageDto> {
    return this.accounts.reservations(user, id, query);
  }

  @Get('members/:id/payments')
  @ApiOkResponse({ type: PaymentPageDto, description: 'One page of the member’s fine payments, latest first' })
  @ApiForbiddenResponse({ description: "A member reading someone else's payments" })
  memberPayments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageQueryDto,
  ): Promise<PaymentPageDto> {
    return this.accounts.payments(user, id, query);
  }

  @Get('members/:id/account')
  @ApiOkResponse({ type: AccountDto, description: 'Totals, counts and ready holds; the lists are paged by the routes above' })
  @ApiForbiddenResponse({ description: "A member reading someone else's account" })
  @ApiNotFoundResponse({ description: 'Member not found' })
  account(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AccountDto> {
    return this.accounts.account(user, id);
  }

  @Post('members/:id/payments')
  @Roles(Role.Librarian)
  @ApiCreatedResponse({ type: AccountDto, description: 'Payment recorded; the updated account' })
  @ApiConflictResponse({ description: 'PAYMENT_EXCEEDS_BALANCE' })
  @ApiForbiddenResponse({ description: 'Librarian role required' })
  recordPayment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<AccountDto> {
    return this.accounts.recordPayment(user, id, dto);
  }
}
