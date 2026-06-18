import type { DiaryBook, DiaryEntry } from '../types';
import { sampleBook, sampleEntries } from '../data';

const BOOK_KEY = 'music-diary-book';
const ENTRIES_KEY = 'music-diary-entries';

export function loadLocalBook(): DiaryBook {
  const raw = localStorage.getItem(BOOK_KEY);
  if (!raw) {
    localStorage.setItem(BOOK_KEY, JSON.stringify(sampleBook));
    return sampleBook;
  }
  return JSON.parse(raw) as DiaryBook;
}

export function saveLocalBook(book: DiaryBook): void {
  localStorage.setItem(BOOK_KEY, JSON.stringify(book));
}

export function loadLocalEntries(): DiaryEntry[] {
  const raw = localStorage.getItem(ENTRIES_KEY);
  if (!raw) {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(sampleEntries));
    return sampleEntries;
  }
  return (JSON.parse(raw) as DiaryEntry[]).sort((a, b) => a.order - b.order);
}

export function saveLocalEntries(entries: DiaryEntry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}
