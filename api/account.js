const accountRepo = require('../data/accountRepository');

var express = require('express')
var router = express.Router()

router.post('/', async function (req, res) {
  	const owner = req.query.owner;
    const balance = parseInt(req.query.balance);

    const returnedId = await accountRepo.insertAccount(owner, balance);

    return res.send(returnedId);
})

router.get('/', async function (req, res) {
    const accounts = await accountRepo.getAccounts();

    return res.json(accounts);
});

router.get('/:owner/transactions', async function (req, res) {
    const owner = req.params.owner;

    const ownerTransactions = await accountRepo.getAccountTransactions(owner);

    return res.json(ownerTransactions);
});

module.exports = router;