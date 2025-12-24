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

// Функция для детального логирования ошибок Firebase
function logFirebaseErrorDetailed(error) {
  console.error('🔥🔥🔥 ПОЛНАЯ ОШИБКА FCM 🔥🔥🔥');
  console.error('🔴 Код ошибки:', error.code || 'Нет кода');
  console.error('🔴 Сообщение ошибки:', error.message);
  console.error('🔴 Детали ошибки:', error.details || 'Нет деталей');
  console.error('🔴 Имя ошибки:', error.errorInfo?.code || 'Неизвестно');
  console.error('🔴 HTTP код:', error.errorInfo?.status || 'Неизвестно');
  
  // Выводим всё что есть в ошибке
  console.error('🔴 Весь объект ошибки:');
  console.error(JSON.stringify(error, null, 2));
  
  // Проверяем специфические ошибки
  if (error.code && error.code.includes('invalid-argument')) {
    console.error('⚠️ ВОЗМОЖНЫЕ ПРИЧИНЫ INVALID_ARGUMENT:');
    console.error('1. Неверный формат FCM токена (должен быть ~152 символа)');
    console.error('2. Токен пустой или null');
    console.error('3. Неправильная структура сообщения FCM');
    console.error('4. Отсутствуют обязательные поля в сообщении');
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
    console.log('📦 Тело запроса:', JSON.stringify(req.body, null, 2));
    
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
      
      console.log('🔍 АНАЛИЗ ДАННЫХ:');
      console.log('👤 Отправитель:', senderName || 'Не указан');
      console.log('📝 Текст:', messageText || 'Нет текста');
      console.log('🔑 Токен:', receiverToken ? `Длина: ${receiverToken.length} символов` : 'НЕТ ТОКЕНА!');
      console.log('🔑 Начало токена:', receiverToken ? receiverToken.substring(0, 20) + '...' : 'Нет токена');
      console.log('🔑 Конец токена:', receiverToken && receiverToken.length > 20 ? 
        '...' + receiverToken.substring(receiverToken.length - 20) : 'Нет токена');
      
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
      
      // ТЕСТ 1: Упрощенное сообщение (минимальное)
      console.log('🧪 ТЕСТ 1: Отправка УПРОЩЕННОГО сообщения...');
      const simpleMessage = {
        token: receiverToken.trim(), // удаляем пробелы по краям
        notification: {
          title: senderName || 'Тест',
          body: 'Тестовое уведомление'
        }
      };
      
      console.log('📤 Упрощенное сообщение для отправки:');
      console.log(JSON.stringify(simpleMessage, null, 2));
      
      try {
        const simpleResponse = await admin.messaging().send(simpleMessage);
        console.log('✅✅✅ ТЕСТ 1 УСПЕШЕН! Упрощенное сообщение отправлено!');
        console.log('📦 Ответ FCM:', simpleResponse);
        
        return res.json({
          success: true,
          message: 'Тестовое уведомление отправлено!',
          test: 'simple',
          messageId: simpleResponse,
          debug: {
            tokenLength: receiverToken.length,
            tokenPreview: receiverToken.substring(0, 10) + '...' + receiverToken.substring(receiverToken.length - 10)
          }
        });
        
      } catch (simpleError) {
        console.error('❌❌❌ ТЕСТ 1 ПРОВАЛЕН с упрощенным сообщением');
        logFirebaseErrorDetailed(simpleError);
        
        // ТЕСТ 2: Еще более простое сообщение
        console.log('🧪 ТЕСТ 2: Пробуем САМОЕ ПРОСТОЕ сообщение...');
        const minimalMessage = {
          token: receiverToken.trim(),
          data: {
            test: 'true'
          }
        };
        
        try {
          const minimalResponse = await admin.messaging().send(minimalMessage);
          console.log('✅✅✅ ТЕСТ 2 УСПЕШЕН! Data-only сообщение отправлено!');
          
          return res.json({
            success: true,
            message: 'Data-only уведомление отправлено',
            test: 'minimal',
            messageId: minimalResponse
          });
          
        } catch (minimalError) {
          console.error('❌❌❌ ТЕСТ 2 ПРОВАЛЕН с data-only сообщением');
          logFirebaseErrorDetailed(minimalError);
          
          // Возвращаем детальную ошибку
          return res.status(500).json({
            success: false,
            error: 'Ошибка FCM: ' + minimalError.message,
            errorCode: minimalError.code || 'UNKNOWN',
            errorDetails: minimalError.details || 'Нет деталей',
            debug: {
              tokenLength: receiverToken.length,
              tokenValid: receiverToken.length > 100 ? 'Возможно' : 'Слишком короткий',
              errorType: 'INVALID_ARGUMENT'
            }
          });
        }
      }
      
    } catch (error) {
      console.error('❌ ОШИБКА отправки уведомления (общая):', error);
      console.error('🔴 Стек вызовов:', error.stack);
      
      return res.status(500).json({
        success: false,
        error: error.message,
        code: error.code || 'UNKNOWN',
        details: 'Общая ошибка сервера'
      });
    }
  }
  
  // Если метод не поддерживается
  return res.status(405).json({
    success: false,
    error: 'Метод не поддерживается. Используй GET или POST'
  });
};
