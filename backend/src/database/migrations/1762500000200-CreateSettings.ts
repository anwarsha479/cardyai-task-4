import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettings1762500000200 implements MigrationInterface {
  name = 'CreateSettings1762500000200';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE settings (
        key        varchar(64) PRIMARY KEY,
        value      integer     NOT NULL,
        updated_by uuid        NULL REFERENCES users (id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE settings`);
  }
}
