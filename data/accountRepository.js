const Account = require("../model/account");
const constants = require('../constants');

const cp = require("./clientProvider");
const ACCOUNT_COLL = constants.ACCOUNT_COLL;
const TRANSACTION_COLL = constants.TRANSACTION_COLL;

async function getAccounts(options = {}) {

    return await cp.db.collection(ACCOUNT_COLL, options)
        .find().toArray();
}

async function getAccountTransactions(owner, options = {}) {
    return await cp.db.collection(TRANSACTION_COLL, options)
        .find({
            "$or": [
                { "from": owner },
                { "to": owner }
            ]
        }).toArray();
}

async function insertAccount(owner, balance, options = {}) {
    const newAccount = new Account(owner, balance);

    const insertResult = await cp.db.collection(ACCOUNT_COLL, options)
        .insertOne(newAccount);

    if (insertResult.insertedCount === 0)
        throw new Error("no account inserted");

    return insertResult.insertedId;
}

module.exports = {
    getAccounts, 
    insertAccount,
    getAccountTransactions
}