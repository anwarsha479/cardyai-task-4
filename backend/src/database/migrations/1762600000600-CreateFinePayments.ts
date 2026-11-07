import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinePayments1762600000600 implements MigrationInterface {
  name = 'CreateFinePayments1762600000600';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE fine_payments (
        id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id    uuid         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        amount_cents integer      NOT NULL,
        note         varchar(200) NULL,
        recorded_by  uuid         NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        created_at   timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT ck_fine_payments_amount CHECK (amount_cents > 0)
      )`);
    await queryRunner.query(`CREATE INDEX ix_fine_payments_member ON fine_payments (member_id, created_at)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE fine_payments`);
  }
}
