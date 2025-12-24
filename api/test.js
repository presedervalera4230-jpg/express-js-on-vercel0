module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.json({
    success: true,
    message: '✅ Тестовый endpoint работает!',
    serverTime: new Date().toISOString(),
    endpoints: {
      main: 'POST /api/send-notification',
      test: 'GET /api/test'
    }
  });
};
