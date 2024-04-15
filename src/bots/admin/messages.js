const fs = require('node:fs');

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

            fs.writeFile('messages.txt', messages, (err) => {
                if (err) {
                    console.error(err);
                    return;
                }
                ctx.replyWithDocument({source: 'messages.txt'});
            });
        });
    });
}