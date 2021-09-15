const Account = require("../model/account");
const constants = require('../constants');

const clientWrapper = require("../util/mongoClientWrapper")();
const ACCOUNT_COLL = constants.ACCOUNT_COLL;
const TRANSACTION_COLL = constants.TRANSACTION_COLL;

async function getAccounts(collOptions = {}, operationOptions = {}) {
    return await clientWrapper(async (client, db) => {
        return await db.collection(ACCOUNT_COLL, collOptions)
            .find({}, operationOptions).toArray();
    })
}

async function getAccount(owner, collOptions = {}, operationOptions = {}) {
    return await clientWrapper(async (client, db) => {
        return await db.collection(ACCOUNT_COLL, collOptions)
            .findOne({ "owner": owner }, operationOptions);
    })
}

async function getAccountTransfers(owner, collOptions = {}, operationOptions = {}) {
    return await clientWrapper(async (client, db) => {
        return await db.collection(TRANSACTION_COLL, collOptions)
            .find({
                "$or": [
                    { "from": owner },
                    { "to": owner }
                ]
            }, operationOptions).toArray();
    });
}

async function getBalance(owner, collOptions = {}, operationOptions = {}) {
    return await clientWrapper(async (client, db) => {
        const objBalance = await db.collection(ACCOUNT_COLL, collOptions)
            .findOne({ "owner": owner },
                {
                    projection: {
                        "_id": 0,
                        "balance": 1
                    },
                    ...operationOptions
                });
        
        if (objBalance === undefined)
            throw new Error(`account with owner ${owner} is not found`);

        return objBalance.balance;
    });
}

async function increaseBalance(owner, value, collOptions = {}, operationOptions = {}) {
    return await clientWrapper(async (client, db) => {
        const updateResult = await db.collection(ACCOUNT_COLL, collOptions)
            .findOneAndUpdate(
                { "owner": owner }, 
                { "$inc": { "balance": value } },
                operationOptions);
        
        if (updateResult.value === null)
            throw new Error(`account with owner ${owner} is not found`);

        return updateResult.ok;
    });
}

async function insertAccount(owner, balance, collOptions = {}, operationOptions = {}) {
    return await clientWrapper(async (client, db) => {
        const newAccount = new Account(owner, balance);

        const insertResult = await db.collection(ACCOUNT_COLL, collOptions)
            .insertOne(newAccount, operationOptions);
    
        if (insertResult.insertedCount === 0)
            throw new Error("no account inserted");
    
        return insertResult.insertedId;
    });
}

async function deleteAccount(owner, collOptions = {}, operationOptions = {}) {
    return await clientWrapper(async (client, db) => {
        const deleteAccountResult = await db.collection(ACCOUNT_COLL, collOptions)
            .deleteOne({ "owner": owner }, operationOptions);
        const deleteTransfersResult = await db.collection(TRANSACTION_COLL, collOptions)
            .deleteMany({
                "$or": [
                    { "from": owner },
                    { "to": owner }
                ]
            }, operationOptions);

        if (deleteAccountResult.deletedCount + deleteTransfersResult.deletedCount === 0)
            throw new Error("no document has been deleted");

        return {
            "deletedOwner": deleteAccountResult.deletedCount,
            "deletedTransfers": deleteTransfersResult.deletedCount
        };
    });
}

async function deleteAllAccount(collOptions = {}, operationOptions = {}) {
    return await clientWrapper(async (client, db) => {
        const projectionOptions = {
            projection: {
                "_id": 0,
                "owner": 1
            }
        }
        const findOptions = {
            ...operationOptions,
            ...projectionOptions
        }

        const owners = (await db.collection(ACCOUNT_COLL, collOptions).find({}, findOptions).toArray())
            .map(a => a.owner);

        const delUsers = await db.collection(ACCOUNT_COLL, collOptions)
            .deleteMany({ 
                "owner": {
                    "$in": owners
                }
            }, operationOptions);
        const delTransfers = await db.collection(TRANSACTION_COLL, collOptions)
            .deleteMany({
                "$or": [
                    { 
                        "from": {
                            "$in": owners
                        } 
                    },
                    { 
                        "to": {
                            "$in": owners
                        } 
                    }
                ]
            }, operationOptions);

        return {
            "deletedUsers": delUsers,
            "deletedTransfers": delTransfers
        }
    });
}

module.exports = {
    getAccounts,
    getAccount,
    getBalance,
    increaseBalance,
    insertAccount,
    getAccountTransfers,
    deleteAccount,
    deleteAllAccount
}