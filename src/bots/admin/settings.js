module.exports = function settingsBots (bot, Markup, path) {
    bot.action('settings', async (ctx) => {
        const options = [
            {text: 'تغيير الإسم', command: 'name'},
            {text: 'تغيير الوصف', command: 'description'},
            {text: 'تغيير الوصف القصير', command: 'shortDescription'},
        ];

        const keyboard = Markup.inlineKeyboard(
            options.map((option) => Markup.button.callback(option.text, option.command)),
            {
                columns: 1,
            }
        ).oneTime().resize();

        await ctx.reply('اختر أحد الخيارات', keyboard);
    });

    bot.action('name', async (ctx) => {
        ctx.reply('الرجاء إدخال الإسم الجديد للبوت');
        path = 'name';
    });

    const name = async (c) => {
        const name = c.message.text;
        await bot.telegram.setMyName(name);
        c.reply(`تم تغيير الإسم إلى: ${name}`);
        await bot.telegram.sendMessage(c.chat.id, 'تم تغيير الإسم بنجاح');
        path = "none";
    }

    bot.action('description', async (ctx) => {
        ctx.reply('الرجاء إدخال الوصف الجديد للبوت');
        path = 'description';
    });
    const desc = async (c) => {
        const description = c.message.text;
        await bot.telegram.setMyDescription(description);
        c.reply(`تم تغيير الوصف إلى: ${description}`);
        await bot.telegram.sendMessage(c.chat.id, 'تم تغيير الوصف بنجاح');
        path = "none";
    }

    bot.action('shortDescription', async (ctx) => {
        ctx.reply('الرجاء إدخال الوصف القصير الجديد للبوت');
        path = 'shortDescription';
    });

    const shortDesc = async (c) => {
        const shortDescription = c.message.text;
        await bot.telegram.setMyShortDescription(shortDescription);
        c.reply(`تم تغيير الوصف القصير إلى: ${shortDescription}`);
        await bot.telegram.sendMessage(c.chat.id, 'تم تغيير الوصف القصير بنجاح');
        path = "none";
    };

    bot.drop(async (ctx) => {
        switch (path) {
            case 'name':
                await name(ctx);
                break;
            case 'description':
                await desc(ctx);
                break;
            case 'shortDescription':
                await shortDesc(ctx);
                break;
        }
    });
}