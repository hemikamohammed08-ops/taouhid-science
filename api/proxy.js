// ===== إصلاح جوهري =====
// المشكلة الأصلية: bodyParser الافتراضي لـ Next.js محدود بـ 1MB فقط (لم يكن مُعطَّلاً/مرفوعاً هنا)،
// إضافة إلى أن تحويل الملف إلى Base64 على الواجهة كان يضخّم حجمه ~37%.
// النتيجة: كانت أغلب ملفات PDF الحقيقية (>1MB أصلاً) تُرفض فوراً بخطأ 413
// قبل وصولها حتى لحد Vercel البنيوي الثابت (4.5MB) الذي لا يمكن تجاوزه من الكود إطلاقاً.
//
// الحل: تعطيل bodyParser الخاص بـ Next.js واستقبال الملف كبيانات خام (raw binary)
// بدل JSON+Base64. هذا يلغي الـ 37% overhead ويرفع السقف الفعلي لحجم الملف الأصلي
// من ~3.3MB إلى ~4.3MB (بهامش أمان تحت حد Vercel 4.5MB).
//
// ملاحظة مهمة: حد الـ 4.5MB بنيوي في Vercel ولا يمكن رفعه بأي إعداد. لدعم ملفات
// أكبر (وصولاً لـ 10MB كما تَعِد الواجهة الحالية) يلزم تغيير معماري: رفع مباشر إلى
// تخزين خارجي (Vercel Blob / S3 presigned URL) بدل تمرير الملف عبر Serverless Function.
// إن رغبت بذلك أخبرني وسأجهزه لك.

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var total = 0;
    var MAX_BYTES = 4.3 * 1024 * 1024; // هامش أمان تحت حد Vercel الصارم 4.5MB
    req.on('data', function (chunk) {
      total += chunk.length;
      if (total > MAX_BYTES) {
        reject(Object.assign(new Error('FILE_TOO_LARGE'), { code: 'FILE_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  }
  if (!chatId) {
    return res.status(500).json({ error: 'TELEGRAM_CHAT_ID not set' });
  }

  try {
    const fileName = req.headers['x-file-name']
      ? decodeURIComponent(req.headers['x-file-name'])
      : 'file.pdf';
    const fileType = req.headers['x-file-type'] || 'application/octet-stream';
    const caption = req.headers['x-caption'] ? decodeURIComponent(req.headers['x-caption']) : '';

    let buffer;
    try {
      buffer = await readRawBody(req);
    } catch (readErr) {
      if (readErr && readErr.code === 'FILE_TOO_LARGE') {
        return res.status(413).json({
          error: 'الملف كبير جداً. الحد الأقصى المدعوم حالياً حوالي 4 ميجابايت بسبب قيود الاستضافة.',
        });
      }
      throw readErr;
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'الملف فارغ أو لم يصل بشكل صحيح' });
    }

    const formData = new FormData();
    const blob = new Blob([buffer], { type: fileType });
    formData.append('chat_id', chatId);
    formData.append('document', blob, fileName);
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
