export default async function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const baseUrl = `${protocol}://${host}`;
  const token = req.query.token;

  let html = '';
  try {
    const htmlRes = await fetch(`${baseUrl}/index.html`);
    html = await htmlRes.text();
  } catch (e) {
    console.error('Error fetching index.html:', e);
    html = '<!DOCTYPE html><html><head><title>우리의 작은 세계</title></head><body><p>Loading...</p></body></html>';
  }

  try {
    if (token) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        // We use fetch directly to avoid commonjs/esm module issues with supabase in serverless functions if any.
        const resBook = await fetch(`${supabaseUrl}/rest/v1/diary_books?share_token=eq.${token}&select=title,subtitle`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        
        if (resBook.ok) {
          const data = await resBook.json();
          if (data && data.length > 0 && data[0].title) {
            const title = data[0].title;
            const subtitle = data[0].subtitle || "우리만의 음악일기를 확인해보세요.";
            html = html.replace('<title>우리의 작은 세계</title>', `<title>${title}</title>`);
            
            const ogTags = `
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${subtitle}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${subtitle}" />
            `;
            html = html.replace('</head>', `${ogTags}\n</head>`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching book:', err);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
