require('dotenv').config();
const {Telegraf} = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const Agent = require('node:https').Agent;

const db = new sqlite3.Database('bots.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the bots database.');
});

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS bots (id INTEGER PRIMARY KEY, token TEXT, bot_id INTEGER, receiptMsg TEXT, startMsg TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, username TEXT, chat_id INTEGER, bot_id INTEGER)');
});

const bot = new Telegraf(process.env.BOT_TOKEN, {
    telegram: {
        agent: new Agent({
            keepAlive: true,
        })
    }
});

bot.start((ctx) => ctx.reply('Welcome! I am a bot that can help you to create bots!'));

bot.command('create', async (ctx) => {
    await bot.telegram.sendMessage(ctx.chat.id, 'Please enter the token of your bot');

    bot.on('message', async (ctx) => {
        const token = ctx.message.text;
        const newBot = new Telegraf(token);
        const botInfo = await newBot.telegram.getMe();
        const botName = botInfo.username;
        const botId = botInfo.id;

        db.run(`INSERT INTO admins (username, bot_id) VALUES ('${ctx.message.from.username}', ${botId})`, function (err) {
            if (err) {
                return console.log(err.message);
            }
        });

        // Save the bot token to the database
        db.run('INSERT INTO bots (token, bot_id) VALUES (?,?)', [token, botId], function (err) {
            if (err) {
                return console.log(err.message);
            }
            bot.telegram.sendMessage(ctx.chat.id, `تم تهيئة البوت بنجاح! يمكنك الوصول إليه عبر الرابط التالي: https://t.me/${botName}`);
        });
    })
});

bot.launch().catch((err) => {
    console.error(err);
});