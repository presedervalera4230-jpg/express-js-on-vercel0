const admin = require('firebase-admin');

// Инициализация Firebase
let isFirebaseInitialized = false;

// Хранилище активных звонков (в памяти)
const activeCalls = new Map();

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

// ==================== ФУНКЦИИ ДЛЯ WEBRTC СИГНАЛИНГА ====================

async function handleCallOffer(req, res, body) {
  console.log('📞 [WebRTC] Получен SDP оффер для звонка');
  
  const { callId, callerId, calleeId, offer, senderToken } = body;
  
  if (!callId || !offer) {
    return res.status(400).json({ 
      success: false, 
      error: 'Нет callId или offer' 
    });
  }
  
  // Сохраняем оффер в памяти
  activeCalls.set(callId, {
    callerId,
    calleeId,
    offer,
    callerToken: senderToken,
    timestamp: Date.now(),
    iceCandidates: [] // Массив для ICE кандидатов
  });
  
  console.log(`💾 [WebRTC] Сохранен оффер для звонка ${callId}`);
  
  // Очищаем старые звонки (чтобы не копилось в памяти)
  cleanupOldCalls();
  
  return res.json({ 
    success: true, 
    callId,
    message: 'Оффер получен' 
  });
}

async function handleCallAnswer(req, res, body) {
  console.log('📞 [WebRTC] Получен SDP ответ на звонок');
  
  const { callId, answer } = body;
  
  if (!callId || !answer) {
    return res.status(400).json({ 
      success: false, 
      error: 'Нет callId или answer' 
    });
  }
  
  const callData = activeCalls.get(callId);
  if (!callData) {
    return res.status(404).json({ 
      success: false, 
      error: 'Звонок не найден' 
    });
  }
  
  // Добавляем ответ к данным звонка
  callData.answer = answer;
  activeCalls.set(callId, callData);
  
  console.log(`💾 [WebRTC] Сохранен ответ для звонка ${callId}`);
  
  return res.json({ 
    success: true, 
    callId,
    message: 'Ответ получен' 
  });
}

async function handleIceCandidate(req, res, body) {
  console.log('📞 [WebRTC] Получен ICE кандидат');
  
  const { callId, candidate, senderId } = body;
  
  if (!callId || !candidate) {
    return res.status(400).json({ 
      success: false, 
      error: 'Нет callId или candidate' 
    });
  }
  
  const callData = activeCalls.get(callId);
  if (!callData) {
    return res.status(404).json({ 
      success: false, 
      error: 'Звонок не найден' 
    });
  }
  
  // Добавляем ICE кандидат в массив
  if (!callData.iceCandidates) {
    callData.iceCandidates = [];
  }
  
  callData.iceCandidates.push({
    candidate,
    senderId,
    timestamp: Date.now()
  });
  
  activeCalls.set(callId, callData);
  
  console.log(`💾 [WebRTC] Добавлен ICE кандидат для звонка ${callId}`);
  
  return res.json({ 
    success: true, 
    callId,
    message: 'ICE кандидат получен',
    candidatesCount: callData.iceCandidates.length
  });
}

async function handleGetCallData(req, res, callId) {
  console.log(`📞 [WebRTC] Запрос данных звонка ${callId}`);
  
  const callData = activeCalls.get(callId);
  
  if (!callData) {
    return res.status(404).json({ 
      success: false, 
      error: 'Звонок не найден' 
    });
  }
  
  return res.json({
    success: true,
    callId,
    ...callData
  });
}

function cleanupOldCalls() {
  const now = Date.now();
  const tenMinutesAgo = now - (10 * 60 * 1000); // 10 минут
  
  for (const [callId, callData] of activeCalls.entries()) {
    if (callData.timestamp < tenMinutesAgo) {
      activeCalls.delete(callId);
      console.log(`🗑️ [WebRTC] Удален старый звонок ${callId}`);
    }
  }
}

// ==================== СУЩЕСТВУЮЩАЯ ЛОГИКА УВЕДОМЛЕНИЙ ====================

async function handleNotification(req, res, body) {
  console.log('📨📨📨 НОВЫЙ ЗАПРОС НА УВЕДОМЛЕНИЕ 📨📨📨');
  console.log('📅 Время:', new Date().toISOString());
  
  // Твой оригинальный код для уведомлений (я его немного сократил для примера)
  const { receiverToken, senderName, messageText, senderId, chatId } = body;
  
  // Валидация
  if (!receiverToken) {
    return res.status(400).json({
      success: false,
      error: 'Нет receiverToken'
    });
  }
  
  // Инициализация Firebase
  if (!initFirebase()) {
    return res.status(500).json({
      success: false,
      error: 'Firebase не настроен'
    });
  }
  
  // Отправка уведомления (твой существующий код)
  const notificationBody = messageText.length > 100 
    ? messageText.substring(0, 100) + '...' 
    : messageText;
  
  const message = {
    token: receiverToken.trim(),
    notification: {
      title: senderName || 'Новое сообщение',
      body: notificationBody
    },
    data: {
      senderId: senderId || '',
      chatId: chatId || '',
      fromNotification: 'true',
      messageText: messageText || '',
      senderName: senderName || '',
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
    }
  };
  
  try {
    const response = await admin.messaging().send(message);
    console.log('✅✅✅ РЕАЛЬНОЕ сообщение успешно отправлено!');
    
    return res.json({
      success: true,
      message: 'Уведомление отправлено!',
      messageId: response
    });
    
  } catch (error) {
    console.error('❌❌❌ ОШИБКА отправки:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Ошибка FCM: ' + error.message
    });
  }
}

// ==================== ГЛАВНЫЙ ОБРАБОТЧИК ====================

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
    // Если запрос на данные звонка
    if (req.url && req.url.includes('/call/')) {
      const callId = req.url.split('/').pop();
      return handleGetCallData(req, res, callId);
    }
    
    // Обычный тестовый GET
    const firebaseStatus = initFirebase() ? '✅ Подключен' : '❌ Нет ключа';
    
    return res.json({
      success: true,
      message: '🚀 Сервер для уведомлений и WebRTC сигналинга работает!',
      timestamp: new Date().toISOString(),
      firebase: firebaseStatus,
      activeCalls: activeCalls.size,
      endpoints: {
        notifications: 'POST /api/send-notification',
        callOffer: 'POST /api/send-notification с {type: "call_offer", ...}',
        callAnswer: 'POST /api/send-notification с {type: "call_answer", ...}',
        iceCandidate: 'POST /api/send-notification с {type: "ice_candidate", ...}',
        getCallData: 'GET /api/send-notification?callId=ID_ЗВОНКА'
      }
    });
  }
  
  // POST запросы
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      
      // Определяем тип запроса
      if (body.type === 'call_offer') {
        return await handleCallOffer(req, res, body);
      }
      
      if (body.type === 'call_answer') {
        return await handleCallAnswer(req, res, body);
      }
      
      if (body.type === 'ice_candidate') {
        return await handleIceCandidate(req, res, body);
      }
      
      // Если не WebRTC запрос, то это обычное уведомление
      return await handleNotification(req, res, body);
      
    } catch (error) {
      console.error('❌ Ошибка сервера:', error);
      return res.status(500).json({
        success: false,
        error: 'Серверная ошибка: ' + error.message
      });
    }
  }
  
  // Если метод не поддерживается
  return res.status(405).json({
    success: false,
    error: 'Метод не поддерживается. Используй GET или POST'
  });
};
