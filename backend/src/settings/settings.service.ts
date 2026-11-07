import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Clock, CLOCK } from '../common/clock/clock';
import { AppError, FieldErrors } from '../common/exceptions/app-error';
import { validationExceptionFactory } from '../common/pipes/validation-exception.factory';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { defaultLimits, Limits, SETTING_DEFINITIONS, SETTING_KEYS, SettingKey } from './settings.constants';
import { Setting } from './entities/setting.entity';

export interface SettingView {
  key: SettingKey;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  updatedAt: Date | null;
  updatedBy: { id: string; name: string } | null;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Current limits, read from the table on every call so a change applies to the next operation (LL-DM-5). */
  async getLimits(manager: EntityManager = this.dataSource.manager): Promise<Limits> {
    const rows = await manager.find(Setting);
    const limits = defaultLimits();
    for (const row of rows) {
      if ((SETTING_KEYS as string[]).includes(row.key)) limits[row.key as SettingKey] = row.value;
    }
    return limits;
  }

  async getAll(): Promise<{ settings: SettingView[] }> {
    const rows = await this.dataSource.manager.find(Setting, { relations: { updatedBy: true } });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return {
      settings: SETTING_KEYS.map((key) => {
        const row = byKey.get(key);
        const def = SETTING_DEFINITIONS[key];
        return {
          key,
          value: row?.value ?? def.defaultValue,
          defaultValue: def.defaultValue,
          min: def.min,
          max: def.max,
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row?.updatedBy ? { id: row.updatedBy.id, name: row.updatedBy.name } : null,
        };
      }),
    };
  }

  /** Validates the whole change and saves it atomically, or saves nothing. */
  async update(user: AuthUser, body: unknown): Promise<{ settings: SettingView[] }> {
    const changes = this.parseChanges(body);
    const now = this.clock.now();
    await this.dataSource.manager.save(
      Setting,
      Object.entries(changes).map(([key, value]) => ({ key, value, updatedById: user.id, updatedAt: now })),
    );
    return this.getAll();
  }

  private parseChanges(body: unknown): Partial<Limits> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw AppError.validation({ body: ['Send a JSON object with the settings to change'] });
    }
    const unknownKeys = Object.keys(body).filter((k) => !(SETTING_KEYS as string[]).includes(k));
    if (unknownKeys.length > 0) {
      const fields: FieldErrors = Object.fromEntries(unknownKeys.map((k) => [k, ['Unknown setting']]));
      throw AppError.validation(fields, 'Unknown setting');
    }
    if (Object.keys(body).length === 0) {
      throw AppError.validation({ body: ['Provide at least one setting to change'] });
    }
    const dto = plainToInstance(UpdateSettingsDto, body);
    const errors = validateSync(dto);
    if (errors.length > 0) throw validationExceptionFactory(errors);
    return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) as Partial<Limits>;
  }
}
