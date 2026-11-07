import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBooks1762600000300 implements MigrationInterface {
  name = 'CreateBooks1762600000300';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE books (
        id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        title        varchar(200) NOT NULL,
        author       varchar(200) NOT NULL,
        total_copies integer      NOT NULL,
        created_at   timestamptz  NOT NULL DEFAULT now(),
        updated_at   timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT ck_books_title CHECK (btrim(title) <> ''),
        CONSTRAINT ck_books_author CHECK (btrim(author) <> ''),
        CONSTRAINT ck_books_total_copies CHECK (total_copies BETWEEN 0 AND 100)
      )`);
    await queryRunner.query(`CREATE INDEX ix_books_title ON books (lower(title))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE books`);
  }
}
