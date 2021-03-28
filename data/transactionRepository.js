const MoneyTransaction = require("../model/moneyTransaction");
const constants = require('../constants');

const cp = require("./clientProvider");
const ACCOUNT_COLL = constants.ACCOUNT_COLL;
const TRANSACTION_COLL = constants.TRANSACTION_COLL;

const sessionDefaultConfig = {
    readPreference: 'primary',
    readConcern: { level: 'local' },
    writeConcern: { w: 1 }
}

async function changeBalance(user, value, session) {
    const updatedAccount = await cp.db.collection(ACCOUNT_COLL).findOneAndUpdate(
        { "owner": user },
        { "$inc": { "balance": value } },
        { session }
    );

    if (updatedAccount.value === null)
        throw new Error(`there is no account with owner=${user}`);
}

async function freeze(seconds) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), seconds * 1000);
    });
}

async function createTransaction(from, to, value, sessionConfig = {}) {
    const newTransaction = new MoneyTransaction(from, to, value);
    
    sessionConfig = {...sessionDefaultConfig, ...sessionConfig}

    let moneyTransactionId = undefined;
    await cp.client.withSession(sessionConfig, async (session) => {
        await session.withTransaction(async () => {
            const insertResult = await cp.db.collection(TRANSACTION_COLL)
                .insertOne(newTransaction, { session });

            if (insertResult.insertedCount === 0)
                throw new Error("no transaction inserted");

            await changeBalance(from, -value, session);
            let accounts = await cp.db.collection(ACCOUNT_COLL, { "readPreference": "secondary", "readConcern": "available" }).find().toArray();
            console.log(accounts);

            await freeze(5);

            await changeBalance(to, value, session);

            moneyTransactionId = insertResult.insertedId;
        }, sessionConfig);
    });

    return moneyTransactionId;
}

module.exports = {
    createTransaction
}
