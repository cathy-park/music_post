import type { DiaryBook, DiaryEntry } from '../types';
import { loadLocalBook, loadLocalEntries, saveLocalBook, saveLocalEntries } from './storage';
import { isSupabaseReady, supabase } from './supabase';
import { saveAudioToIdb } from './idb';

function mapBook(row: Record<string, unknown>): DiaryBook {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    subtitle: String(row.subtitle ?? ''),
    recipientName: String(row.recipient_name ?? ''),
    senderName: String(row.sender_name ?? ''),
    dayCount: Number(row.day_count ?? 100),
    coverMessage: String(row.cover_message ?? ''),
    shareToken: String(row.share_token ?? ''),
    published: Boolean(row.published),
  };
}

function mapEntry(row: Record<string, unknown>): DiaryEntry {
  return {
    id: String(row.id),
    bookId: String(row.book_id),
    title: String(row.title ?? ''),
    subtitle: String(row.subtitle ?? ''),
    dateLabel: String(row.date_label ?? ''),
    comment: String(row.comment ?? ''),
    lyrics: String(row.lyrics ?? ''),
    audioUrl: String(row.audio_url ?? ''),
    coverTone: (row.cover_tone as DiaryEntry['coverTone']) ?? 'night',
    order: Number(row.sort_order ?? 0),
    published: Boolean(row.published),
    icon: String(row.icon ?? '🎵'),
  };
}

export async function getViewerData(token: string): Promise<{ book: DiaryBook; entries: DiaryEntry[] }> {
  if (!isSupabaseReady || !supabase) {
    const book = loadLocalBook();
    const entries = loadLocalEntries().filter((entry) => entry.published);
    return { book, entries };
  }

  const [{ data: bookRows, error: bookError }, { data: entryRows, error: entryError }] = await Promise.all([
    supabase.rpc('get_public_book', { p_share_token: token }),
    supabase.rpc('get_public_entries', { p_share_token: token }),
  ]);

  if (bookError) throw bookError;
  if (entryError) throw entryError;
  const row = Array.isArray(bookRows) ? bookRows[0] : bookRows;
  if (!row) throw new Error('공개된 음악일기를 찾을 수 없습니다.');
  return {
    book: mapBook(row as Record<string, unknown>),
    entries: (entryRows ?? []).map((item: Record<string, unknown>) => mapEntry(item)),
  };
}

export async function getAdminData(): Promise<{ book: DiaryBook; entries: DiaryEntry[] }> {
  if (!isSupabaseReady || !supabase) {
    return { book: loadLocalBook(), entries: loadLocalEntries() };
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('로그인이 필요합니다.');

  const { data: bookRow, error: bookError } = await supabase
    .from('diary_books')
    .select('*')
    .eq('owner_id', userData.user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (bookError) throw bookError;
  if (!bookRow) throw new Error('먼저 Supabase에서 기본 책 레코드를 만들어주세요.');

  const { data: entryRows, error: entriesError } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('book_id', bookRow.id)
    .order('sort_order', { ascending: true });
  if (entriesError) throw entriesError;

  return {
    book: mapBook(bookRow),
    entries: (entryRows ?? []).map(mapEntry),
  };
}

export async function saveBook(book: DiaryBook): Promise<void> {
  if (!isSupabaseReady || !supabase) {
    saveLocalBook(book);
    return;
  }

  const { error } = await supabase
    .from('diary_books')
    .update({
      title: book.title,
      subtitle: book.subtitle,
      recipient_name: book.recipientName,
      sender_name: book.senderName,
      day_count: book.dayCount,
      cover_message: book.coverMessage,
      published: book.published,
    })
    .eq('id', book.id);
  if (error) throw error;
}

export async function saveEntry(entry: DiaryEntry, audioFile?: File): Promise<DiaryEntry> {
  // ── 로컬(데모) 모드: IndexedDB에 오디오 저장 ──
  if (!isSupabaseReady || !supabase) {
    let audioUrl = entry.audioUrl;
    if (audioFile) {
      // localStorage 용량 초과 방지: IndexedDB에 파일 저장
      const key = `${entry.id}-${Date.now()}`;
      audioUrl = await saveAudioToIdb(key, audioFile);
    }
    const next = { ...entry, audioUrl };
    const entries = loadLocalEntries();
    const index = entries.findIndex((item) => item.id === next.id);
    if (index >= 0) entries[index] = next;
    else entries.push(next);
    saveLocalEntries(entries.sort((a, b) => a.order - b.order));
    return next;
  }

  // ── Supabase 모드 ──
  let audioUrl = entry.audioUrl;
  if (audioFile) {
    const safeName = audioFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${entry.bookId}/${entry.id}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('music-diary-audio').upload(path, audioFile, {
      upsert: true,
      contentType: audioFile.type,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('music-diary-audio').getPublicUrl(path);
    audioUrl = data.publicUrl;
  }

  const payload = {
    id: entry.id,
    book_id: entry.bookId,
    title: entry.title,
    subtitle: entry.subtitle,
    date_label: entry.dateLabel,
    comment: entry.comment,
    lyrics: entry.lyrics,
    audio_url: audioUrl,
    cover_tone: entry.coverTone,
    sort_order: entry.order,
    published: entry.published,
    icon: entry.icon ?? '🎵',
  };

  const { data, error } = await supabase
    .from('diary_entries')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return mapEntry(data);
}

export async function deleteEntry(id: string): Promise<void> {
  if (!isSupabaseReady || !supabase) {
    saveLocalEntries(loadLocalEntries().filter((entry) => entry.id !== id));
    return;
  }
  const { error } = await supabase.from('diary_entries').delete().eq('id', id);
  if (error) throw error;
}
