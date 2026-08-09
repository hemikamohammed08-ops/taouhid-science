// api/telegram-file.js
// يُستدعى هكذا: /api/telegram-file?file_id=XXXX&filename=اسم-اختياري
// يكمل proxy.js: proxy.js يرفع الملفات، وهذا الملف يجلبها/يعرضها لاحقًا
// دون أن يظهر أي رابط يحوي التوكن للمتصفح أبدًا.

// امتدادات شائعة إلى أنواع MIME، تُستخدم فقط إذا لم يرسل تيليجرام Content-Type صالح
const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', rar: 'application/vnd.rar',
  mp4: 'video/mp4', mp3: 'audio/mpeg', txt: 'text/plain'
};

// يزيل أي أحرف قد تكسر ترويسة Content-Disposition أو غير مسموحة في أسماء الملفات
function sanitizeFilename(name) {
  return name.replace(/["\\\r\n]/g, '').replace(/[\\/:*?<>|]/g, '_').trim();
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const { file_id, filename } = req.query;

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

    const filePath = getFileData.result.file_path || '';
    const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);

    // استخراج الامتداد من مسار تيليجرام (مثال: "photos/file_12.jpg" -> "jpg")
    const extMatch = filePath.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';

    // بناء اسم الملف: نفضّل الاسم المُمرر من الواجهة (مثلاً عنوان الدرس)، وإلا اسم عام
    let baseName = filename ? sanitizeFilename(decodeURIComponent(filename)) : '';
    if (!baseName) baseName = 'file_' + file_id.slice(-8);
    if (ext && !baseName.toLowerCase().endsWith('.' + ext)) baseName += '.' + ext;

    const contentType = fileRes.headers.get('content-type') || MIME_MAP[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // filename للمتصفحات القديمة + filename* (RFC 5987) لدعم الأحرف العربية بشكل صحيح
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseName}"; filename*=UTF-8''${encodeURIComponent(baseName)}`
    );

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Download failed' });
  }
}
