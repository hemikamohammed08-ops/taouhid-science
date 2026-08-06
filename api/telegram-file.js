// api/telegram-file.js
// يُستدعى هكذا: /api/telegram-file?file_id=XXXX
// يكمل proxy.js: proxy.js يرفع الملفات، وهذا الملف يجلبها/يعرضها لاحقًا
// دون أن يظهر أي رابط يحوي التوكن للمتصفح أبدًا.

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const { file_id } = req.query;

  if (!token) return res.status(500).json({ error: 'Server not configured (missing TELEGRAM_BOT_TOKEN)' });
  if (!file_id) return res.status(400).json({ error: 'file_id required' });

  try {
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(file_id)}`
    );
    const getFileData = await getFileRes.json();
    if (!getFileData.ok) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = getFileData.result.file_path;
    const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);

    res.setHeader('Content-Type', fileRes.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Download failed' });
  }
}
