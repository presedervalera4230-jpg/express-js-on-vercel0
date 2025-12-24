const admin = require('firebase-admin');

// Инициализация Firebase
let isFirebaseInitialized = false;

function initFirebase() {
  if (isFirebaseInitialized) return true;
  
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT не настроен в Environment Variables');
      return false;
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    isFirebaseInitialized = true;
    console.log('✅ Firebase Admin SDK подключен');
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка инициализации Firebase:', error.message);
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
      instruction: 'Отправь POST запрос с receiverToken, senderName, messageText'
    });
  }
  
  // Основной POST запрос
  if (req.method === 'POST') {
    try {
      // Проверяем Firebase
      if (!initFirebase()) {
        return res.status(500).json({
          success: false,
          error: 'Firebase не настроен. Проверь FIREBASE_SERVICE_ACCOUNT в настройках Vercel'
        });
      }
      
      // Получаем данные из запроса
      const { receiverToken, senderName, messageText, senderId, chatId } = req.body;
      
      console.log('📨 Получен запрос на уведомление от:', senderName || 'Аноним');
      
      // Валидация
      if (!receiverToken) {
        return res.status(400).json({
          success: false,
          error: 'Нет receiverToken (токен устройства получателя)'
        });
      }
      
      if (!messageText) {
        return res.status(400).json({
          success: false,
          error: 'Нет текста сообщения'
        });
      }
      
      // Создаем FCM сообщение
      const message = {
        token: receiverToken,
        notification: {
          title: senderName || 'Новое сообщение',
          body: messageText.length > 100 
            ? messageText.substring(0, 100) + '...' 
            : messageText,
          sound: 'default'
        },
        data: {
          title: senderName || 'Новое сообщение',
          body: messageText,
          senderId: senderId || '',
          chatId: chatId || '',
          type: 'new_message',
          timestamp: Date.now().toString(),
          click_action: 'OPEN_CHAT_ACTION'
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'messenger_channel',
            sound: 'default',
            icon: 'ic_notification',
            color: '#2196F3'
          }
        }
      };
      
      console.log('🚀 Отправляю FCM сообщение...');
      
      // Отправляем через Firebase Admin SDK
      const response = await admin.messaging().send(message);
      
      console.log('✅ Уведомление отправлено! ID:', response);
      
      // Успешный ответ
      return res.json({
        success: true,
        message: 'Уведомление отправлено!',
        messageId: response,
        debug: {
          sender: senderName || 'Аноним',
          textPreview: messageText.substring(0, 30) + '...',
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ ОШИБКА отправки уведомления:', error);
      
      return res.status(500).json({
        success: false,
        error: error.message,
        code: error.code || 'UNKNOWN',
        details: 'Проверь: 1) FIREBASE_SERVICE_ACCOUNT, 2) токен устройства, 3) интернет'
      });
    }
  }
  
  // Если метод не поддерживается
  return res.status(405).json({
    success: false,
    error: 'Метод не поддерживается. Используй GET или POST'
  });
};
