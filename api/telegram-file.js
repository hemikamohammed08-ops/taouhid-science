export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const { file_id, filename } = req.query;

  if (!token) {
    return res.status(500).json({ error: 'Bot token not configured' });
  }

  try {
    const getFile = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${file_id}`
    );
    const data = await getFile.json();
    
    const filePath = data.result.file_path;
    const file = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename || 'file.pdf'}"`);
    res.send(buffer);
    
  } catch(err) {
    res.status(500).json({ error: 'Failed to fetch file' });
  }
}
