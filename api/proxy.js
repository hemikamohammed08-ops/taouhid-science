export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID; // ✅ إضافة قراءة chat_id من متغيرات البيئة

  if (!token) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  }
  if (!chatId) {
    return res.status(500).json({ error: 'TELEGRAM_CHAT_ID not set' }); // ✅ رسالة واضحة إن كان مفقودًا
  }

  try {
    const { caption, file_base64, file_name, file_type } = req.body;
    if (!file_base64) {
      return res.status(400).json({ error: 'file_base64 is required' });
    }
    const buffer = Buffer.from(file_base64, 'base64');
    const formData = new FormData();
    const blob = new Blob([buffer], { type: file_type || 'application/octet-stream' });

    formData.append('chat_id', chatId); // ✅ هذا هو السطر الناقص — بدونه Telegram يرفض الطلب
    formData.append('document', blob, file_name || 'file.pdf');
    if (caption) formData.append('caption', caption);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!data.ok) {
      return res.status(500).json({ error: data.description || 'Telegram API error' });
    }
    return res.status(200).json({ ok: true, result: data.result });
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
