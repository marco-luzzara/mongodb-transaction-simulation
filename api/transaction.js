const transactioRepo = require('../data/transactionRepository');

var express = require('express')
var router = express.Router()

router.post('/', async function (req, res, next) {
	try {
		const from = req.query.from;
		const to = req.query.to;
		const value = parseInt(req.query.value);
	
		const returnedId = await transactioRepo.createTransaction(from, to, value);
		
		return res.send(returnedId);
	}
	catch (err) {
		next(err);
	}
})

module.exports = router;