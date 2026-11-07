import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '../../lending/enums/reservation-status.enum';

export class AvailabilityDto {
  @ApiProperty() onLoan: number;
  @ApiProperty({ description: 'Copies held for a member at the front of the queue' }) onHold: number;
  @ApiProperty() available: number;
  @ApiProperty({ description: 'Members waiting' }) queueLength: number;
}

export class MyLoanDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() copyNumber: number;
  @ApiProperty({ format: 'date-time' }) dueAt: Date;
}

export class MyReservationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ReservationStatus }) status: ReservationStatus;
  @ApiPropertyOptional({ nullable: true }) position: number | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) holdExpiresAt: Date | null;
}

export class BookViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
  @ApiProperty() author: string;
  @ApiProperty() totalCopies: number;
  @ApiProperty({ type: AvailabilityDto }) availability: AvailabilityDto;
  @ApiPropertyOptional({ type: MyLoanDto, nullable: true, description: 'Members only' }) myLoan: MyLoanDto | null;
  @ApiPropertyOptional({ type: MyReservationDto, nullable: true, description: 'Members only' }) myReservation: MyReservationDto | null;
}

export class BookPageDto {
  @ApiProperty({ type: BookViewDto, isArray: true }) items: BookViewDto[];
  @ApiPropertyOptional({ nullable: true, description: 'Pass as `cursor` to get the next page; null on the last page' })
  nextCursor: string | null;
  @ApiProperty({ description: 'Books matching the search and filter, across all pages' }) total: number;
}
