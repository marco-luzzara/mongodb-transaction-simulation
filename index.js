const accountRouter = require('./api/account');
const transactionRouter = require('./api/transaction');
const express = require('express');

const PORT = process.env.PORT;
let app = express();
app.use(express.json())

app.use('/accounts', accountRouter);
app.use('/transactions', transactionRouter);

app.use(function (err, req, res, next) {
    res.send(err.message);
})

app.listen(PORT, () => console.log(`server successfully started on port ${PORT}`));

