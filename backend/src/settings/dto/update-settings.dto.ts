import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { SETTING_DEFINITIONS as D } from '../settings.constants';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ minimum: D.loanPeriodDays.min, maximum: D.loanPeriodDays.max })
  @IsOptional()
  @IsInt()
  @Min(D.loanPeriodDays.min)
  @Max(D.loanPeriodDays.max)
  loanPeriodDays?: number;

  @ApiPropertyOptional({ minimum: D.finePerDayCents.min, maximum: D.finePerDayCents.max })
  @IsOptional()
  @IsInt()
  @Min(D.finePerDayCents.min)
  @Max(D.finePerDayCents.max)
  finePerDayCents?: number;

  @ApiPropertyOptional({ minimum: D.maxFinePerLoanCents.min, maximum: D.maxFinePerLoanCents.max })
  @IsOptional()
  @IsInt()
  @Min(D.maxFinePerLoanCents.min)
  @Max(D.maxFinePerLoanCents.max)
  maxFinePerLoanCents?: number;

  @ApiPropertyOptional({ minimum: D.maxActiveLoans.min, maximum: D.maxActiveLoans.max })
  @IsOptional()
  @IsInt()
  @Min(D.maxActiveLoans.min)
  @Max(D.maxActiveLoans.max)
  maxActiveLoans?: number;

  @ApiPropertyOptional({ minimum: D.reservationHoldHours.min, maximum: D.reservationHoldHours.max })
  @IsOptional()
  @IsInt()
  @Min(D.reservationHoldHours.min)
  @Max(D.reservationHoldHours.max)
  reservationHoldHours?: number;

  @ApiPropertyOptional({ minimum: D.fineBlockThresholdCents.min, maximum: D.fineBlockThresholdCents.max })
  @IsOptional()
  @IsInt()
  @Min(D.fineBlockThresholdCents.min)
  @Max(D.fineBlockThresholdCents.max)
  fineBlockThresholdCents?: number;
}
