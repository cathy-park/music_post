/** 간단한 User-Agent 파서 */
export function parseUserAgent(ua: string): string {
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) {
    // iPhone/iPad/Mac 구분
    if (/iPhone/i.test(ua)) os = 'iPhone';
    else if (/iPad/i.test(ua)) os = 'iPad';
    else os = 'Mac';
  }
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/KAKAOTALK/i.test(ua)) browser = 'KakaoTalk';
  else if (/Instagram/i.test(ua)) browser = 'Instagram';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Whale/i.test(ua)) browser = 'Whale';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  return `${os} - ${browser}`;
}
