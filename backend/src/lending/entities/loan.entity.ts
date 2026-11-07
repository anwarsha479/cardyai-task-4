import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Book } from '../../books/entities/book.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'loans' })
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'book_id', type: 'uuid' })
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'book_id' })
  book?: Book;

  @Column({ name: 'copy_number', type: 'smallint' })
  copyNumber: number;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'member_id' })
  member?: User;

  @Column({ name: 'checked_out_at', type: 'timestamptz' })
  checkedOutAt: Date;

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt: Date;

  @Column({ name: 'returned_at', type: 'timestamptz', nullable: true })
  returnedAt: Date | null;

  @Column({ name: 'returned_by', type: 'uuid', nullable: true })
  returnedById: string | null;

  @Column({ name: 'days_late', type: 'integer', nullable: true })
  daysLate: number | null;

  @Column({ name: 'fine_cents', type: 'integer', default: 0 })
  fineCents: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
