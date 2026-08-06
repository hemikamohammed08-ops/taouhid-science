// api/proxy.js
// التوكن يُقرأ الآن من متغير بيئة على Vercel (Settings → Environment Variables)
// ولم يعد مكتوبًا في الكود إطلاقًا — لا يظهر أبدًا في GitHub أو للمتصفح.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    return res.status(500).json({ ok: false, error: 'Server not configured (missing TELEGRAM_BOT_TOKEN)' });
  }

  try {
    const { chat_id, caption, file_base64, file_name, file_type } = req.body;

    if (!file_base64) {
      return res.status(400).json({ ok: false, error: 'لا يوجد ملف' });
    }

    const buffer = Buffer.from(file_base64, 'base64');
    const formData = new FormData();
    formData.append('chat_id', chat_id || defaultChatId);
    formData.append('caption', caption || '📚 منصة الأستاذ محمد للتعليم');
    formData.append('document', new Blob([buffer], { type: file_type || 'application/octet-stream' }), file_name || 'file.pdf');

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    return res.status(200).json(result);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
