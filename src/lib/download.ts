import { getAudioFileFromIdb } from './idb';

function stripID3(buffer: ArrayBuffer): ArrayBuffer {
  const view = new DataView(buffer);
  let offset = 0;
  
  if (view.byteLength > 10 && view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
    const size = (view.getUint8(6) << 21) | (view.getUint8(7) << 14) | (view.getUint8(8) << 7) | view.getUint8(9);
    offset = 10 + size;
    if ((view.getUint8(5) & 0x10) !== 0) {
      offset += 10;
    }
  }

  let endOffset = view.byteLength;
  if (endOffset >= offset + 128) {
    const v1Index = endOffset - 128;
    if (view.getUint8(v1Index) === 0x54 && view.getUint8(v1Index+1) === 0x41 && view.getUint8(v1Index+2) === 0x47) {
      endOffset -= 128;
    }
  }

  if (endOffset >= offset + 32) {
    const apeIndex = endOffset - 32;
    if (view.getUint8(apeIndex) === 0x41 && view.getUint8(apeIndex+1) === 0x50 && view.getUint8(apeIndex+2) === 0x45) {
      endOffset -= 32;
    }
  }
  
  return buffer.slice(offset, endOffset);
}

export async function downloadStrippedAudio(url: string, title: string) {
  let buffer: ArrayBuffer;
  
  if (url.startsWith('idb://')) {
    const file = await getAudioFileFromIdb(url);
    if (!file) throw new Error('파일을 찾을 수 없습니다.');
    buffer = await file.arrayBuffer();
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error('파일 다운로드 실패');
    buffer = await res.arrayBuffer();
  }
  
  const cleanBuffer = stripID3(buffer);
  const blob = new Blob([cleanBuffer], { type: 'audio/mpeg' });
  const objectUrl = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = objectUrl;
  // 파일명에 불필요한 특수문자가 들어가지 않도록 정제
  const safeTitle = title.replace(/[^a-z0-9가-힣_-]/gi, ' ').trim();
  a.download = `${safeTitle || 'audio'}.mp3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
