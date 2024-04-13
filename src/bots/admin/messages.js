module.exports = function messages (bot, Markup, db, botId) {
    bot.action('viewMessages', async (ctx) => {
        db.all(`SELECT * FROM messages WHERE bot_id = ?`, [botId], (err, row) => {
            if (err) {
                console.error(err);
                ctx.reply('حدث خطأ ما');
                return;
            }

            if (!row.length) {
                ctx.reply('لا توجد رسائل');
                return;
            }

            let messages = '';
            row.forEach((message) => {
                messages += message.message + '\n';
            });

            ctx.reply(messages);
        });
    });

    bot.action('receiptConfig', async (ctx) => {
       const chatId = ctx.chat.id;
       db.run('UPDATE admins SET chat_id = ? WHERE bot_id = ?', [chatId, botId], (err) => {
           if (err) {
               console.error(err);
               ctx.reply('حدث خطأ ما');
           }
           ctx.reply('تم تهيئة البوت بنجاح');
       });
    });
}