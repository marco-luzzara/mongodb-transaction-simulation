const MoneyTransfer = require("../model/moneyTransfer");

const clientWrapper = require("../util/mongoClientWrapper")();
const accountRepository = require("./accountRepository")

const constants = require('../constants');
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

async function createMoneyTransfer(from, to, value, sessionConfig = {}) {
    return await clientWrapper(async (client, db) => {
        const newTransfer = new MoneyTransfer(from, to, value);
        
        sessionConfig = {...sessionDefaultConfig, ...sessionConfig}

        let moneyTransferId = undefined;
        await client.withSession(sessionConfig, async (session) => {
            await session.withTransaction(async () => {
                const insertResult = await db.collection(TRANSACTION_COLL)
                    .insertOne(newTransfer, { session });

                if (insertResult.insertedCount === 0)
                    throw new Error("No transfer inserted");

                await freeze(3)

                await accountRepository.increaseBalance(from, -value, {}, { session });

                await freeze(3);

                await accountRepository.increaseBalance(to, value, {}, { session });

                moneyTransferId = insertResult.insertedId;
            }, sessionConfig); //unnecessary here because already specified for the session
        });

        return moneyTransferId;
    });
}

module.exports = {
    createMoneyTransfer
}
