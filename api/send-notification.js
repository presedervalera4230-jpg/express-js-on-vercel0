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
      console.log('📝 Токен получателя (первые 20 символов):', receiverToken ? receiverToken.substring(0, 20) + '...' : 'Нет токена');
      console.log('📝 Текст сообщения:', messageText?.substring(0, 50) + (messageText?.length > 50 ? '...' : ''));
      
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
      console.log('📋 Детали сообщения FCM:', {
        tokenPreview: receiverToken.substring(0, 10) + '...' + receiverToken.substring(receiverToken.length - 5),
        title: message.notification.title,
        bodyPreview: message.notification.body,
        data: message.data
      });
      
      try {
        // Отправляем через Firebase Admin SDK с детальным логированием
        console.log('⏳ Вызываю admin.messaging().send()...');
        const response = await admin.messaging().send(message);
        
        console.log('✅ Уведомление отправлено в FCM!');
        console.log('📦 Ответ FCM:', {
          messageId: response,
          success: true
        });
        
        // Успешный ответ
        return res.json({
          success: true,
          message: 'Уведомление отправлено в FCM!',
          messageId: response,
          debug: {
            sender: senderName || 'Аноним',
            textPreview: messageText.substring(0, 30) + '...',
            timestamp: new Date().toISOString(),
            fcmResponse: response
          }
        });
        
      } catch (firebaseError) {
        // Детальное логирование ошибки Firebase
        console.error('🔥 ОШИБКА FCM (Firebase Cloud Messaging):');
        console.error('🔴 Код ошибки:', firebaseError.code || 'Нет кода');
        console.error('🔴 Сообщение ошибки:', firebaseError.message);
        console.error('🔴 Полный объект ошибки:', firebaseError);
        
        // Разбираем распространённые ошибки FCM
        let errorType = 'UNKNOWN';
        let userMessage = firebaseError.message;
        
        if (firebaseError.code === 'messaging/invalid-registration-token' || 
            firebaseError.code === 'messaging/registration-token-not-registered') {
          errorType = 'INVALID_TOKEN';
          userMessage = 'Токен устройства недействителен или устарел. Нужно получить новый токен.';
        } else if (firebaseError.code === 'messaging/mismatched-credential') {
          errorType = 'WRONG_PROJECT';
          userMessage = 'Ключ Firebase не соответствует проекту. Проверь FIREBASE_SERVICE_ACCOUNT.';
        } else if (firebaseError.code === 'messaging/invalid-argument') {
          errorType = 'INVALID_ARGUMENT';
          userMessage = 'Неверные аргументы в запросе FCM.';
        }
        
        console.error('📊 Тип ошибки определен как:', errorType);
        
        return res.status(500).json({
          success: false,
          error: userMessage,
          errorCode: firebaseError.code || 'UNKNOWN',
          errorType: errorType,
          details: 'Ошибка на стороне Firebase. Проверь токен устройства и ключ сервисного аккаунта.'
        });
      }
      
    } catch (error) {
      console.error('❌ ОШИБКА отправки уведомления (общая):', error);
      console.error('🔴 Стек вызовов:', error.stack);
      
      return res.status(500).json({
        success: false,
        error: error.message,
        code: error.code || 'UNKNOWN',
        details: 'Общая ошибка сервера. Проверь логи на Vercel.'
      });
    }
  }
  
  // Если метод не поддерживается
  return res.status(405).json({
    success: false,
    error: 'Метод не поддерживается. Используй GET или POST'
  });
};
