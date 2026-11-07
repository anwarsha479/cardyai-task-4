import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Clock, CLOCK } from '../common/clock/clock';
import { EnvironmentVariables } from '../config/env.validation';
import { SettingsService } from '../settings/settings.service';
import { lockBook, processExpiredHolds } from './copy-queue';

/**
 * Expires reservation holds whose time is up and passes each copy to the next member. Every write on a
 * book does the same for that book first; this job keeps books nobody is touching up to date.
 */
@Injectable()
export class HoldExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpiryService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onModuleInit(): void {
    const seconds = this.config.get('HOLD_SWEEP_INTERVAL_SECONDS', { infer: true });
    if (seconds > 0) {
      this.timer = setInterval(() => void this.tick(), seconds * 1000);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Returns the ids of the books whose holds expired, one transaction per book. */
  async processExpired(): Promise<string[]> {
    const now = this.clock.now();
    const rows: { book_id: string }[] = await this.dataSource.query(
      `SELECT DISTINCT book_id FROM reservations WHERE status = 'ready' AND hold_expires_at <= $1 ORDER BY book_id`,
      [now],
    );
    const changed: string[] = [];
    for (const { book_id: bookId } of rows) {
      const expired = await this.dataSource.transaction(async (manager) => {
        const book = await lockBook(manager, bookId);
        return processExpiredHolds(manager, book, now, await this.settings.getLimits(manager));
      });
      if (expired > 0) changed.push(bookId);
    }
    return changed;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processExpired();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }
}
