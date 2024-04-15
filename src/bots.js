const {Telegraf, Markup} = require("telegraf");
const settingsBots = require("./bots/admin/settings");
const messages = require("./bots/admin/messages");
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("bots.db", (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log("Connected to the bots database.");
})

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, user_id INTEGER, message TEXT, bot_id INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, user_id INTEGER, bot_id INTEGER, banned TEXT, name TEXT)");
})

db.all('SELECT * FROM bots', [], async (err, rows) => {
    if (err) {
        throw err;
    }
    try {
        rows.forEach((row) => {
            const botId = row['bot_id'];
            const token = row['token'];
            const bot = new Telegraf(token, {
                telegram: {
                    apiRoot: 'http://0.0.0.0:8081/bot',
                }
            });
            let path = 'null';

            async function getAdmins() {
                return new Promise((resolve, reject) => {
                    db.all('SELECT * FROM admins WHERE bot_id = ?', [row['bot_id']], (err, rows) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(rows);
                    });
                });
            }

            async function isAdmin(ctx) {
                const admins = await getAdmins();
                return admins.find(admin => admin.username === ctx.message.from.username);
            }

            const admin = async (ctx) => {
                const options = [
                    {text: 'إعدادات البوت 🤖', command: 'settings'},
                    {text: 'إرسال رسالة 📨', command: 'post'},
                    {text: 'إعدادات الرسائل 📧', command: 'messages'},
                    {text: 'الإحصائيات 📊', command: 'stats'},
                    {text: 'عرض الرسائل 📥', command: 'viewMessages'},
                    {text: 'المستخدمين المحظورين 🔻', command: 'banned'},
                    {text: 'المستخدمين 👬', command: 'users'},
                    {text: 'إلغاء حظر مستخدم ✅', command: 'unban'},
                    {text: 'حظر مستخدم ⛔', command: 'ban'}
                ];

                const keyboard = Markup.inlineKeyboard(options.map(option => Markup.button.callback(option.text, option.command)), {
                    columns: 2,
                }).oneTime().resize()

                await ctx.reply(
                    '<b>👋 أهلاً بك في لوحة التحكم</b>\n' + '<i>هذه القائمة تظهر للمشرفين والمدراء فقط</i>\n' + '<b>حتي تتمكن من تشغيل ميزة الرسائل المباشرة، يجب عليك تهيئة البوت أولاً</b>\n' + 'يمكنك استخدام الأزرار أدناه للوصول إلى الإعدادات المختلفة\n' + '🔻 لعرض هذه الرسالة مرة أخرى، اضغط على /admin\n' + '🔻 للمساعدة، اضغط على /help\n'
                    , {parse_mode: 'HTML', ...keyboard});
            }

            bot.start(async (ctx) => {
                if (await isAdmin(ctx)) {
                    await admin(ctx);
                    return await bot.telegram.setMyCommands([
                        {command: 'start', description: 'رسالة البداية'},
                        {command: 'admin', description: 'لوحة التحكم'},
                        {command: 'help', description: 'المساعدة'},
                    ]);
                }
                await db.get(`SELECT * FROM bots WHERE token = ?`, [token], (err, row) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    if (!row) {
                        ctx.reply('لم يتم العثور على البوت');
                    }

                    if (row['startMsg']) {
                        return ctx.reply(row['startMsg']);
                    }
                })
            });

            bot.command('help', async (ctx) => {
                return ctx.reply('للوصول إلى لوحة التحكم، اضغط على /admin\n');
            });

            bot.command('admin', async (ctx) => {
                if (await isAdmin(ctx)) {
                    return admin(ctx);
                }
            });

            // Settings
            settingsBots(bot, Markup);

            // Post message
            bot.action('post', async (ctx) => {
                path = 'post';
                return ctx.reply('الرجاء إدخال الرسالة التي تريد إرسالها');
            });

            // Users
            bot.action('users', async (ctx) => {
                db.all('SELECT * FROM users', [], (err, rows) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    if (!rows.length) {
                        return ctx.reply('لا توجد مستخدمين');
                    }

                    let users = '';

                    rows.forEach((user) => {
                        users += `👤 ${user.name} - ${user.user_id}\n`;
                    });

                    return ctx.reply(users);
                });
            });

            // Stats
            bot.action('stats', async (ctx) => {
                db.all('SELECT * FROM users', [], (err, rows) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    const totalUsers = rows.length;
                    db.all('SELECT * FROM messages', [], (err, rows) => {
                        if (err) {
                            console.error(err);
                            return;
                        }

                        const totalMessages = rows.length;
                        db.all('SELECT * FROM users WHERE banned = ?', ['true'], (err, rows) => {
                            if (err) {
                                console.error(err);
                                return;
                            }

                            const totalBanned = rows.length;
                            return ctx.reply(`📊 الإحصائيات\n\n👥 المستخدمين: ${totalUsers}\n📄 الرسائل: ${totalMessages}\n🔻 المحظورين: ${totalBanned}`);
                        })
                    });
                });
            });

            // Banned users
            bot.action('banned', async (ctx) => {
                db.all('SELECT * FROM users WHERE banned = ?', ['true'], (err, rows) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    if (!rows.length) {
                        return ctx.reply('لا يوجد مستخدمين محظورين');
                    }

                    let bannedUsers = '';
                    rows.forEach((user) => {
                        bannedUsers += `👤 ${user.name} - ${user.user_id}\n`;
                    });

                    return ctx.reply(bannedUsers);
                });
            });

            // Ban user
            bot.action('ban', async (ctx) => {
                path = 'ban';
                return ctx.reply('الرجاء إدخال رقم المستخدم الذي تريد حظره');
            });

            // Unban user
            bot.action('unban', async (ctx) => {
                path = 'unban';
                return ctx.reply('الرجاء إدخال رقم المستخدم الذي تريد إلغاء حظره');
            });

            // Messages
            bot.action('messages', async (ctx) => {
                const options = [
                    {text: 'رسالة البداية 🚀', command: 'start-change'},
                    {text: 'رسالة الإستلام 📥', command: 'receipt-change'},
                ];

                const keyboard = await Markup.inlineKeyboard(
                    options.map(option => Markup.button.callback(option.text, option.command)),
                    {
                        columns: 1,
                    }
                ).oneTime().resize();

                return ctx.reply('اختر أحد الخيارات: ', keyboard);
            });
            bot.action('start-change', async (ctx) => {
                path = 'start-change';
                return ctx.reply('الرجاء إدخال رسالة البداية الجديدة');
            });
            bot.action('receipt-change', async (ctx) => {
                path = 'receipt-change';
                return ctx.reply('الرجاء إدخال رسالة الإستلام الجديدة');
            });

            messages(bot, Markup, db, botId);

            bot.on('message', async (ctx) => {
                db.all(`SELECT * FROM admins WHERE bot_id = ?`, [botId], async (err, dataAdmins) => {
                    if (err) {
                        console.error(err);
                    }
                    const isSenderAdmin = await isAdmin(ctx);
                    const userId = ctx.message.from.id;
                    const msg = ctx.message.text;

                    if (msg && !msg.startsWith('/') && ctx.message.reply_to_message && isSenderAdmin) {
                        await ctx.telegram.sendMessage(ctx.message.reply_to_message.forward_from.id, msg);
                    }
                    if (isSenderAdmin) {
                        db.get('SELECT * FROM admins WHERE chat_id = ? AND bot_id = ?', [ctx.message.from.id, botId], (err, row) => {
                            if (err) {
                                console.error(err);
                            }

                            if (!row) {
                                db.run('INSERT INTO admins (chat_id, username, bot_id) VALUES (?, ?, ?)', [ctx.message.from.id, ctx.message.from.username, botId]);
                            }
                        });
                        switch (path) {
                            case 'start-change':
                                await bot.telegram.setMyCommands([{
                                    command: 'start',
                                    description: ctx.message.text
                                }]);
                                db.run('UPDATE bots SET startMsg = ? WHERE token = ?', [ctx.message.text, token]);
                                await ctx.reply('تم تغيير رسالة البداية بنجاح');
                                path = 'none';
                                break;
                            case 'receipt-change':
                                db.run('UPDATE bots SET receiptMsg = ? WHERE token = ?', [ctx.message.text, token]);
                                await ctx.reply('تم تغيير رسالة الإستلام بنجاح');
                                path = 'none';
                                break;
                            case 'post':
                                path = 'none';
                                db.all('SELECT * FROM users', (err, rows) => {
                                    if (err) {
                                        console.error(err);
                                    }
                                    const uniqueUserIds = new Set(rows.map(row => row.user_id));
                                    uniqueUserIds.forEach(userId => {
                                        return bot.telegram.sendMessage(userId, msg);
                                    });
                                    ctx.reply('تم إرسال الرسالة بنجاح');
                                });
                                break;
                            case 'ban':
                                db.run('UPDATE users SET banned = ? WHERE user_id = ?', ['true', msg]);
                                await ctx.reply('تم حظر المستخدم بنجاح');
                                path = 'none';
                                break;
                            case 'unban':
                                db.run('UPDATE users SET banned = ? WHERE user_id = ?', ['false', msg]);
                                await ctx.reply('تم إلغاء حظر المستخدم بنجاح');
                                path = 'none';
                                break;
                        }
                        return;
                    }

                    db.get('SELECT * FROM users WHERE user_id = ? AND bot_id = ? AND banned = ?', [userId, botId, 'true'], async (err, row) => {
                        if (err) {
                            console.error(err);
                        }

                        if (row) {
                            return ctx.reply('لقد تم حظرك من هذا البوت');
                        } else {
                            const fullName = `${ctx.message.from.first_name || ''} ${ctx.message.from.last_name || ''}`;

                            if (msg && !msg.startsWith('/')) {
                                const prettifiedMessage = `📩 رسالة جديدة\n\n👤 المرسل: ${fullName}\n🆔 الرقم: ${userId}\n\n📄 الرسالة: ${msg}`;
                                const uniqueAdminIds = new Set(dataAdmins.map(admin => admin.chat_id));
                                uniqueAdminIds.forEach((admin) => {
                                    if (admin) {
                                        return ctx.telegram.forwardMessage(admin, ctx.message.chat.id, ctx.message.message_id);
                                    }
                                });
                                db.get('SELECT * FROM users WHERE user_id = ? AND bot_id = ?', [userId, botId], (err, row) => {
                                    if (err) {
                                        console.error(err);
                                    }

                                    if (!row) {
                                        db.run('INSERT INTO users (user_id, bot_id, name) VALUES (?, ?, ?)', [userId, botId, fullName]);
                                    }
                                });
                                db.get(`SELECT * FROM bots WHERE token = ?`, [token], (err, dataReceipt) => {
                                    if (err) {
                                        console.error(err);
                                        return;
                                    }

                                    if (dataReceipt) {
                                        console.log('Data receipt', dataReceipt);
                                        db.get('SELECT * FROM messages WHERE user_id = ?', [userId], (err, row) => {
                                            if (err) {
                                                console.error(err);
                                            }

                                            if (!row && dataReceipt['receiptMsg'] && msg && !msg.startsWith('/')) {
                                                ctx.reply(dataReceipt['receiptMsg']);
                                                db.run('INSERT INTO messages (user_id, message, bot_id) VALUES (?, ?, ?)', [ctx.message.from.id, prettifiedMessage, botId]);
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    });
                });
            });

            bot.launch().catch((err) => {
                console.error(err);
            });
        });
    } catch (e) {
        console.error(e);
    }
})


