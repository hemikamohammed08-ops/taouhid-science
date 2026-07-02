// api/proxy.js

export default async function handler(req, res) {
  // السماح بـ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { chat_id, caption, file_base64, file_name, file_type } = req.body;

    if (!file_base64) {
      return res.status(400).json({ ok: false, error: 'لا يوجد ملف' });
    }

    const buffer = Buffer.from(file_base64, 'base64');
    const token = '8868951987:AAFYxGJOUxHN6ql-3GsJ3Our01I-7mkMAIk';
    const formData = new FormData();
    formData.append('chat_id', chat_id);
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
