import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { ClockModule } from './common/clock/clock.module';
import { EnvironmentVariables, ROOT_ENV_FILE, validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/data-source';
import { LendingModule } from './lending/lending.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ROOT_ENV_FILE, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions(
          {
            DB_HOST: config.get('DB_HOST', { infer: true }),
            DB_PORT: config.get('DB_PORT', { infer: true }),
            DB_USER: config.get('DB_USER', { infer: true }),
            DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
          },
          config.get('DB_NAME', { infer: true }),
        ),
        autoLoadEntities: true,
      }),
    }),
    ClockModule,
    UsersModule,
    AuthModule,
    SettingsModule,
    BooksModule,
    LendingModule,
  ],
})
export class AppModule {}
