import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Trim, TrimToNull } from '../../common/decorators/trim.decorator';
import { PageQueryDto } from '../../common/dto/pagination.dto';
import { LoanViewDto, PersonRefDto } from './lending-views.dto';

export class ListLoansQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Only loans past their due instant' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ description: 'Matches book title or member name, case-insensitive' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  search?: string;
}

/** Desk totals across every open loan, whatever the filter or page. */
export class LoanDeskSummaryDto {
  @ApiProperty() open: number;
  @ApiProperty() overdue: number;
  @ApiProperty({ description: 'Days late of the oldest overdue loan' }) oldestDaysLate: number;
  @ApiProperty({ description: 'Fines if every overdue book came back now' }) accruingFineCents: number;
}

export class OpenLoanPageDto {
  @ApiProperty({ type: LoanViewDto, isArray: true }) items: LoanViewDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({ type: LoanDeskSummaryDto }) summary: LoanDeskSummaryDto;
}

export class HeldForDto {
  @ApiProperty({ format: 'uuid' }) reservationId: string;
  @ApiProperty({ type: PersonRefDto }) member: PersonRefDto;
  @ApiProperty({ format: 'date-time' }) holdExpiresAt: Date;
}

export class ReturnResultDto {
  @ApiProperty({ type: LoanViewDto }) loan: LoanViewDto;
  @ApiPropertyOptional({ type: HeldForDto, nullable: true, description: 'Who the returned copy is now held for' })
  heldFor: HeldForDto | null;
}

export class RecordPaymentDto {
  @ApiProperty({ minimum: 1, example: 250, description: 'Amount in cents' })
  @IsInt({ message: 'amountCents must be a whole number of cents' })
  @Min(1, { message: 'amountCents must be at least 1' })
  @Max(10_000_000)
  amountCents: number;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}
