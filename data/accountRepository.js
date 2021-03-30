const Account = require("../model/account");
const constants = require('../constants');

const clientWrapper = require("../util/mongoClientWrapper");
const ACCOUNT_COLL = constants.ACCOUNT_COLL;
const TRANSACTION_COLL = constants.TRANSACTION_COLL;

async function getAccounts(options = {}) {
    return await clientWrapper(async (client, db) => {
        return await db.collection(ACCOUNT_COLL, options)
            .find().toArray();
    })
}

async function getAccountTransactions(owner, options = {}) {
    return await clientWrapper(async (client, db) => {
        return await db.collection(TRANSACTION_COLL, options)
            .find({
                "$or": [
                    { "from": owner },
                    { "to": owner }
                ]
            }).toArray();
    });
}

async function changeBalance(owner, value, options = {}) {
    return await clientWrapper(async (client, db) => {
        const updateResult = await db.collection(ACCOUNT_COLL, options)
            .findOneAndUpdate(
                { "owner": owner }, 
                { "$inc": { "balance": value } });
        
        if (updateResult.value === null)
            throw new Error(`account with owner ${owner} is not found`);

        return updateResult.ok;
    });
}

async function insertAccount(owner, balance, options = {}) {
    return await clientWrapper(async (client, db) => {
        const newAccount = new Account(owner, balance);

        const insertResult = await db.collection(ACCOUNT_COLL, options)
            .insertOne(newAccount);
    
        if (insertResult.insertedCount === 0)
            throw new Error("no account inserted");
    
        return insertResult.insertedId;
    });
}

async function deleteAccount(owner, options = {}) {
    return await clientWrapper(async (client, db) => {
        const deleteAccountResult = await db.collection(ACCOUNT_COLL, options)
            .deleteOne({ "owner": owner });
        const deleteTransactionsResult = await db.collection(TRANSACTION_COLL, options)
            .deleteMany({
                "$or": [
                    { "from": owner },
                    { "to": owner }
                ]
            });

        if (deleteAccountResult.deletedCount + deleteTransactionsResult.deletedCount === 0)
            throw new Error("no document has been deleted");

        return {
            "deletedOwner": deleteAccountResult.deletedCount,
            "deletedTransactions": deleteTransactionsResult.deletedCount
        };
    });
}

module.exports = {
    getAccounts, 
    changeBalance,
    insertAccount,
    getAccountTransactions,
    deleteAccount
}