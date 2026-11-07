import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module';
import { AccountsService } from './accounts.service';
import { FinePayment } from './entities/fine-payment.entity';
import { Loan } from './entities/loan.entity';
import { Reservation } from './entities/reservation.entity';
import { HoldExpiryService } from './hold-expiry.service';
import { LendingController } from './lending.controller';
import { LoansService } from './loans.service';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loan, Reservation, FinePayment]), SettingsModule],
  controllers: [LendingController],
  providers: [LoansService, ReservationsService, AccountsService, HoldExpiryService],
})
export class LendingModule {}
