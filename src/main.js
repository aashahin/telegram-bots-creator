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
    db.run('CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, password TEXT)');
});

const bot = new Telegraf(process.env.BOT_TOKEN, {
    telegram: {
        agent: new Agent({
            keepAlive: true,
        })
    }
});

bot.start((ctx) => {
    db.all('SELECT * FROM settings', (err, row) => {
        if (err) {
            console.error(err);
            return;
        }

        if (row.length > 0) {
            ctx.reply('أهلا وسهلا بك 👋\nهذا البوت يساعدك على إنشاء بوتات تليجرام بسهولة. يمكنك إنشاء بوت جديد عبر الأمر /create\n\nلمزيد من المساعدة يمكنك كتابة /help');
        } else {
            ctx.reply('الرجاء إدخال كلمة المرور لتهيئة البوت');
            bot.drop((ctx) => {
                const password = ctx.message['text'];
                db.run('INSERT INTO settings (password) VALUES (?)', [password], (err) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    return ctx.reply('تم تهيئة البوت بنجاح');
                });
            });
        }
    });
});

let path = 'none';

const create = async (ctx) => {
    await ctx.reply('الرجاء إدخال كلمة المرور');
    path = 'create';
    let step = 0;

    bot.drop(async (ctx) => {
        if (path !== 'create') {
            return;
        }
        const password = ctx.message['text'];

        switch (step) {
            case 0:
                db.get('SELECT * FROM settings WHERE password = ?', [password], async (err, row) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    if (row) {
                        await ctx.reply('الخطوة الأولى: قم بالحصول على رمز الوصول من خلال إنشاء بوت جديد من هذا الرابط: https://t.me/botfather\n\nالخطوة الثانية: بعد إنشاء البوت ستجد قائمة خيارات من ضمنها API Token قم بنسخ الرمز وإرساله هنا.\n\nمثال: 123456789:ABCdefGhIjKlMnOpQrStUvWxYz123456789\n\n');
                        step = 1;
                    } else {
                        await ctx.reply('كلمة المرور غير صحيحة');
                    }
                });
                break;
            case 1:
                let botInfo;
                const token = ctx.message['text'];
                try {
                    const newBot = new Telegraf(token);
                    botInfo = await newBot.telegram.getMe();
                } catch (e) {
                    return ctx.reply('الرمز الذي أدخلته غير صحيح');
                }
                const botName = botInfo.username;
                const botId = botInfo.id;

                db.run(`INSERT INTO admins (username, bot_id) VALUES ('${ctx.message.from.username}', ${botId})`, function (err) {
                    if (err) {
                        return console.log(err.message);
                    }
                });

                db.run('INSERT INTO bots (token, bot_id) VALUES (?,?)', [token, botId], function (err) {
                    if (err) {
                        return console.log(err.message);
                    }
                    bot.telegram.sendMessage(ctx.chat.id, `تم تهيئة البوت بنجاح! يمكنك الوصول إليه عبر الرابط التالي: https://t.me/${botName}`);
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
                return;
            }

            if (row) {
                db.all('SELECT * FROM bots', (err, row) => {
                    if (err) {
                        console.error(err);
                        return ctx.reply('حدث خطأ ما');
                    }

                    if (!row.length) {
                        return ctx.reply('لا توجد بوتات');
                    }

                    let bots = '';
                    row.forEach((bot) => {
                        bots += bot['bot_id'] + '\n';
                    });

                    return ctx.reply(bots);
                });
            } else {
                return ctx.reply('كلمة المرور غير صحيحة');
            }
        });
    });
}

const changePassword = async (ctx) => {
    ctx.reply('الرجاء إدخال كلمة المرور القديمة');
    let step = 0;
    path = 'changePassword';
    bot.drop((ctx) => {
        if (path !== 'changePassword') {
            return;
        }
        switch (step) {
            case 0:
                const oldPassword = ctx.message['text'];
                db.get('SELECT * FROM settings WHERE password = ?', [oldPassword], async (err, row) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    if (row) {
                        await ctx.reply('الرجاء إدخال كلمة المرور الجديدة');
                        step = 1;
                    } else {
                        return ctx.reply('كلمة المرور غير صحيحة');
                    }
                });
                break;
            case 1:
                const newPassword = ctx.message['text'];
                db.run('UPDATE settings SET password = ?', [newPassword], async (err) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    return ctx.reply('تم تغيير كلمة المرور بنجاح');
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
                return;
            }

            if (row) {
                db.all('SELECT * FROM messages', (err, row) => {
                    if (err) {
                        console.error(err);
                        return ctx.reply('حدث خطأ ما');
                    }

                    if (!row.length) {
                        return ctx.reply('لا توجد رسائل');
                    }

                    let messages = '';
                    row.forEach((message) => {
                        messages += message.message + '\n' + `معرف البوت: ${message['bot_id']}` + '\n\n';
                    });

                    return ctx.reply(messages);
                });
            } else {
                return ctx.reply('كلمة المرور غير صحيحة');
            }
        });
    });
}

const help = async (ctx) => {
    ctx.reply('الأوامر المتاحة:\n/create - إنشاء بوت جديد\n/viewBots - عرض البوتات\n/changePassword - تغيير كلمة المرور\n/messages - عرض الرسائل');
}

bot.command('create', create);

bot.command('viewBots', viewBots);

bot.command('changePassword', changePassword);

bot.command('messages', messages);

bot.help(help);

bot.launch().catch((err) => {
    console.error(err);
});