const accountRouter = require('./api/account');
const transactionRouter = require('./api/transaction');
const express = require('express');

const PORT = process.env.PORT;
let app = express();

app.use('/accounts', accountRouter);
app.use('/transactions', transactionRouter);

app.listen(PORT, () => console.log(`server successfully started on port ${PORT}`));

