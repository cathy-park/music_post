// 뷰어 토큰에 따라 동적으로 PWA manifest 반환
export default function handler(req, res) {
  const { token, title } = req.query;

  const appName = title ? decodeURIComponent(title) : '음악일기';
  const startUrl = token ? `/v/${token}` : '/';

  const manifest = {
    name: appName,
    short_name: appName,
    description: '100일을 기념해 만든 비공개 음악일기',
    start_url: startUrl,
    display: 'standalone',
    background_color: '#fffaf7',
    theme_color: '#f7c8d0',
    icons: [
      { src: '/favicon-32.png',       sizes: '32x32',   type: 'image/png' },
      { src: '/icon-192.png',          sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=0');
  res.status(200).json(manifest);
}
