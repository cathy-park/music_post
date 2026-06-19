import { Check, Copy, Lock, LogIn, Music, Plus, Radio, Save, Trash2, UploadCloud } from 'lucide-react';
import { FormEvent, useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { resolveAudioUrl } from '../lib/idb';
import { isSupabaseReady, supabase } from '../lib/supabase';
import { deleteEntry, getAdminData, saveBook, saveEntry, createBook, deleteBook } from '../lib/repository';
import type { DiaryBook, DiaryEntry } from '../types';

/** 기준일: 2025-05-30 = DAY 1 */
const BASE_DATE = new Date('2025-05-30T00:00:00+09:00');

function calcDayLabel(dateStr: string): { label: string; dayNum: number } {
  if (!dateStr) return { label: '', dayNum: 0 };
  const picked = new Date(dateStr + 'T00:00:00+09:00');
  const diff = Math.round((picked.getTime() - BASE_DATE.getTime()) / (1000 * 60 * 60 * 24));
  const dayNum = diff + 1;
  return { label: `DAY ${dayNum}`, dayNum };
}

function labelToDateStr(label: string): string {
  const match = label.match(/DAY\s*(\d+)/);
  if (!match) return '';
  const dayNum = parseInt(match[1], 10);
  const d = new Date(BASE_DATE.getTime() + (dayNum - 1) * 24 * 60 * 60 * 1000);
  // toISOString()은 UTC 기준이라 KST(+9)에서 하루 밀림 → 9시간 보정
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10); // YYYY-MM-DD (KST 기준)
}

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
  icon: '🎵',
});

export default function AdminPage() {
  const [books, setBooks] = useState<DiaryBook[]>([]);
  const [activeBookId, setActiveBookId] = useState('');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [audioFile, setAudioFile] = useState<File>();
  const [message, setMessage] = useState('');

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [tapMode, setTapMode] = useState(false);
  const [tapStep, setTapStep] = useState(0);
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState('');
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);


  const load = async () => {
    try {
      const data = await getAdminData();
      setBooks(data.books);
      setEntries(data.entries);
      if (!selectedId && data.entries.length > 0) {
        setSelectedId(data.entries[0].id);
      }
    } catch (error) {
      setMessage((error as Error).message);
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

  /** 탭 모드에서 사용할 실제 가사 줄 목록 (빈 줄·헤더 포함 전체) */
  const tapLines = useMemo(() => {
    if (!tapMode || !selected) return [];
    return selected.lyrics.split('\n');
  }, [tapMode, selected]);




  /** 탭 모드 시작 */
  const startTapMode = useCallback(async () => {
    if (!selected?.audioUrl) { setMessage('먼저 음원을 업로드하고 저장해주세요.'); return; }
    const url = await resolveAudioUrl(selected.audioUrl);
    setResolvedAudioUrl(url);

    // 기존 가사에서 타임스탬프 파싱
    const initialTimestamps: number[] = [];
    const lines = selected.lyrics.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue; // 빈 줄 스킵
      const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]/);
      if (match) {
        const mm = parseInt(match[1], 10);
        const ss = parseFloat(match[2]);
        initialTimestamps.push(mm * 60 + ss);
      } else {
        break; // 타임코드 없는 줄을 만나면 중단
      }
    }

    setTapTimestamps(initialTimestamps);
    setTapStep(initialTimestamps.length);
    setAudioCurrentTime(0);
    setTapMode(true);
  }, [selected]);

  /** Space 키로도 탭 가능 */
  useEffect(() => {
    if (!tapMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleTap(); }
      if (e.code === 'Escape') setTapMode(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapMode, tapStep, tapLines]);

  /** 기록된 타임스탬프를 가사에 적용하고 모달 닫기 */
  const applyTapTimestamps = useCallback((timestamps: number[]) => {
    let tIdx = 0;
    const lrc = tapLines.map((line) => {
      // 이미 존재하는 타임코드 제거 (중복 방지)
      const plainLine = line.replace(/^\[\d+:\d+(?:\.\d+)?\]\s*/, '');
      if (!plainLine.trim()) return ''; // 빈 줄 유지
      if (tIdx >= timestamps.length) return plainLine; // 타임스탬프 없으면 일반 가사로

      const time = timestamps[tIdx++];
      const mm = String(Math.floor(time / 60)).padStart(2, '0');
      const ss = (time % 60).toFixed(2).padStart(5, '0');
      return `[${mm}:${ss}] ${plainLine}`;
    }).join('\n');

    updateSelected({ lyrics: lrc });
    setTapMode(false);
    setMessage('✅ LRC 타임스탬프가 적용됐어요! 저장 버튼을 눌러주세요.');
  }, [tapLines]);

  const nonEmptyTapLines = useMemo(() => tapLines.filter(l => l.trim()), [tapLines]);

  /** 탭 → 타임스탬프 기록 */
  const handleTap = useCallback(() => {
    const t = audioRef.current?.currentTime ?? 0;
    const next = [...tapTimestamps, t];
    setTapTimestamps(next);

    // 모든 줄 완료
    if (tapStep >= nonEmptyTapLines.length - 1) {
      applyTapTimestamps(next);
      return;
    }
    setTapStep((prev) => prev + 1);
  }, [tapTimestamps, tapStep, nonEmptyTapLines, applyTapTimestamps]);

  /** 이전 줄로 되돌리기 (Undo) */
  const handleUndo = useCallback(() => {
    if (tapStep === 0 || tapTimestamps.length === 0) return;
    const nextTimestamps = tapTimestamps.slice(0, -1);
    setTapTimestamps(nextTimestamps);
    setTapStep((prev) => prev - 1);

    // 오디오 재생 위치도 이전 타임스탬프(또는 0)로 되돌림
    if (audioRef.current) {
      audioRef.current.currentTime = nextTimestamps.length > 0 ? nextTimestamps[nextTimestamps.length - 1] : 0;
    }
  }, [tapStep, tapTimestamps]);



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

  const handleAddCategory = async () => {
    const title = window.prompt('새로운 재생목록(카테고리) 이름을 입력해주세요:', '새 카테고리');
    if (!title) return;
    try {
      const newBook = await createBook(title);
      setBooks([...books, newBook]);
      setActiveBookId(newBook.id);
      setMessage(`'${title}' 카테고리를 만들었어요.`);
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleDeleteCategory = async () => {
    if (!activeBook) return;
    if (!window.confirm(`'${activeBook.title}' 카테고리를 정말 삭제할까요? 안에 있는 노래도 모두 삭제됩니다.`)) return;
    try {
      await deleteBook(activeBook.id);
      const nextBooks = books.filter(b => b.id !== activeBook.id);
      setBooks(nextBooks);
      if (nextBooks.length > 0) setActiveBookId(nextBooks[0].id);
      setMessage('카테고리를 삭제했어요.');
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const handleUpdateCategoryName = async (newName: string) => {
    if (!activeBook || !newName) return;
    try {
      const nextBook = { ...activeBook, title: newName };
      await saveBook(nextBook);
      setBooks(books.map(b => b.id === activeBook.id ? nextBook : b));
    } catch (err) {
      setMessage((err as Error).message);
    }
  };



  if (!isUnlocked) {
    return (
      <main className="admin-login">
        <div className="admin-login-card">
          <Lock size={28} style={{ color: '#8870d7' }} />
          <h1>관리자 페이지</h1>
          <p>접근을 위해 비밀번호를 입력해주세요.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (passwordInput === '0530') {
              setIsUnlocked(true);
              setMessage('');
            } else {
              setMessage('비밀번호가 올바르지 않습니다.');
            }
          }}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="비밀번호"
              required
              autoFocus
            />
            <button className="primary-button" type="submit" style={{ width: '100%', marginTop: '10px' }}>확인</button>
          </form>
          {message && <p className="status-message" style={{ color: '#d76072' }}>{message}</p>}
        </div>
      </main>
    );
  }

  const activeBook = books.find(b => b.id === activeBookId);
  const activeEntries = activeBookId === '' ? entries : entries.filter(e => e.bookId === activeBookId);

  if (books.length === 0) return <main className="center-state"><div className="loader" /></main>;

  const shareUrl = activeBook ? `${window.location.origin}/v/${activeBook.shareToken}` : '';

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1>음악일기 관리</h1>
        </div>
        <div className="admin-actions">
          {activeBook && (
            <>
              <button
                className="ghost-button"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  setMessage('이 카테고리의 뷰어 링크를 복사했어요.');
                }}
              ><Copy size={16} /> 링크 복사</button>
              <a className="ghost-button" href={`/v/${activeBook.shareToken}`} target="_blank" rel="noreferrer">뷰어 열기</a>
            </>
          )}
        </div>
      </header>

      <div className="category-tabs">
        <button 
          className={`category-chip ${activeBookId === '' ? 'active' : ''}`}
          onClick={() => setActiveBookId('')}
        >
          모든 노래일기
        </button>
        {books.map(b => (
          <button 
            key={b.id} 
            className={`category-chip ${b.id === activeBookId ? 'active' : ''}`}
            onClick={() => setActiveBookId(b.id)}
          >
            {b.title || '제목 없음'}
          </button>
        ))}
        {isSupabaseReady && (
          <button className="category-chip add" onClick={handleAddCategory}>
            <Plus size={14} /> 새 카테고리
          </button>
        )}
      </div>

      {!isSupabaseReady && (
        <div className="demo-banner">
          현재는 로컬 데모 모드예요. 같은 브라우저에서만 저장되며, 실제 공유는 Supabase 연결 후 가능해요.
        </div>
      )}


      <section className="admin-workspace">
        <aside className="admin-list admin-card">
          <div className="card-title-row">
            <h2>{activeBook ? activeBook.title || '카테고리 이름 설정' : '모든 노래일기'} 
            {activeBook && <button className="icon-button compact" onClick={() => {
              const newTitle = window.prompt('카테고리 이름을 변경합니다:', activeBook?.title);
              if (newTitle) handleUpdateCategoryName(newTitle);
            }}><Music size={14}/></button>}</h2>
            <div className="row-actions">
              {activeBook && <button className="icon-button compact" onClick={handleDeleteCategory} title="카테고리 삭제"><Trash2 size={15} color="#d76072"/></button>}
              <button className="icon-button" onClick={() => {
                const bookIdToUse = activeBook ? activeBook.id : books[0].id;
                const next = emptyEntry(bookIdToUse, activeEntries.length + 1);
                setEntries([...entries, next]);
                setSelectedId(next.id);
              }} aria-label="노래일기 추가"><Plus size={18} /></button>
            </div>
          </div>
          <div className="admin-entry-list">
            {activeEntries.map((entry) => (
              <button key={entry.id} className={entry.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(entry.id)}>
                <span className="admin-entry-emoji">{entry.icon || '🎵'}</span>
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
                <label>카테고리(재생목록) 선택
                  <select value={selected.bookId} onChange={(e) => updateSelected({ bookId: e.target.value })}>
                    {books.map(b => (
                      <option key={b.id} value={b.id}>{b.title || '제목 없음'}</option>
                    ))}
                  </select>
                </label>
                <label>
                  날짜 선택
                  <input
                    type="date"
                    value={labelToDateStr(selected.dateLabel)}
                    min="2025-05-30"
                    onChange={(e) => {
                      const { label, dayNum } = calcDayLabel(e.target.value);
                      updateSelected({ dateLabel: label, order: dayNum });
                    }}
                  />
                  {selected.dateLabel && (
                    <small className="emoji-hint" style={{ marginTop: 4 }}>
                      → {selected.dateLabel} (정렬 순서: {selected.order}일)
                    </small>
                  )}
                </label>
                <label>
                  아이콘 이모지
                  <div className="emoji-input-wrap">
                    <span className="emoji-preview">{selected.icon || '🎵'}</span>
                    <input
                      className="emoji-input"
                      value={selected.icon ?? ''}
                      onChange={(e) => updateSelected({ icon: e.target.value })}
                      placeholder="🎵"
                      maxLength={8}
                    />
                  </div>
                  <small className="emoji-hint">토스페이스 이모지를 붙여넣거나 직접 입력하세요</small>
                </label>
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

              <label>가사
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#44506a', fontSize: 13, fontWeight: 650 }}>가사</span>
                  <button
                    type="button"
                    className="ghost-button"
                    style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={startTapMode}
                    title="음악을 재생하면서 줄마다 탭해서 LRC 타임스탬프 자동 생성"
                  >
                    <Radio size={13} /> 타임스탬프 기록
                  </button>
                </div>
                <textarea className="lyrics-editor" rows={18} value={selected.lyrics} onChange={(e) => updateSelected({ lyrics: e.target.value })} />
              </label>
            </>
          ) : (
            <div className="empty-editor"><Music size={28} /><p>왼쪽에서 노래일기를 선택하거나 새로 추가해줘.</p></div>
          )}
        </section>
      </section>

      {message && <div className="toast">{message}</div>}

      {/* 탭-투-타임스탬프 모달 */}
      {tapMode && (
        <div className="tap-overlay">
          <div className="tap-modal">
            <div className="tap-modal-header">
              <span className="eyebrow">TAP TO TIMESTAMP</span>
              <h2>타임스탬프 기록</h2>
              <p>음악이 재생되면 각 가사 줄이 시작될 때 버튼을 탭하세요.<br /><small>Space 키로도 탭 가능 · ESC로 취소</small></p>
            </div>

            <audio
              ref={audioRef}
              src={resolvedAudioUrl}
              onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                if (tapTimestamps.length > 0) {
                  e.currentTarget.currentTime = tapTimestamps[tapTimestamps.length - 1];
                }
              }}
              autoPlay
              controls
              style={{ width: '100%', marginBottom: 20, borderRadius: 12 }}
            />

            <div className="tap-current-line">
              <span className="tap-line-label" style={{ color: '#8892a5', letterSpacing: 0 }}>방금 지나간 줄</span>
              <div style={{ color: '#a0a8b8', fontSize: 14, marginBottom: 14, fontWeight: 500 }}>
                {tapStep > 0 ? nonEmptyTapLines[tapStep - 1] : '...'}
              </div>

              <span className="tap-line-label" style={{ color: '#d76072' }}>다음 탭 대기 중 ({tapStep + 1} / {nonEmptyTapLines.length})</span>
              <strong className="tap-line-text" style={{ fontSize: 22, color: '#2a2221' }}>
                {nonEmptyTapLines[tapStep] || '(끝)'}
              </strong>
              <div style={{ fontSize: 12.5, color: '#c16f7b', marginTop: 8, fontWeight: 650 }}>
                ↑ 이 가사가 들리기 시작하는 순간 탭하세요!
              </div>
            </div>

            <div className="tap-progress">
              {nonEmptyTapLines.map((line, i) => (
                <span
                  key={i}
                  className={`tap-pill${i < tapStep ? ' done' : i === tapStep ? ' active' : ''}`}
                >
                  {line.length > 14 ? line.slice(0, 14) + '…' : line}
                </span>
              ))}
            </div>

            <div className="tap-actions">
              {tapTimestamps.length > 0 ? (
                <button className="ghost-button" onClick={() => applyTapTimestamps(tapTimestamps)} style={{ marginRight: 'auto' }}>
                  지금까지 저장
                </button>
              ) : (
                <button className="danger-button" onClick={() => setTapMode(false)} style={{ marginRight: 'auto' }}>취소</button>
              )}
              
              <button className="ghost-button" onClick={handleUndo} disabled={tapStep === 0}>
                ↩ 되돌리기
              </button>
              <button className="tap-button" onClick={handleTap}>
                {tapStep >= nonEmptyTapLines.length - 1 ? '✅ 완료' : '🎵 다음 줄 탭'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
