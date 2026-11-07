import { hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Role } from '../../src/auth/enums/role.enum';
import { Book } from '../../src/books/entities/book.entity';
import { User } from '../../src/users/entities/user.entity';

export const TEST_PASSWORD = 'correct-horse-battery';

let sequence = 0;
let passwordHash: string | undefined;

export async function createUser(dataSource: DataSource, options: { role?: Role; name?: string } = {}): Promise<User> {
  sequence += 1;
  const role = options.role ?? Role.Member;
  passwordHash ??= await hash(TEST_PASSWORD, 4);
  const repo = dataSource.getRepository(User);
  return repo.save(repo.create({ role, name: options.name ?? `${role} ${sequence}`, email: `${role}${sequence}@example.test`, passwordHash }));
}

export async function createBook(dataSource: DataSource, options: { title?: string; author?: string; copies?: number } = {}): Promise<Book> {
  sequence += 1;
  return dataSource.getRepository(Book).save({
    title: options.title ?? `Book ${sequence}`,
    author: options.author ?? 'Test Author',
    totalCopies: options.copies ?? 1,
  });
}

/** Records a returned loan carrying `fineCents`, on a book of its own, to give a member a balance. */
export async function chargeFine(dataSource: DataSource, member: User, fineCents: number): Promise<void> {
  const book = await createBook(dataSource, { copies: 1 });
  await dataSource.query(
    `INSERT INTO loans (book_id, copy_number, member_id, checked_out_at, due_at, returned_at, days_late, fine_cents)
     VALUES ($1, 1, $2, '2026-01-01T12:00:00Z', '2026-01-15T12:00:00Z', '2026-02-01T12:00:00Z', 17, $3)`,
    [book.id, member.id, fineCents],
  );
}

/** Removes stored settings so the defaults apply again. */
export async function resetSettings(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM settings');
}

export async function setSetting(dataSource: DataSource, key: string, value: number): Promise<void> {
  await dataSource.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}
