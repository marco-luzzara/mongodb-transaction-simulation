const accountRepo = require('../data/accountRepository');

var express = require('express')
var router = express.Router()

router.post('/', async function (req, res, next) {
    try {
        const owner = req.query.owner;
        const balance = parseInt(req.query.balance);
        const options = req.body.mongoOptions;

        const returnedId = await accountRepo.insertAccount(owner, balance, options);

        return res.send(returnedId);
    }
    catch (err) {
        next(err);
    }
});

router.post('/:owner', async function (req, res, next) {
    try {
        const owner = req.params.owner;
        const value = parseInt(req.query.value);
        const options = req.body.mongoOptions;

        const updateResult = await accountRepo.changeBalance(owner, value, options);

        return res.send(`${updateResult}`);
    }
    catch (err) {
        next(err);
    }
});

router.get('/', async function (req, res, next) {
    try {
        const options = req.body.mongoOptions;

        const accounts = await accountRepo.getAccounts(options);

        return res.json(accounts);
    }
    catch (err) {
        next(err);
    }
});

router.get('/:owner/transactions', async function (req, res, next) {
    try {
        const owner = req.params.owner;
        const options = req.body.mongoOptions;

        const ownerTransactions = await accountRepo.getAccountTransactions(owner, options);

        return res.json(ownerTransactions);
    }
    catch (err) {
        next(err);
    }
});

router.delete('/:owner', async function (req, res, next) {
    try {
        const owner = req.params.owner;
        const options = req.body.mongoOptions;

        const deletedRecords = await accountRepo.deleteAccount(owner, options);

        return res.json(deletedRecords);
    }
    catch (err) {
        next(err);
    }
});

module.exports = router;