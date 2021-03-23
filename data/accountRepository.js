const Account = require("../model/account");
const constants = require('../constants');

const clientProvider = require("./clientProvider");
const DB_NAME = process.env.DB_NAME;
const ACCOUNT_COLL = constants.ACCOUNT_COLL;
const TRANSACTION_COLL = constants.TRANSACTION_COLL;
let db = undefined;

let client = clientProvider.connectToReplicaSet();
client.connect((err, client) => {
    if (err)
        throw err;
    db = client.db(DB_NAME);
});

async function getAccounts() {
    return await db.collection(ACCOUNT_COLL)
        .find().toArray();
}

async function getAccountTransactions(owner) {
    return await db.collection(TRANSACTION_COLL)
        .find({
            "$or": [
                { "from": owner },
                { "to": owner }
            ]
        }).toArray();
}

async function insertAccount(owner, balance) {
    const newAccount = new Account(owner, balance);

    const insertResult = await db.collection(ACCOUNT_COLL)
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