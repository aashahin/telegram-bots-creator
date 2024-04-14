const express = require('express')
const app = express()
const {Database} = require('sqlite3');

const db = new Database('bots.db');

app.get('/bots', async (req, res) => {
    const {token} = req.query;
    if (!token) {
        res.json({error: 'No token provided'});
    } else {
        await db.get(`SELECT * FROM bots WHERE token = ?`, [token], (err, row) => {
            if (err) {
                console.error(err);
                res.json({error: 'Internal server error'});
            }

            if (!row) {
                res.json({error: 'No bot found'});
            }

            res.json(row);
        })
    }
});

app.get('/admins', async (req, res) => {
    const {botId} = req.query;
    if (!botId) {
        res.json({error: 'No bot ID provided'});
    } else {
        await db.all(`SELECT * FROM admins WHERE bot_id = ?`, [Number(botId)], (err, rows) => {
            if (err) {
                console.error(err);
                res.json({error: 'Internal server error'});
            }

            res.json(rows);
        });
    }
});

app.listen(3000, () => {
    console.log(`Example app listening on port 3000`)
})