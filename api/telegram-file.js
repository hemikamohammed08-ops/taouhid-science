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
      return res.status(404).json({ error: 'File not found' });
    }
    const filePath = getFileData.result.file_path || '';
    const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!fileRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch file' });
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    let contentType = 'application/pdf';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (filePath.endsWith('.png')) contentType = 'image/png';
    else if (filePath.endsWith('.gif')) contentType = 'image/gif';
    else if (filePath.endsWith('.pdf')) contentType = 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // --- استخراج الامتداد الصحيح من مسار تيليجرام (وليس من اسم الدرس) ---
    var extMatch = filePath.match(/\.[a-zA-Z0-9]+$/);
    var ext = extMatch ? extMatch[0] : (contentType === 'application/pdf' ? '.pdf' : '');

    // --- الاسم الأصلي (قد يحتوي عربية) مع ضمان وجود الامتداد ---
    var rawName = (filename && String(filename).trim()) ? String(filename).trim() : ('file' + ext);
    if (ext && !rawName.toLowerCase().endsWith(ext.toLowerCase())) {
      rawName += ext;
    }
    // إزالة أي علامات اقتباس قد تكسر رأس الـ HTTP
    rawName = rawName.replace(/["\r\n]/g, '');

    // --- اسم احتياطي بالإنجليزية فقط (للمتصفحات القديمة التي لا تدعم filename*) ---
    var asciiFallback = rawName.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_').trim();
    if (!asciiFallback || asciiFallback === ext) asciiFallback = 'file' + ext;
    if (ext && !asciiFallback.toLowerCase().endsWith(ext.toLowerCase())) {
      asciiFallback += ext;
    }

    // المتصفحات الحديثة تعتمد على filename* (وتحافظ على الاسم العربي كاملاً)
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(rawName)}`
    );
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('telegram-file error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
