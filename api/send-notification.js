const admin = require('firebase-admin');

// Инициализация Firebase
let firebaseApp = null;

function initFirebase() {
  if (firebaseApp) return true;
  
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    
    if (!serviceAccount.project_id) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT не настроен');
      return false;
    }
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('✅ Firebase подключен');
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка Firebase:', error.message);
    return false;
  }
}

// Главный обработчик
module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Предварительный запрос
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Тестовый GET запрос
  if (req.method === 'GET') {
    const firebaseStatus = initFirebase() ? '✅ Подключен' : '❌ Нет ключа';
    
    return res.json({
      success: true,
      message: '🚀 Сервер для уведомлений работает!',
      timestamp: new Date().toISOString(),
      firebase: firebaseStatus,
      instructions: 'Отправь POST запрос с receiverToken, senderName, messageText'
    });
  }
  
  // Основной POST запрос
  if (req.method === 'POST') {
    try {
      if (!initFirebase()) {
        return res.status(500).json({
          success: false,
          error: 'Firebase не настроен. Добавь FIREBASE_SERVICE_ACCOUNT в Vercel Environment Variables'
        });
      }
      
      const { receiverToken, senderName, messageText, senderId, chatId } = req.body;
      
      if (!receiverToken) {
        return res.status(400).json({
          success: false,
          error: 'Нет receiverToken (токен устройства)'
        });
      }
      
      console.log('📨 Отправляю уведомление от:', senderName || 'Аноним');
      
      // СОЗДАЕМ УВЕДОМЛЕНИЕ
      const message = {
        token: receiverToken,
        notification: {
          title: senderName || 'Новое сообщение',
          body: messageText?.length > 100 
            ? messageText.substring(0, 100) + '...' 
            : messageText || 'Новое сообщение'
        },
        data: {
          senderId: senderId || '',
          chatId: chatId || '',
          type: 'new_message',
          timestamp: Date.now().toString()
        },
        android: {
          priority: 'high'
        }
      };
      
      // ОТПРАВЛЯЕМ
      const response = await admin.messaging().send(message);
      
      console.log('✅ Уведомление отправлено! ID:', response);
      
      return res.json({
        success: true,
        message: 'Уведомление отправлено!',
        messageId: response
      });
      
    } catch (error) {
      console.error('❌ Ошибка:', error);
      
      return res.status(500).json({
        success: false,
        error: error.message,
        code: error.code || 'UNKNOWN'
      });
    }
  }
  
  // Если метод не поддерживается
  return res.status(405).json({
    success: false,
    error: 'Метод не поддерживается. Используй GET или POST'
  });
};
