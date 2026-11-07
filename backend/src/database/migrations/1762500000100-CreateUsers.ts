import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1762500000100 implements MigrationInterface {
  name = 'CreateUsers1762500000100';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE user_role AS ENUM ('member', 'librarian')`);
    await queryRunner.query(`
      CREATE TABLE users (
        id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        email         varchar(254) NOT NULL,
        name          varchar(120) NOT NULL,
        password_hash varchar(100) NOT NULL,
        role          user_role    NOT NULL,
        created_at    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT ck_users_email_normalized CHECK (email = lower(btrim(email)))
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TYPE user_role`);
  }
}
