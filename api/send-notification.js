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
    console.log('✅ Firebase Admin SDK подключен. Project ID:', serviceAccount.project_id);
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
    console.log('📨📨📨 НОВЫЙ ЗАПРОС НА УВЕДОМЛЕНИЕ 📨📨📨');
    console.log('📅 Время:', new Date().toISOString());
    
    try {
      // Проверяем Firebase
      if (!initFirebase()) {
        return res.status(500).json({
          success: false,
          error: 'Firebase не настроен'
        });
      }
      
      // Получаем данные из запроса
      const { receiverToken, senderName, messageText, senderId, chatId } = req.body;
      
      console.log('🔍 ДАННЫЕ ИЗ ЗАПРОСА:');
      console.log('👤 Отправитель:', senderName || 'Не указан');
      console.log('📝 Текст сообщения:', messageText || 'Нет текста');
      console.log('🔑 senderId:', senderId || 'Нет ID отправителя');
      console.log('💬 chatId:', chatId || 'Нет ID чата');
      console.log('🔑 Токен получателя:', receiverToken ? `Длина: ${receiverToken.length} символов` : 'НЕТ ТОКЕНА!');
      
      // Валидация
      if (!receiverToken) {
        console.error('❌ ОШИБКА: receiverToken отсутствует');
        return res.status(400).json({
          success: false,
          error: 'Нет receiverToken (токен устройства получателя)'
        });
      }
      
      if (!messageText) {
        console.error('❌ ОШИБКА: messageText отсутствует');
        return res.status(400).json({
          success: false,
          error: 'Нет текста сообщения'
        });
      }
      
      // Проверяем длину токена
      if (receiverToken.length < 100) {
        console.error(`⚠️ ПРЕДУПРЕЖДЕНИЕ: Токен слишком короткий (${receiverToken.length} символов). Должно быть ~152+`);
      }
      
      // ================ РЕАЛЬНОЕ СООБЩЕНИЕ ================
      console.log('🚀 Отправляю РЕАЛЬНОЕ сообщение с текстом из запроса...');
      
      // Обрезаем слишком длинные сообщения для уведомления
      const notificationBody = messageText.length > 100 
        ? messageText.substring(0, 100) + '...' 
        : messageText;
      
      const actualMessage = {
        token: receiverToken.trim(),
        notification: {
          title: senderName || 'Новое сообщение',
          body: notificationBody
        },
        data: {
          // ОБЯЗАТЕЛЬНЫЕ данные для открытия чата
          senderId: senderId || '',
          chatId: chatId || '',
          fromNotification: 'true',
          messageText: messageText || '',
          senderName: senderName || '',
          // Для Android - action при клике
          click_action: 'OPEN_CHAT_ACTION'
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'messages',
            sound: 'default',
            priority: 'max',
            icon: 'ic_notification',
            color: '#FF4081'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        },
        // Добавляем webpush для совместимости
        webpush: {
          headers: {
            Urgency: 'high'
          }
        }
      };
      
      console.log('📤 Сообщение для отправки:');
      console.log(JSON.stringify({
        token: actualMessage.token.substring(0, 20) + '...',
        notification: actualMessage.notification,
        data: actualMessage.data
      }, null, 2));
      
      try {
        const response = await admin.messaging().send(actualMessage);
        console.log('✅✅✅ РЕАЛЬНОЕ сообщение успешно отправлено!');
        console.log('📦 Message ID:', response);
        
        return res.json({
          success: true,
          message: 'Уведомление с реальным текстом отправлено!',
          messageId: response,
          dataSent: {
            title: actualMessage.notification.title,
            body: actualMessage.notification.body,
            senderId: senderId,
            chatId: chatId
          },
          debug: {
            tokenLength: receiverToken.length,
            timestamp: new Date().toISOString()
          }
        });
        
      } catch (error) {
        console.error('❌❌❌ ОШИБКА отправки реального сообщения');
        console.error('🔴 Код ошибки:', error.code);
        console.error('🔴 Сообщение:', error.message);
        console.error('🔴 Детали:', error.details);
        
        // ================ РЕЗЕРВНЫЙ ВАРИАНТ ================
        console.log('🔄 Пробую отправить УПРОЩЕННОЕ сообщение...');
        
        try {
          // Упрощенное сообщение (без дополнительных параметров)
          const fallbackMessage = {
            token: receiverToken.trim(),
            notification: {
              title: senderName || 'Новое сообщение',
              body: notificationBody
            },
            data: {
              senderId: senderId || '',
              chatId: chatId || ''
            }
          };
          
          const fallbackResponse = await admin.messaging().send(fallbackMessage);
          console.log('✅ Упрощенное сообщение отправлено!');
          
          return res.json({
            success: true,
            message: 'Уведомление отправлено (упрощенное)',
            fallback: true,
            messageId: fallbackResponse
          });
          
        } catch (fallbackError) {
          console.error('❌ ОШИБКА упрощенного сообщения тоже:');
          console.error(fallbackError.message);
          
          return res.status(500).json({
            success: false,
            error: 'Ошибка FCM: ' + error.message,
            fallbackError: fallbackError.message,
            debug: {
              tokenLength: receiverToken.length,
              errorCode: error.code,
              suggestions: [
                'Проверь FCM токен в Firestore',
                'Убедись что токен действительный',
                'Проверь права доступа Firebase'
              ]
            }
          });
        }
      }
      
    } catch (error) {
      console.error('❌ ОШИБКА сервера:', error);
      console.error('🔴 Стек вызовов:', error.stack);
      
      return res.status(500).json({
        success: false,
        error: 'Серверная ошибка: ' + error.message,
        code: 'SERVER_ERROR'
      });
    }
  }
  
  // Если метод не поддерживается
  return res.status(405).json({
    success: false,
    error: 'Метод не поддерживается. Используй GET или POST'
  });
};
