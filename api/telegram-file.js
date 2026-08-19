// إعدادات مهمة: تعطيل حد الاستجابة الداخلي لـ Next.js (لا يلغي حد Vercel، لكنه ضروري)
// ورفع مدة التنفيذ للملفات الكبيرة/الاتصال البطيء (متاح على Pro، وعلى Hobby الحد الأقصى 60 ثانية أيضاً منذ التحديثات الأخيرة - تحقق من خطتك)
export const config = {
  api: {
    responseLimit: false,
  },
};

export const maxDuration = 30;

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const { file_id, filename, dl } = req.query;
  const disposition = dl === '1' ? 'attachment' : 'inline';
  if (!token) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  }
  if (!file_id) {
    return res.status(400).json({ error: 'file_id is required' });
  }
  try {
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(file_id)}`
    );
    const getFileData = await getFileRes.json();
    if (!getFileData.ok) {
      return res.status(404).json({ error: 'File not found', details: getFileData.description || null });
    }
    const filePath = getFileData.result.file_path || '';
    const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!fileRes.ok || !fileRes.body) {
      return res.status(502).json({ error: 'Failed to fetch file from Telegram' });
    }

    // --- خريطة الامتداد -> نوع المحتوى ---
    const extToType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.heic': 'image/heic',
      '.pdf': 'application/pdf',
    };

    const extMatch = filePath.match(/\.[a-zA-Z0-9]+$/);
    const extLower = extMatch ? extMatch[0].toLowerCase() : '';

    const telegramContentType = (fileRes.headers.get('content-type') || '')
      .toLowerCase()
      .split(';')[0]
      .trim();

    let contentType = null;
    if (
      telegramContentType &&
      (telegramContentType.startsWith('image/') || telegramContentType === 'application/pdf')
    ) {
      contentType = telegramContentType;
    }
    if (!contentType && extLower && extToType[extLower]) {
      contentType = extToType[extLower];
    }
    if (!contentType) {
      contentType = 'application/octet-stream';
    }

    let ext = extLower;
    if (!ext) {
      const typeToExt = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/bmp': '.bmp',
        'image/heic': '.heic',
        'application/pdf': '.pdf',
      };
      ext = typeToExt[contentType] || '';
    }

    // --- بناء اسم الملف مع الامتداد ---
    let rawName = filename && String(filename).trim() ? String(filename).trim() : 'file' + ext;
    if (ext && !rawName.toLowerCase().endsWith(ext.toLowerCase())) {
      rawName += ext;
    }
    rawName = rawName.replace(/["\r\n]/g, '');

    let asciiFallback = rawName.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_').trim();
    if (!asciiFallback || asciiFallback === ext) asciiFallback = 'file' + ext;
    if (ext && !asciiFallback.toLowerCase().endsWith(ext.toLowerCase())) {
      asciiFallback += ext;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(rawName)}`
    );

    // مرّر طول المحتوى إن كان متوفراً من تيليجرام (يساعد المتصفح/pdf.js على معرفة التقدم)
    const contentLength = fileRes.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // ===== الإصلاح الجوهري: بث الملف مباشرة بدل تجميعه في Buffer =====
    // تجميع الملف بالكامل في الذاكرة قبل الإرسال (buffer.send) يجعل الاستجابة
    // "غير مبثوثة" فيصطدم بحد Vercel الصارم 4.5MB على أي رد. البث المباشر
    // (streaming) هو الحل الرسمي الذي توصي به Vercel لتفادي هذا الحد.
    const { Readable } = await import('node:stream');
    const nodeStream = Readable.fromWeb(fileRes.body);

    nodeStream.on('error', (streamErr) => {
      console.error('telegram-file stream error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      } else {
        res.end();
      }
    });

    nodeStream.pipe(res);
  } catch (err) {
    console.error('telegram-file error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.end();
  }
}
