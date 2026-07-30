import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AccessLog } from '../types';
import { X, Clock, Smartphone, Music, Trash2, RefreshCw } from 'lucide-react';

interface BookInfo {
  id: string;
  title: string;
  shareToken: string;
}

export default function AccessLogViewer({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [activeToken, setActiveToken] = useState<string>('__all__');
  const [clearing, setClearing] = useState(false);

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);

    // 카테고리 목록 가져오기
    const { data: bookRows } = await supabase
      .from('diary_books')
      .select('id, title, share_token')
      .order('created_at', { ascending: true });

    if (bookRows) {
      setBooks(bookRows.map((b: Record<string, string>) => ({
        id: b.id,
        title: b.title,
        shareToken: b.share_token,
      })));
    }

    // 로그 쿼리
    let query = supabase
      .from('access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (activeToken !== '__all__') {
      query = query.eq('share_token', activeToken);
    }

    const { data, error } = await query;
    if (!error && data) setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken]);

  const handleClearLogs = async () => {
    if (!supabase) return;
    const target = activeToken === '__all__' ? '전체 접속 로그' : `'${books.find(b => b.shareToken === activeToken)?.title ?? ''}' 카테고리 접속 로그`;
    if (!window.confirm(`${target}를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

    setClearing(true);
    let query = supabase.from('access_logs').delete();
    if (activeToken === '__all__') {
      // 전체 삭제: neq trick (모든 row)
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      query = query.eq('share_token', activeToken);
    }
    const { error } = await query;
    if (error) {
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    } else {
      setLogs([]);
    }
    setClearing(false);
  };

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec}초`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}분 ${s}초`;
  };

  /** device_info에서 [위치] 부분 제거 (기존 데이터 호환) */
  const cleanDeviceInfo = (deviceInfo: string) => {
    // 기존 데이터에 [위치]가 포함된 경우 제거
    const match = deviceInfo?.match(/^(.+?)\s*\[.+\]$/);
    return match ? match[1].trim() : deviceInfo;
  };

  // 집계 통계
  const totalVisits = logs.length;
  const avgDuration = totalVisits > 0
    ? Math.round(logs.reduce((sum, l) => sum + l.duration_sec, 0) / totalVisits)
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 780, padding: 24, width: '95vw' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#44506a' }}>접속 로그</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={fetchData}
              className="icon-button compact"
              title="새로고침"
              style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8 }}
            >
              <RefreshCw size={15} />
            </button>
            <button onClick={onClose} className="icon-button" style={{ background: 'none' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 카테고리(뷰어) 탭 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            onClick={() => setActiveToken('__all__')}
            style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: activeToken === '__all__' ? '#8870d7' : '#f0f0f4',
              color: activeToken === '__all__' ? '#fff' : '#555',
            }}
          >
            전체
          </button>
          {books.map(b => (
            <button
              key={b.shareToken}
              onClick={() => setActiveToken(b.shareToken)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: activeToken === b.shareToken ? '#8870d7' : '#f0f0f4',
                color: activeToken === b.shareToken ? '#fff' : '#555',
              }}
            >
              {b.title || '제목 없음'}
            </button>
          ))}
        </div>

        {/* 요약 통계 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#f5f3ff', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#8870d7' }}>{totalVisits}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>방문 횟수</div>
          </div>
          <div style={{ flex: 1, background: '#fff3f5', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#d76072' }}>{formatDuration(avgDuration)}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>평균 체류 시간</div>
          </div>
        </div>

        {/* 로그 테이블 */}
        {loading ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#888' }}>로딩 중...</p>
        ) : logs.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#888' }}>아직 접속 기록이 없습니다.</p>
        ) : (
          <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '10px 8px', color: '#666' }}>접속 일시</th>
                  <th style={{ padding: '10px 8px', color: '#666' }}>
                    <Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />기기
                  </th>
                  <th style={{ padding: '10px 8px', color: '#666', width: '30%' }}>
                    <Music size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />들은 노래
                  </th>
                  <th style={{ padding: '10px 8px', color: '#666' }}>
                    <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />체류
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}>
                      <td style={{ padding: '10px 8px', color: '#333', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('ko-KR', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#555', whiteSpace: 'nowrap' }}>{cleanDeviceInfo(log.device_info)}</td>
                      <td style={{ padding: '10px 8px', color: '#888', fontSize: 12 }}>
                        {log.listened_songs ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {log.listened_songs.split('\n').map((line, i) => {
                              // "곡제목 - 1분 23초" 형식 파싱
                              const dashIdx = line.lastIndexOf(' - ');
                              if (dashIdx > 0) {
                                const title = line.substring(0, dashIdx);
                                const time = line.substring(dashIdx + 3);
                                return (
                                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                    <span style={{ color: '#555', fontWeight: 500 }}>♪ {title}</span>
                                    <span style={{ color: '#d75a68', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{time}</span>
                                  </div>
                                );
                              }
                              // 기존 쉼표 구분 형식 호환
                              return <span key={i} style={{ color: '#555' }}>{line}</span>;
                            })}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#d75a68', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatDuration(log.duration_sec)}</td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 초기화 버튼 */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleClearLogs}
            disabled={clearing || logs.length === 0}
            className="danger-button"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Trash2 size={14} />
            {clearing ? '삭제 중...' : activeToken === '__all__' ? '전체 로그 초기화' : '이 카테고리 로그 초기화'}
          </button>
        </div>
      </div>
    </div>
  );
}
