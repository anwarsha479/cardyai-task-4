import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for paging through a large catalogue: the sort key used by the cursor, and trigram indexes so
 * "contains" searches on title and author do not scan the whole table.
 */
export class AddBookListIndexes1762600000700 implements MigrationInterface {
  name = 'AddBookListIndexes1762600000700';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_books_title`);
    await queryRunner.query(`CREATE INDEX ix_books_sort ON books (lower(title), id)`);
    await queryRunner.query(`CREATE INDEX ix_books_title_trgm ON books USING gin (title gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX ix_books_author_trgm ON books USING gin (author gin_trgm_ops)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX ix_books_author_trgm`);
    await queryRunner.query(`DROP INDEX ix_books_title_trgm`);
    await queryRunner.query(`DROP INDEX ix_books_sort`);
    await queryRunner.query(`CREATE INDEX ix_books_title ON books (lower(title))`);
  }
}
