// 서비스 워커 (빈 파일이어도 크롬이 PWA로 인식하는 데 필수)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // 네트워크 요청을 가로채지 않고 그대로 통과
  return;
});
