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

// صفحة خطأ HTML بسيطة تُعرض داخل <img>/<iframe> بدل ترك المتصفح يحاول تفسير
// استجابة فاشلة على أنها صورة أو PDF (وهو ما كان يسبب "صورة معطوبة" أو
// "Aucun aperçu disponible" بصمت دون أي رسالة توضح السبب الحقيقي للمستخدم).
function sendErrorPage(res, status, title, message) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(
    `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">` +
    `<style>body{font-family:sans-serif;background:#f5f5f5;color:#333;display:flex;` +
    `align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}` +
    `.box{background:#fff;border-radius:12px;padding:24px 32px;box-shadow:0 2px 10px rgba(0,0,0,.1)}` +
    `h2{color:#dc2626;margin:0 0 8px}p{color:#666;margin:0}</style></head>` +
    `<body><div class="box"><h2>${title}</h2><p>${message}</p></div></body></html>`
  );
}

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const { file_id, filename, dl } = req.query;

  // dl=1 يعني طلب تحميل صريح (زر "تحميل") -> attachment.
  // بدونها الطلب للعرض داخل الصفحة (<img>, عارض PDF) -> inline، وإلا يرفض
  // المتصفح عرض المحتوى ويحاول تنزيله بدل إظهاره.
  const disposition = dl ? 'attachment' : 'inline';

  if (!token) return sendErrorPage(res, 500, '⚠️ خطأ في إعداد الخادم', 'لم يتم ضبط TELEGRAM_BOT_TOKEN.');
  if (!file_id) return sendErrorPage(res, 400, '⚠️ طلب غير صالح', 'المعرّف (file_id) مفقود.');

  try {
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(file_id)}`
    );
    const getFileData = await getFileRes.json();

    if (!getFileData.ok) {
      // أشهر سبب لفشل هذه الخطوة تحديدًا هو أن حجم الملف تجاوز حد تيليجرام
      // الصارم (20 ميجابايت) لجلب الملفات عبر البوت — قيد من تيليجرام نفسه
      // لا يمكن تجاوزه، لذا نوضحه صراحة للمستخدم بدل رسالة عامة غامضة.
      const desc = (getFileData.description || '').toLowerCase();
      if (desc.includes('too big') || desc.includes('file is too big')) {
        return sendErrorPage(
          res, 413, '⚠️ الملف كبير جدًا',
          'هذا الملف يتجاوز 20 ميجابايت، وهو الحد الأقصى الذي يسمح تيليجرام بجلبه عبر البوت. الرجاء ضغط الملف أو رفعه بحجم أصغر.'
        );
      }
      return sendErrorPage(res, 404, '⚠️ الملف غير موجود', 'تعذر العثور على هذا الملف على تيليجرام (قد يكون حُذف أو المعرّف غير صحيح).');
    }

    const filePath = getFileData.result.file_path || '';
    const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);

    // فحص أساسي كان مفقودًا سابقًا: كان الكود يرسل استجابة 200 ناجحة حتى لو
    // فشل هذا الطلب فعليًا (شبكة بطيئة، خطأ مؤقت من تيليجرام...)، فيصل
    // للمتصفح محتوى فارغ/تالف مع ترويسة Content-Type تدّعي أنه صورة أو PDF
    // سليم — وهو ما يفسر الصور المعطوبة وملفات PDF التي لا تُعرض.
    if (!fileRes.ok) {
      return sendErrorPage(
        res, 502, '⚠️ تعذر جلب الملف',
        'حدث خطأ أثناء تحميل الملف من خوادم تيليجرام. الرجاء إعادة المحاولة خلال لحظات.'
      );
    }

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
      `${disposition}; filename="${baseName}"; filename*=UTF-8''${encodeURIComponent(baseName)}`
    );

    const buffer = Buffer.from(await fileRes.arrayBuffer());

    // فحص إضافي: إن وصل محتوى فارغ فعليًا رغم نجاح الطلبين، لا نرسله على أنه
    // ملف سليم، بل نوضح المشكلة بدل ترك المتصفح يعرض صورة/PDF فارغ صامت.
    if (!buffer || buffer.length === 0) {
      return sendErrorPage(res, 502, '⚠️ الملف فارغ', 'وصل محتوى فارغ من تيليجرام. الرجاء إعادة المحاولة.');
    }

    return res.status(200).send(buffer);
  } catch (err) {
    console.error('telegram-file error:', err);
    return sendErrorPage(res, 500, '⚠️ خطأ غير متوقع', 'حدث خطأ أثناء معالجة الملف. الرجاء إعادة المحاولة.');
  }
}
