import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AccessLog } from '../types';
import { X, Clock, Smartphone } from 'lucide-react';

export default function AccessLogViewer({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setLogs(data);
      }
      setLoading(false);
    }
    fetchLogs();
  }, []);

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec}초`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}분 ${s}초`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 600, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#44506a' }}>접속 로그 (최근 100건)</h2>
          <button onClick={onClose} className="icon-button" style={{ background: 'none' }}><X size={20} /></button>
        </div>
        
        {loading ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#888' }}>로딩 중...</p>
        ) : logs.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#888' }}>아직 접속 기록이 없습니다.</p>
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '10px 8px', color: '#666' }}>접속 일시</th>
                  <th style={{ padding: '10px 8px', color: '#666' }}><Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }}/>기기 정보</th>
                  <th style={{ padding: '10px 8px', color: '#666' }}><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }}/>체류 시간</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 8px', color: '#333' }}>
                      {new Date(log.created_at).toLocaleString('ko-KR', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#555' }}>{log.device_info}</td>
                    <td style={{ padding: '10px 8px', color: '#d75a68', fontWeight: 600 }}>{formatDuration(log.duration_sec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
