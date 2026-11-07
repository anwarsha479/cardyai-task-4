import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { api, ApiError } from '../api/client';
import type { BookInput, BookView } from '../api/types';

interface Props {
  open: boolean;
  book: BookView | null;
  onClose(): void;
  onSaved(book: BookView): void;
}

const EMPTY = { title: '', author: '', totalCopies: '1' };

/** Add a book, or edit one (including its copy count). The API refuses removing copies that are out. */
export function BookFormDialog({ open, book, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(book ? { title: book.title, author: book.author, totalCopies: String(book.totalCopies) } : EMPTY);
  }, [open, book]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const body: BookInput = { title: form.title, author: form.author, totalCopies: form.totalCopies === '' ? NaN : Number(form.totalCopies) };
    try {
      const saved = await api<BookView>(book ? `/books/${book.id}` : '/books', { method: book ? 'PATCH' : 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not save the book'));
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (field: string) => error?.fieldErrors[field]?.[0];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{book ? 'Edit book' : 'Add a book'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && !Object.keys(error.fieldErrors).length && <Alert severity="error">{error.message}</Alert>}
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              error={Boolean(fieldError('title'))}
              helperText={fieldError('title')}
              required
              autoFocus
              fullWidth
            />
            <TextField
              label="Author"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              error={Boolean(fieldError('author'))}
              helperText={fieldError('author')}
              required
              fullWidth
            />
            <TextField
              label="Number of copies"
              type="number"
              value={form.totalCopies}
              onChange={(e) => setForm({ ...form, totalCopies: e.target.value })}
              error={Boolean(fieldError('totalCopies'))}
              helperText={fieldError('totalCopies') ?? (book ? 'New copies go to members waiting in the queue first.' : undefined)}
              slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
              required
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {book ? 'Save' : 'Add book'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
