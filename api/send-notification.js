module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method === 'GET') {
    return res.json({
      success: true,
      message: '🚀 Сервер для уведомлений работает!',
      timestamp: new Date().toISOString(),
      instruction: 'Отправь POST запрос для теста уведомлений'
    });
  }
  
  // ... (сюда позже добавим код для работы с Firebase)
};
