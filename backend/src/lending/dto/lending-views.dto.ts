import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Limits } from '../../settings/settings.constants';
import { Loan } from '../entities/loan.entity';
import { Reservation } from '../entities/reservation.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';
import { computeFine, daysLate, isHoldExpired } from '../utils/lending-rules.util';

export class BookRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
  @ApiProperty() author: string;
}

export class PersonRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

export class LoanViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: BookRefDto }) book: BookRefDto;
  @ApiProperty() copyNumber: number;
  @ApiProperty({ type: PersonRefDto }) member: PersonRefDto;
  @ApiProperty({ format: 'date-time' }) checkedOutAt: Date;
  @ApiProperty({ format: 'date-time' }) dueAt: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) returnedAt: Date | null;
  @ApiProperty({ description: 'Open and past its due instant' }) overdue: boolean;
  @ApiProperty({ description: 'Days late at return, or so far for an open loan' }) daysLate: number;
  @ApiProperty({ description: 'Fine charged at return (0 while open)' }) fineCents: number;
  @ApiProperty({ description: 'For an open loan, the fine if it were returned now' }) accruingFineCents: number;
}

export class ReservationViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: BookRefDto }) book: BookRefDto;
  @ApiProperty({ type: PersonRefDto }) member: PersonRefDto;
  @ApiProperty({ enum: ReservationStatus, description: 'A ready hold whose time is up reads as expired' }) status: ReservationStatus;
  @ApiPropertyOptional({ nullable: true, description: '1 = next in line; only while waiting' }) position: number | null;
  @ApiPropertyOptional({ nullable: true }) heldCopyNumber: number | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) readyAt: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) holdExpiresAt: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) closedAt: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
}

export function toLoanView(loan: Loan, now: Date, limits: Limits): LoanViewDto {
  const open = loan.returnedAt === null;
  const lateDays = open ? daysLate(loan.dueAt, now) : (loan.daysLate ?? 0);
  return {
    id: loan.id,
    book: { id: loan.book!.id, title: loan.book!.title, author: loan.book!.author },
    copyNumber: loan.copyNumber,
    member: { id: loan.member!.id, name: loan.member!.name, email: loan.member!.email },
    checkedOutAt: loan.checkedOutAt,
    dueAt: loan.dueAt,
    returnedAt: loan.returnedAt,
    overdue: open && lateDays > 0,
    daysLate: lateDays,
    fineCents: loan.fineCents,
    accruingFineCents: open ? computeFine(lateDays, limits.finePerDayCents, limits.maxFinePerLoanCents) : 0,
  };
}

export function toReservationView(reservation: Reservation, now: Date, position: number | null): ReservationViewDto {
  const expired =
    reservation.status === ReservationStatus.Ready && isHoldExpired(reservation.holdExpiresAt!, now);
  return {
    id: reservation.id,
    book: { id: reservation.book!.id, title: reservation.book!.title, author: reservation.book!.author },
    member: { id: reservation.member!.id, name: reservation.member!.name, email: reservation.member!.email },
    status: expired ? ReservationStatus.Expired : reservation.status,
    position: reservation.status === ReservationStatus.Waiting ? position : null,
    heldCopyNumber: reservation.heldCopyNumber,
    readyAt: reservation.readyAt,
    holdExpiresAt: reservation.holdExpiresAt,
    closedAt: expired ? reservation.holdExpiresAt : reservation.closedAt,
    createdAt: reservation.createdAt,
  };
}
