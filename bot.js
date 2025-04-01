const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

// Вставьте сюда токен вашего бота
require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Здравствуйте! Я буду напоминать вам поливать цветы каждую среду.');

  // Устанавливаем расписание напоминания
  schedule.scheduleJob('0 9 * * 3', function() {
    bot.sendMessage(chatId, 'Не забудьте полить цветы!');
  });
});
