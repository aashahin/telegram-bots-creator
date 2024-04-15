require('dotenv').config();
const {Telegraf} = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const Agent = require('node:https').Agent;
const fs = require('node:fs');
const {EventEmitter} = require('node:events');
const bots = require('./bots.js')
const {execSync} = require('node:child_process');

const events = new EventEmitter();

const db = new sqlite3.Database('bots.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the bots database.');
});

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS bots (id INTEGER PRIMARY KEY, token TEXT, bot_id INTEGER, username TEXT, receiptMsg TEXT, startMsg TEXT)');
    db.run('CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, username TEXT, chat_id INTEGER, bot_id INTEGER)');
    db.run('CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, password TEXT)');
});

const bot = new Telegraf(process.env.BOT_TOKEN, {
    telegram: {
        apiRoot: 'http://0.0.0.0:8081/',
        agent: new Agent({
            keepAlive: true,
        })
    },
});

let path = 'none';

bot.start((ctx) => {
    db.all('SELECT * FROM settings', async (err, row) => {
        if (err) {
            console.error(err);
            return;
        }

        if (row.length > 0) {
            ctx.reply('أهلا وسهلا بك 👋\nهذا البوت يساعدك على إنشاء بوتات تليجرام بسهولة. يمكنك إنشاء بوت جديد عبر الأمر /create\n\nلمزيد من المساعدة يمكنك كتابة /help');
            return bot.telegram.setMyCommands([
                {command: 'create', description: 'إنشاء بوت جديد'},
                {command: 'help', description: 'عرض الأوامر المتاحة'}
            ]);
        } else {
            ctx.reply('الرجاء إدخال كلمة المرور لتهيئة البوت');
            path = 'init';
            bot.drop((ctx) => {
                if (path !== 'init') {
                    return;
                }
                const password = ctx.message['text'];
                db.run('INSERT INTO settings (password) VALUES (?)', [password], (err) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    path = 'none';
                    return ctx.reply('تم تهيئة البوت بنجاح');
                });
                path = 'none';
            });
        }
    });
});

const create = async (ctx) => {
    await ctx.reply('الرجاء إدخال كلمة المرور');
    path = 'create';
    let step = 0;

    bot.drop(async (ctx) => {
        if (path !== 'create') {
            step = 0;
            return;
        }
        const password = ctx.message['text'];

        switch (step) {
            case 0:
                return db.get('SELECT * FROM settings WHERE password = ?', [password], async (err, row) => {
                    if (path !== 'create' || step !== 0) {
                        path = 'none';
                        step = 0;
                        return;
                    }
                    if (err) {
                        console.error(err);
                        step = 0;
                        path = 'none';
                        return;
                    }

                    if (row && row['password'] === password) {
                        await ctx.reply('الخطوة الأولى: قم بالحصول على رمز الوصول من خلال إنشاء بوت جديد من هذا الرابط: https://t.me/botfather\n\nالخطوة الثانية: بعد إنشاء البوت ستجد قائمة خيارات من ضمنها API Token قم بنسخ الرمز وإرساله هنا.\n\nمثال: 123456789:ABCdefGhIjKlMnOpQrStUvWxYz123456789\n\n');
                        step = 1;
                    } else {
                        path = 'none';
                        step = 0;
                        return ctx.reply('كلمة المرور غير صحيحة');
                    }
                });
            case 1:
                if (path !== 'create') {
                    step = 0;
                    return;
                }
                let botInfo;
                const token = ctx.message['text'];
                db.get('SELECT * FROM bots WHERE token = ?', [token], async (err, row) => {
                    if (err) {
                        console.error(err);
                        step = 0;
                        path = 'none';
                        return;
                    }

                    if (row) {
                        step = 0;
                        path = 'none';
                        return ctx.reply('هذا الرمز مستخدم بالفعل');
                    }
                });
                try {
                    const newBot = new Telegraf(token);
                    botInfo = await newBot.telegram.getMe();
                } catch (e) {
                    path = 'none';
                    step = 0;
                    return ctx.reply('الرمز الذي أدخلته غير صحيح');
                }
                const botName = botInfo.username;
                const botId = botInfo.id;

                db.run(`INSERT INTO admins (username, bot_id) VALUES ('${ctx.message.from.username}', ${botId})`, function (err) {
                    if (path !== 'create' || step !== 1) {
                        path = 'none';
                        step = 0;
                        return;
                    }
                    if (err) {
                        path = 'none';
                        step = 0;
                        return console.error(err.message);
                    }
                });

                db.run('INSERT INTO bots (token, bot_id, username) VALUES (?,?,?)', [token, botId, botName], function (err) {
                    if (path !== 'create' || step !== 1) {
                        path = 'none';
                        step = 0;
                        return;
                    }

                    if (err) {
                        path = 'none';
                        step = 0;
                        return console.error(err.message);
                    }
                    events.emit('botCreated');
                    path = 'none';
                    step = 0;
                    return bot.telegram.sendMessage(ctx.chat.id, `تم تهيئة البوت بنجاح! يمكنك الوصول إليه عبر الرابط التالي: https://t.me/${botName}`);
                });
                break;
        }
    });
}

const viewBots = async (ctx) => {
    ctx.reply('الرجاء إدخال كلمة المرور');
    path = 'viewBots';

    bot.drop((ctx) => {
        if (path !== 'viewBots') {
            return;
        }
        const password = ctx.message['text'];
        return db.get('SELECT * FROM settings WHERE password = ?', [String(password)], (err, row) => {
            if (err) {
                console.error(err);
                path = 'none';
                return;
            }

            if (row) {
                db.all('SELECT * FROM bots', (err, row) => {
                    if (err) {
                        console.error(err);
                        path = 'none';
                        return ctx.reply('حدث خطأ ما');
                    }

                    if (!row.length) {
                        path = 'none';
                        return ctx.reply('لا توجد بوتات');
                    }

                    let bots = '';
                    row.forEach((botInfo) => {
                        if (botInfo['username'] === null) {
                            return;
                        }
                        bots += `اسم البوت: ${botInfo['username']}\n` + `معرف البوت: ${botInfo['bot_id']}\nزيارة البوت: https://t.me/${botInfo['username']}\n\n`;
                    });

                    path = 'none';
                    return ctx.reply(bots);
                });
            } else {
                path = 'none';
                return ctx.reply('كلمة المرور غير صحيحة');
            }
        });
    });
}

const deleteBot = async (ctx) => {
    ctx.reply('الرجاء إدخال كلمة المرور');
    path = 'deleteBot';
    let step = 1;

    bot.drop((ctx) => {
        const password = ctx.message['text'];

        switch (step) {
            case 1:
                return db.get('SELECT * FROM settings WHERE password = ?', [password], (err, row) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    if (row && row['password'] === password) {
                        step = 2;
                        ctx.reply('الرجاء إدخال معرف البوت');
                    } else {
                        step = 0;
                        return ctx.reply('كلمة المرور غير صحيحة');
                    }
                });
            case 2:
                const botId = ctx.message['text'];
                db.get('SELECT * FROM bots WHERE bot_id = ?', [botId], (err, row) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    if (!row) {
                        step = 0;
                        return ctx.reply('البوت غير موجود');
                    } else {
                        db.run('DELETE FROM bots WHERE bot_id = ?', [botId], (err) => {
                            if (err) {
                                console.error(err);
                                step = 0;
                                return ctx.reply('حدث خطأ ما');
                            }

                            events.emit('botDeleted');
                            step = 0;
                            path = 'none';
                            return ctx.reply('تم حذف البوت بنجاح');
                        });
                    }
                });
                break;
        }
    });
}

const messages = async (ctx) => {
    ctx.reply('الرجاء إدخال كلمة المرور');
    path = 'messages';

    return bot.drop((ctx) => {
        if (path !== 'messages') {
            return;
        }
        const password = ctx.message['text'];
        db.get('SELECT * FROM settings WHERE password = ?', [password], (err, row) => {
            if (err) {
                console.error(err);
                path = 'none';
                return;
            }

            if (row) {
                db.all('SELECT * FROM messages', (err, row) => {
                    if (path !== 'messages') {
                        return;
                    }
                    if (err) {
                        console.error(err);
                        path = 'none';
                        return ctx.reply('حدث خطأ ما');
                    }

                    if (!row.length) {
                        path = 'none';
                        return ctx.reply('لا توجد رسائل');
                    }

                    let messages = '';
                    row.forEach((message) => {
                        messages += message.message + '\n' + `معرف البوت: ${message['bot_id']}` + '\n\n';
                    });

                    if (messages === '') {
                        path = 'none';
                        return ctx.reply('لا توجد رسائل');
                    }
                    path = 'none';
                    return fs.writeFile('messages.txt', messages, (err) => {
                        if (err) {
                            console.error(err);
                            path = 'none';
                            return;
                        }
                        ctx.replyWithDocument({source: 'messages.txt'});
                    });
                });
            } else {
                path = 'none';
                return ctx.reply('كلمة المرور غير صحيحة');
            }
        });
    });
}

const help = async (ctx) => {
    path = 'none';
    ctx.reply('الأوامر المتاحة:\n/create - إنشاء بوت جديد\n/viewBots - عرض البوتات\n/deleteBot - حذف بوت\n/messages - عرض الرسائل');
}

bot.command('create', create);

bot.command('viewBots', viewBots);

bot.command('deleteBot', deleteBot);

bot.command('messages', messages);

bot.help(help);

bot.launch();

// Handle bot creation
events.on('botCreated', async () => {
    bots();
});

events.on('botDeleted', async () => {
    execSync('pm2 restart main');
});

// Handle bot errors
bot.catch((err) => {
    console.error('Error:', err);
});

process.on('unhandledRejection', (err) => {
    console.error(err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));