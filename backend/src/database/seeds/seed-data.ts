export const SEED_LIBRARIAN = { email: 'librarian@example.test', name: 'Lena Librarian' };

export const SEED_MEMBERS = [
  'Aisha Khan',
  'Ben Carter',
  'Chloe Martin',
  'Daniel Osei',
  'Emma Rossi',
  'Farid Haddad',
  'Grace Liu',
  'Hugo Silva',
  'Isla Murphy',
  'Jonas Weber',
].map((name, i) => ({ email: `member${i + 1}@example.test`, name }));

export const SEED_BOOKS: { title: string; author: string; copies: number }[] = [
  { title: 'Pride and Prejudice', author: 'Jane Austen', copies: 3 },
  { title: '1984', author: 'George Orwell', copies: 4 },
  { title: 'To Kill a Mockingbird', author: 'Harper Lee', copies: 3 },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', copies: 2 },
  { title: 'Moby-Dick', author: 'Herman Melville', copies: 1 },
  { title: 'Jane Eyre', author: 'Charlotte Brontë', copies: 2 },
  { title: 'Wuthering Heights', author: 'Emily Brontë', copies: 2 },
  { title: 'Frankenstein', author: 'Mary Shelley', copies: 3 },
  { title: 'Dracula', author: 'Bram Stoker', copies: 2 },
  { title: 'The Hobbit', author: 'J. R. R. Tolkien', copies: 5 },
  { title: 'Brave New World', author: 'Aldous Huxley', copies: 2 },
  { title: 'The Catcher in the Rye', author: 'J. D. Salinger', copies: 1 },
  { title: 'Little Women', author: 'Louisa May Alcott', copies: 2 },
  { title: 'Great Expectations', author: 'Charles Dickens', copies: 3 },
  { title: 'A Tale of Two Cities', author: 'Charles Dickens', copies: 2 },
  { title: 'Crime and Punishment', author: 'Fyodor Dostoevsky', copies: 1 },
  { title: 'War and Peace', author: 'Leo Tolstoy', copies: 1 },
  { title: 'Anna Karenina', author: 'Leo Tolstoy', copies: 2 },
  { title: 'The Odyssey', author: 'Homer', copies: 3 },
  { title: 'Don Quixote', author: 'Miguel de Cervantes', copies: 1 },
  { title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', copies: 2 },
  { title: 'Les Misérables', author: 'Victor Hugo', copies: 2 },
  { title: 'The Count of Monte Cristo', author: 'Alexandre Dumas', copies: 2 },
  { title: 'One Hundred Years of Solitude', author: 'Gabriel García Márquez', copies: 3 },
  { title: 'The Grapes of Wrath', author: 'John Steinbeck', copies: 2 },
  { title: 'Of Mice and Men', author: 'John Steinbeck', copies: 4 },
  { title: 'Fahrenheit 451', author: 'Ray Bradbury', copies: 3 },
  { title: 'Slaughterhouse-Five', author: 'Kurt Vonnegut', copies: 2 },
  { title: 'Lord of the Flies', author: 'William Golding', copies: 3 },
  { title: 'Animal Farm', author: 'George Orwell', copies: 5 },
  { title: "The Handmaid's Tale", author: 'Margaret Atwood', copies: 2 },
  { title: 'Beloved', author: 'Toni Morrison', copies: 2 },
  { title: 'Things Fall Apart', author: 'Chinua Achebe', copies: 3 },
  { title: 'The Old Man and the Sea', author: 'Ernest Hemingway', copies: 4 },
  { title: 'Middlemarch', author: 'George Eliot', copies: 1 },
  { title: 'Emma', author: 'Jane Austen', copies: 2 },
  { title: 'Sense and Sensibility', author: 'Jane Austen', copies: 2 },
  { title: 'The Adventures of Huckleberry Finn', author: 'Mark Twain', copies: 3 },
  { title: 'Treasure Island', author: 'Robert Louis Stevenson', copies: 4 },
  { title: 'The Time Machine', author: 'H. G. Wells', copies: 3 },
];

/**
 * member is 1-based into SEED_MEMBERS. Days are counted back from the moment the seed runs; with the
 * default 14-day loan period an open loan taken out more than 14 days ago is overdue.
 */
export const SEED_LOANS: { member: number; book: string; outDaysAgo: number; returnedDaysAgo?: number }[] = [
  { member: 1, book: 'Moby-Dick', outDaysAgo: 20 },
  { member: 1, book: 'The Hobbit', outDaysAgo: 3 },
  { member: 2, book: '1984', outDaysAgo: 10 },
  { member: 2, book: 'Crime and Punishment', outDaysAgo: 25 },
  { member: 3, book: 'Pride and Prejudice', outDaysAgo: 5 },
  { member: 3, book: 'Dracula', outDaysAgo: 16 },
  { member: 4, book: 'The Catcher in the Rye', outDaysAgo: 8 },
  { member: 4, book: 'Fahrenheit 451', outDaysAgo: 1 },
  { member: 5, book: 'War and Peace', outDaysAgo: 30 },
  { member: 6, book: 'Animal Farm', outDaysAgo: 2 },
  { member: 6, book: 'Beloved', outDaysAgo: 12 },
  { member: 7, book: 'The Great Gatsby', outDaysAgo: 18 },
  { member: 8, book: 'The Great Gatsby', outDaysAgo: 6 },
  { member: 8, book: 'Jane Eyre', outDaysAgo: 9 },
  { member: 9, book: 'Things Fall Apart', outDaysAgo: 15 },
  { member: 10, book: 'Frankenstein', outDaysAgo: 22 },
  { member: 3, book: 'Emma', outDaysAgo: 40, returnedDaysAgo: 24 },
  { member: 5, book: 'Emma', outDaysAgo: 60, returnedDaysAgo: 40 },
  { member: 10, book: 'Middlemarch', outDaysAgo: 70, returnedDaysAgo: 26 },
  { member: 10, book: 'Les Misérables', outDaysAgo: 50, returnedDaysAgo: 16 },
  { member: 3, book: 'Of Mice and Men', outDaysAgo: 35, returnedDaysAgo: 9 },
  { member: 1, book: 'The Odyssey', outDaysAgo: 30, returnedDaysAgo: 20 },
  { member: 6, book: 'Treasure Island', outDaysAgo: 45, returnedDaysAgo: 2 },
  { member: 9, book: 'The Time Machine', outDaysAgo: 28, returnedDaysAgo: 13 },
  { member: 2, book: 'Middlemarch', outDaysAgo: 16, returnedDaysAgo: 1 },
];

export const SEED_PAYMENTS: { member: number; amountCents: number; daysAgo: number; note: string }[] = [
  { member: 5, amountCents: 100, daysAgo: 30, note: 'Part payment at the desk' },
  { member: 3, amountCents: 300, daysAgo: 5, note: 'Paid in full' },
];

/**
 * Waiting reservations for books with no free copy, in queue order per book. A `readyFromReturnOf`
 * reservation holds the copy freed by that returned loan (index into SEED_LOANS), from the return.
 */
export const SEED_RESERVATIONS: { member: number; book: string; daysAgo: number; readyFromReturnOf?: number }[] = [
  { member: 4, book: 'Middlemarch', daysAgo: 10, readyFromReturnOf: 24 },
  { member: 1, book: 'War and Peace', daysAgo: 12 },
  { member: 2, book: 'Moby-Dick', daysAgo: 10 },
  { member: 6, book: 'Crime and Punishment', daysAgo: 7 },
  { member: 4, book: 'Moby-Dick', daysAgo: 5 },
  { member: 9, book: 'The Great Gatsby', daysAgo: 4 },
  { member: 3, book: 'The Great Gatsby', daysAgo: 2 },
];

export const EXPECTED_COUNTS = {
  users: 1 + SEED_MEMBERS.length,
  books: SEED_BOOKS.length,
  copies: SEED_BOOKS.reduce((sum, b) => sum + b.copies, 0),
  loans: 25,
  reservations: SEED_RESERVATIONS.length,
};
