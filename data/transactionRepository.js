const MoneyTransaction = require("../model/moneyTransaction");
const constants = require('../constants');

const clientWrapper = require("../util/mongoClientWrapper");
const ACCOUNT_COLL = constants.ACCOUNT_COLL;
const TRANSACTION_COLL = constants.TRANSACTION_COLL;

const sessionDefaultConfig = {
    readPreference: 'primary',
    readConcern: { level: 'local' },
    writeConcern: { w: 1 }
}

async function changeBalance(db, user, value, session) {
    const updatedAccount = await db.collection(ACCOUNT_COLL).findOneAndUpdate(
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
    return await clientWrapper(async (client, db) => {
        const newTransaction = new MoneyTransaction(from, to, value);
        
        sessionConfig = {...sessionDefaultConfig, ...sessionConfig}

        let moneyTransactionId = undefined;
        await client.withSession(sessionConfig, async (session) => {
            await session.withTransaction(async () => {
                const insertResult = await db.collection(TRANSACTION_COLL)
                    .insertOne(newTransaction, { session });

                if (insertResult.insertedCount === 0)
                    throw new Error("no transaction inserted");

                await freeze(3)

                await changeBalance(db, from, -value, session);

                await freeze(3);

                await changeBalance(db, to, value, session);

                moneyTransactionId = insertResult.insertedId;
            }, sessionConfig);
        });

        return moneyTransactionId;
    });
}

module.exports = {
    createTransaction
}
