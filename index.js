const express = require('express');
const app = express();
app.use(express.json());

// CORS：只允許九宮姓名網站呼叫
app.use((req, res, next) => {
  const allowed = ['https://jblin0213.github.io', 'http://localhost'];
  const origin = req.headers.origin || '';
  if (allowed.some(o => origin.startsWith(o))) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/api/celeb', async (req, res) => {
  const { name } = req.body || {};
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: '請提供名字' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'API 未設定' });
  }

  try {
    const prompt = `請查詢「${name.trim()}」的個人資料（名人、藝人、運動員、政治人物等皆可）。
只回傳 JSON，不要任何其他文字、不要 markdown 格式。
格式如下：
{
  "found": true,
  "current_name": "現用名或藝名",
  "birth_name": "本名（若與現用名相同則填相同）",
  "name_changed": false,
  "name_change_year": null,
  "name_change_age": null,
  "birth_year": 西元年數字,
  "birth_month": 月份數字,
  "birth_day": 日期數字,
  "note": "簡短備註，例如改名原因或本名說明"
}
若找不到此人，found 設 false，其他欄位填 null。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'Claude API 錯誤', detail: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // 嘗試解析 JSON
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(502).json({ error: '解析失敗', raw: text });
    }

    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`celeb-api running on port ${PORT}`));
