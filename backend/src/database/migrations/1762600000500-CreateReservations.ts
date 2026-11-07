import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReservations1762600000500 implements MigrationInterface {
  name = 'CreateReservations1762600000500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE reservation_status AS ENUM ('waiting', 'ready', 'fulfilled', 'expired', 'cancelled')`,
    );
    await queryRunner.query(`
      CREATE TABLE reservations (
        id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_seq        bigint             GENERATED ALWAYS AS IDENTITY,
        book_id          uuid               NOT NULL REFERENCES books (id) ON DELETE RESTRICT,
        member_id        uuid               NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        status           reservation_status NOT NULL DEFAULT 'waiting',
        held_copy_number smallint           NULL,
        ready_at         timestamptz        NULL,
        hold_expires_at  timestamptz        NULL,
        closed_at        timestamptz        NULL,
        loan_id          uuid               NULL REFERENCES loans (id) ON DELETE SET NULL,
        created_at       timestamptz        NOT NULL DEFAULT now(),
        CONSTRAINT uq_reservations_queue_seq UNIQUE (queue_seq),
        CONSTRAINT ck_reservations_waiting CHECK (status <> 'waiting' OR (held_copy_number IS NULL AND closed_at IS NULL)),
        CONSTRAINT ck_reservations_ready CHECK (
          status <> 'ready' OR (held_copy_number IS NOT NULL AND ready_at IS NOT NULL AND hold_expires_at > ready_at AND closed_at IS NULL)),
        CONSTRAINT ck_reservations_closed CHECK (status IN ('waiting', 'ready') OR closed_at IS NOT NULL),
        CONSTRAINT ck_reservations_fulfilled CHECK (status <> 'fulfilled' OR loan_id IS NOT NULL)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_reservations_ready_copy ON reservations (book_id, held_copy_number) WHERE status = 'ready'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX ux_reservations_one_active ON reservations (book_id, member_id) WHERE status IN ('waiting', 'ready')`,
    );
    await queryRunner.query(`CREATE INDEX ix_reservations_queue ON reservations (book_id, queue_seq) WHERE status = 'waiting'`);
    await queryRunner.query(`CREATE INDEX ix_reservations_ready_expiry ON reservations (hold_expires_at) WHERE status = 'ready'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE reservations`);
    await queryRunner.query(`DROP TYPE reservation_status`);
  }
}
