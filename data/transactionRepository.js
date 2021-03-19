const Transaction = require("../model/transaction");
const constants = require('../constants');

const clientProvider = require("./clientProvider");
const DB_NAME = process.env.DB_NAME;
const ACCOUNT_COLL = constants.ACCOUNT_COLL;
const TRANSACTION_COLL = constants.TRANSACTION_COLL;
let db = undefined;

const mongoTransactionDefaultConfig = {
    readPreference: 'primary',
    readConcern: { level: 'local' },
    writeConcern: { w: 'majority' }
}

let client = clientProvider();
client.connect((err, client) => {
    if (err)
        throw err;
    db = client.db(DB_NAME);
});

async function createTransaction(from, to, value, mongoTransactionConfig = {}) {
    const newTransaction = new Transaction(from, to, value);
    
    mongoTransactionConfig = {...mongoTransactionDefaultConfig, ...mongoTransactionConfig}
    const session = client.startSession();
    let accountTransactionId = -1;

    try {
        await session.withTransaction(async () => {
            const insertResult = await db.collection(TRANSACTION_COLL)
                .insertOne(newTransaction, { session });

            if (insertResult.insertedCount === 0)
                throw new Error("no transaction inserted");

            const updatedFromAccount = await db.collection(ACCOUNT_COLL).findOneAndUpdate(
                { "owner": from },
                { "$inc": { "balance": -value } }, 
                { session }
            );
            
            if (updatedFromAccount.value === null) 
                throw new Error(`there is no account with owner=${from}`);

            const updatedToAccount = await db.collection(ACCOUNT_COLL).findOneAndUpdate(
                { "owner": to },
                { "$inc": { "balance": value } }, 
                { session }
            );
            
            if (updatedToAccount.value === null) 
                throw new Error(`there is no account with owner=${to}`);

            accountTransactionId = insertResult.insertedId;
        }, mongoTransactionConfig);
    } finally {
        await session.endSession();
    }

    return accountTransactionId;
}

module.exports = {
    createTransaction
}