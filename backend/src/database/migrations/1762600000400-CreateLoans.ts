import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoans1762600000400 implements MigrationInterface {
  name = 'CreateLoans1762600000400';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE loans (
        id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        book_id        uuid        NOT NULL REFERENCES books (id) ON DELETE RESTRICT,
        copy_number    smallint    NOT NULL,
        member_id      uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        checked_out_at timestamptz NOT NULL,
        due_at         timestamptz NOT NULL,
        returned_at    timestamptz NULL,
        returned_by    uuid        NULL REFERENCES users (id) ON DELETE SET NULL,
        days_late      integer     NULL,
        fine_cents     integer     NOT NULL DEFAULT 0,
        created_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_loans_copy_number CHECK (copy_number >= 1),
        CONSTRAINT ck_loans_due_after_checkout CHECK (due_at > checked_out_at),
        CONSTRAINT ck_loans_returned_after_checkout CHECK (returned_at IS NULL OR returned_at >= checked_out_at),
        CONSTRAINT ck_loans_days_late CHECK ((returned_at IS NULL) = (days_late IS NULL) AND (days_late IS NULL OR days_late >= 0)),
        CONSTRAINT ck_loans_fine CHECK (fine_cents >= 0 AND (returned_at IS NOT NULL OR fine_cents = 0))
      )`);
    // The last-copy guarantee (FR-08): at most one open loan per copy, whoever writes it.
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_loans_open_copy ON loans (book_id, copy_number) WHERE returned_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_loans_open_member_book ON loans (book_id, member_id) WHERE returned_at IS NULL`,
    );
    await queryRunner.query(`CREATE INDEX ix_loans_member ON loans (member_id, checked_out_at)`);
    await queryRunner.query(`CREATE INDEX ix_loans_open_due ON loans (due_at) WHERE returned_at IS NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE loans`);
  }
}
