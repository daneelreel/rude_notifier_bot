const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

// Вставьте сюда токен вашего бота
require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const userSettings = {}; // Объект для хранения настроек пользователей
const daysOfWeekNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const maxAttempts = 3; // Максимальное количество попыток

const daysOfWeekKeyboard = [
  [{ text: 'Понедельник', callback_data: '1' }, { text: 'Вторник', callback_data: '2' }],
  [{ text: 'Среда', callback_data: '3' }, { text: 'Четверг', callback_data: '4' }],
  [{ text: 'Пятница', callback_data: '5' }, { text: 'Суббота', callback_data: '6' }],
  [{ text: 'Воскресенье', callback_data: '0' }]
];

// Генерация клавиатуры для выбора Утро/Вечер
function getMorningEveningKeyboard() {
  return [
    [{ text: 'Утро', callback_data: 'morning' }, { text: 'Вечер', callback_data: 'evening' }]
  ];
}

// Генерация клавиатуры для выбора часа в 12-часовом формате
function getHourKeyboard(isEvening) {
  const keyboard = [];
  for (let i = 1; i <= 12; i += 3) { // Шаг 3 для сокращения количества кнопок
    const row = [];
    for (let j = i; j < i + 3 && j <= 12; j++) {
      const hour = isEvening ? (j % 12) + 12 : j % 12;
      row.push({ text: j.toString(), callback_data: `hour_${hour}` });
    }
    keyboard.push(row);
  }
  return keyboard;
}

// Генерация клавиатуры для выбора минут
function getMinuteKeyboard() {
  const keyboard = [];
  for (let i = 0; i < 60; i += 15) { // Шаг 15 минут
    keyboard.push([{ text: i.toString().padStart(2, '0'), callback_data: `minute_${i}` }]);
  }
  return keyboard;
}

// Обработчик команды /start и /reset
function startOrReset(chatId) {
  userSettings[chatId] = {}; // Сброс настроек пользователя
  bot.sendMessage(chatId, 'Здравствуйте! Я помогу вам настроить напоминания о поливе цветов. Выберите день для полива:', {
    reply_markup: {
      inline_keyboard: daysOfWeekKeyboard
    }
  });
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  startOrReset(chatId);
});

bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  startOrReset(chatId);
});

bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  if (data === 'morning' || data === 'evening') {
    const isEvening = data === 'evening';
    bot.sendMessage(chatId, 'Выберите час:', {
      reply_markup: {
        inline_keyboard: getHourKeyboard(isEvening)
      }
    });
  } else if (data.startsWith('hour_') || data.startsWith('minute_')) {
    if (!userSettings[chatId].time) {
      userSettings[chatId].time = {};
    }

    if (data.startsWith('hour_')) {
      const hour = data.split('_')[1];
      userSettings[chatId].time.hour = hour;
      bot.sendMessage(chatId, 'Выберите минуты:', {
        reply_markup: {
          inline_keyboard: getMinuteKeyboard()
        }
      });
    } else if (data.startsWith('minute_')) {
      const minute = data.split('_')[1];
      userSettings[chatId].time.minute = minute;

      const { hour } = userSettings[chatId].time;
      const dayOfWeek = userSettings[chatId].dayOfWeek;
      const dayName = daysOfWeekNames[dayOfWeek];

      // Установка регулярного напоминания
      schedule.scheduleJob(`${minute} ${hour} * * ${dayOfWeek}`, function() {
        bot.sendMessage(chatId, 'Не забудьте полить цветы!');
        scheduleRandomInquiry(chatId);
      });

      bot.sendMessage(chatId, `Напоминание установлено на ${hour}:${minute} в день недели: ${dayName}.`);
    }
  } else {
    const dayOfWeek = parseInt(data);

    if (!userSettings[chatId]) {
      userSettings[chatId] = {};
    }

    userSettings[chatId].dayOfWeek = dayOfWeek;
    const dayName = daysOfWeekNames[dayOfWeek];
    bot.sendMessage(chatId, `Вы выбрали день недели: ${dayName}. Теперь выберите Утро или Вечер:`, {
      reply_markup: {
        inline_keyboard: getMorningEveningKeyboard()
      }
    });
  }
});

function scheduleRandomInquiry(chatId) {
  const delay = Math.floor(Math.random() * (48 - 24) + 24) * 60 * 60 * 1000; // Рандомное время от 24 до 48 часов
  setTimeout(() => {
    if (!userSettings[chatId].attempts) {
      userSettings[chatId].attempts = 0;
    }
    if (userSettings[chatId].attempts < maxAttempts) {
      bot.sendMessage(chatId, 'Цветы политы?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Да', callback_data: 'yes' }, { text: 'Нет', callback_data: 'no' }]
          ]
        }
      });
    } else {
      bot.sendMessage(chatId, 'Поздно, все цветы уже умерли.');
    }
  }, delay);
}

bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const data = callbackQuery.data;

  if (data === 'yes') {
    userSettings[chatId].attempts = 0; // Сброс попыток
    bot.sendMessage(chatId, 'Отлично! До следующей недели.');
    // Убедитесь, что здесь не вызывается startOrReset
  } else if (data === 'no') {
    userSettings[chatId].attempts = (userSettings[chatId].attempts || 0) + 1;
    if (userSettings[chatId].attempts < maxAttempts) {
      scheduleRandomInquiry(chatId);
    } else {
      bot.sendMessage(chatId, 'Поздно, все цветы уже умерли.');
    }
  }
});

// Убедитесь, что startOrReset вызывается только при старте или сбросе
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  startOrReset(chatId);
});

bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  startOrReset(chatId);
});