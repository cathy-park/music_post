import { Check, Copy, LogIn, Music, Plus, Save, Trash2, UploadCloud } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { isSupabaseReady, supabase } from '../lib/supabase';
import { deleteEntry, getAdminData, saveBook, saveEntry } from '../lib/repository';
import type { DiaryBook, DiaryEntry } from '../types';

const emptyEntry = (bookId: string, order: number): DiaryEntry => ({
  id: crypto.randomUUID(),
  bookId,
  title: '',
  subtitle: '',
  dateLabel: `DAY ${order}`,
  comment: '',
  lyrics: '',
  audioUrl: '',
  coverTone: 'night',
  order,
  published: false,
});

export default function AdminPage() {
  const [book, setBook] = useState<DiaryBook | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [audioFile, setAudioFile] = useState<File>();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  const load = async () => {
    try {
      const data = await getAdminData();
      setBook(data.book);
      setEntries(data.entries);
      setSelectedId(data.entries[0]?.id ?? '');
      setNeedsLogin(false);
    } catch (error) {
      if (isSupabaseReady) setNeedsLogin(true);
      else setMessage((error as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId),
    [entries, selectedId],
  );

  const updateSelected = (patch: Partial<DiaryEntry>) => {
    setEntries((prev) => prev.map((entry) => entry.id === selectedId ? { ...entry, ...patch } : entry));
  };

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    setMessage(error ? error.message : '로그인 링크를 이메일로 보냈어요.');
  };

  const saveCurrentEntry = async () => {
    if (!selected) return;
    try {
      const saved = await saveEntry(selected, audioFile);
      setEntries((prev) => prev.map((entry) => entry.id === saved.id ? saved : entry));
      setAudioFile(undefined);
      setMessage('노래일기를 저장했어요.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const removeCurrent = async () => {
    if (!selected || !window.confirm('이 노래일기를 삭제할까요?')) return;
    await deleteEntry(selected.id);
    const next = entries.filter((entry) => entry.id !== selected.id);
    setEntries(next);
    setSelectedId(next[0]?.id ?? '');
    setMessage('삭제했어요.');
  };

  if (needsLogin) {
    return (
      <main className="admin-login">
        <div className="admin-login-card">
          <LogIn size={28} />
          <h1>관리자 로그인</h1>
          <p>등록한 관리자 이메일로 일회용 로그인 링크를 받아요.</p>
          <form onSubmit={handleMagicLink}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required />
            <button className="primary-button" type="submit">로그인 링크 받기</button>
          </form>
          {message && <p className="status-message">{message}</p>}
        </div>
      </main>
    );
  }

  if (!book) return <main className="center-state"><div className="loader" /></main>;

  const shareUrl = `${window.location.origin}/v/${book.shareToken}`;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1>음악일기 관리</h1>
        </div>
        <div className="admin-actions">
          <button
            className="ghost-button"
            onClick={async () => {
              await navigator.clipboard.writeText(shareUrl);
              setMessage('뷰어 링크를 복사했어요.');
            }}
          ><Copy size={16} /> 링크 복사</button>
          <a className="ghost-button" href={`/v/${book.shareToken}`} target="_blank" rel="noreferrer">뷰어 열기</a>
        </div>
      </header>

      {!isSupabaseReady && (
        <div className="demo-banner">
          현재는 로컬 데모 모드예요. 같은 브라우저에서만 저장되며, 실제 공유는 Supabase 연결 후 가능해요.
        </div>
      )}

      <section className="book-settings admin-card">
        <div className="card-title-row">
          <h2>첫 화면 설정</h2>
          <button className="primary-button compact" onClick={async () => {
            await saveBook(book);
            setMessage('첫 화면을 저장했어요.');
          }}><Save size={15} /> 저장</button>
        </div>
        <div className="form-grid two">
          <label>서비스 제목<input value={book.title} onChange={(e) => setBook({ ...book, title: e.target.value })} /></label>
          <label>한 줄 설명<input value={book.subtitle} onChange={(e) => setBook({ ...book, subtitle: e.target.value })} /></label>
          <label>받는 사람<input value={book.recipientName} onChange={(e) => setBook({ ...book, recipientName: e.target.value })} /></label>
          <label>보내는 사람<input value={book.senderName} onChange={(e) => setBook({ ...book, senderName: e.target.value })} /></label>
          <label>기념 일수<input type="number" value={book.dayCount} onChange={(e) => setBook({ ...book, dayCount: Number(e.target.value) })} /></label>
          <label className="toggle-label"><input type="checkbox" checked={book.published} onChange={(e) => setBook({ ...book, published: e.target.checked })} /> 링크 공개</label>
        </div>
        <label>첫 인사<textarea rows={4} value={book.coverMessage} onChange={(e) => setBook({ ...book, coverMessage: e.target.value })} /></label>
      </section>

      <section className="admin-workspace">
        <aside className="admin-list admin-card">
          <div className="card-title-row">
            <h2>노래일기</h2>
            <button className="icon-button" onClick={() => {
              const next = emptyEntry(book.id, entries.length + 1);
              setEntries([...entries, next]);
              setSelectedId(next.id);
            }} aria-label="노래일기 추가"><Plus size={18} /></button>
          </div>
          <div className="admin-entry-list">
            {entries.map((entry) => (
              <button key={entry.id} className={entry.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(entry.id)}>
                <Music size={16} />
                <span><strong>{entry.title || '제목 없음'}</strong><small>{entry.published ? '공개' : '비공개'} · {entry.dateLabel}</small></span>
              </button>
            ))}
          </div>
        </aside>

        <section className="entry-editor admin-card">
          {selected ? (
            <>
              <div className="card-title-row">
                <h2>노래일기 편집</h2>
                <div className="row-actions">
                  <button className="danger-button" onClick={removeCurrent}><Trash2 size={15} /> 삭제</button>
                  <button className="primary-button compact" onClick={saveCurrentEntry}><Check size={15} /> 저장</button>
                </div>
              </div>

              <div className="form-grid two">
                <label>곡 제목<input value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} /></label>
                <label>부제<input value={selected.subtitle} onChange={(e) => updateSelected({ subtitle: e.target.value })} /></label>
                <label>날짜 라벨<input value={selected.dateLabel} onChange={(e) => updateSelected({ dateLabel: e.target.value })} /></label>
                <label>정렬 순서<input type="number" value={selected.order} onChange={(e) => updateSelected({ order: Number(e.target.value) })} /></label>
                <label>커버 분위기
                  <select value={selected.coverTone} onChange={(e) => updateSelected({ coverTone: e.target.value as DiaryEntry['coverTone'] })}>
                    <option value="night">별이 많은 밤</option>
                    <option value="dawn">푸른 새벽</option>
                    <option value="warm">따뜻한 방</option>
                    <option value="forest">고요한 숲</option>
                  </select>
                </label>
                <label className="toggle-label"><input type="checkbox" checked={selected.published} onChange={(e) => updateSelected({ published: e.target.checked })} /> 뷰어에 공개</label>
              </div>

              <label className="upload-box">
                <UploadCloud size={22} />
                <span>{audioFile ? audioFile.name : selected.audioUrl ? '기존 음원이 연결되어 있어요' : '음성 또는 노래 파일 업로드'}</span>
                <small>mp3, m4a, wav 권장</small>
                <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0])} />
              </label>

              <label>짧은 코멘트<textarea rows={5} value={selected.comment} onChange={(e) => updateSelected({ comment: e.target.value })} /></label>
              <label>가사<textarea className="lyrics-editor" rows={18} value={selected.lyrics} onChange={(e) => updateSelected({ lyrics: e.target.value })} /></label>
            </>
          ) : (
            <div className="empty-editor"><Music size={28} /><p>왼쪽에서 노래일기를 선택하거나 새로 추가해줘.</p></div>
          )}
        </section>
      </section>

      {message && <div className="toast">{message}</div>}
    </main>
  );
}
