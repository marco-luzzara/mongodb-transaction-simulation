const accountRouter = require('./api/account');
const transactionRouter = require('./api/transaction');
const clientWrapper = require('./util/mongoClientWrapper');

const express = require('express');

const PORT = process.env.PORT;
let app = express();
app.use(express.json())

app.use('/accounts', accountRouter);
app.use('/transactions', transactionRouter);

app.use(function (err, req, res, next) {
    res.send(err.message);
})

const server = app.listen(PORT, () => console.log(`server successfully started on port ${PORT}`));

process.on('SIGTERM', () => {
    debug('SIGTERM signal received: closing HTTP server')
    server.close(() => {
        clientWrapper(async (client, db) => {
            await client.close();
        });
    })
})

