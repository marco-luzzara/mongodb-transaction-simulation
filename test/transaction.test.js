const clientWrapper = require('../util/mongoClientWrapper')();

const accountRepository = require('../data/accountRepository');
const constants = require('../constants');
const ACCOUNT_COLL = constants.ACCOUNT_COLL;

const DEFAULT_BALANCE = 1000;

async function transactionWithCustomOptions(options, cb) {
    await clientWrapper(async (client, db) => {
        await client.withSession(async (session) => {
            await session.withTransaction(async () => {
                await cb(client, session, db);
            }, options);
        });
    });
}

beforeEach(async () => {
    await clientWrapper(async (client, db) => {
        await accountRepository.insertAccount("test1", DEFAULT_BALANCE);
        await accountRepository.insertAccount("test2", DEFAULT_BALANCE);
    });
});

afterEach(async () => {
    await clientWrapper(async (client, db) => {
        await accountRepository.deleteAllAccount();
    });
});

afterAll(async () => {
    await clientWrapper(async (client, db) => {
        await client.close();
    });
});

describe('Locking issues', () => {
    test('maxTimeMS expires if the session field is not specified', async () => {
        async function deadlockProblem() {
            await transactionWithCustomOptions({
                "readConcern": {
                    "level": "local"
                },
                "writeConcern": {
                    "w": "1"
                }
            }, async (client, session, db) => {
                await accountRepository.increaseBalance("test2", 10, {}, { session });
    
                await accountRepository.increaseBalance("test2", 10, {}, { "maxTimeMS": 2000 });
            });
        }
        
        await expect(deadlockProblem).rejects.toThrow(/operation exceeded time limit/);
    });

    test('Outside reads still possible when documents are locked in a transaction', async () => {
        await transactionWithCustomOptions({}, async (client, session, db) => {
            await accountRepository.increaseBalance("test2", 10, {}, { session });

            const user = await db.collection(ACCOUNT_COLL).findOne(
                { "owner": "test2" }
            );

            expect(user.balance).toEqual(DEFAULT_BALANCE);
        });
    });
});

describe('Concurrent transactions vs. Concurrent transaction and operation', () => {
    test('Concurrent transactions -> WriteConflict (TransientError), second trx rollbacks and retries', async () => {
        const options = {};
        let writeConflict = false;

        await transactionWithCustomOptions(options, async (client, session, db) => {
            await accountRepository.increaseBalance("test2", 10, {}, { session });

            await client.withSession(async (session1) => {
                await session1.withTransaction(async () => {
                    try {
                        await accountRepository.increaseBalance("test2", 10, {}, { session: session1 });
                    }
                    catch (exc) {
                        expect(exc).toMatchObject({
                            codeName: 'WriteConflict',
                            message: 'WriteConflict error: this operation conflicted with another operation. Please retry your operation or multi-document transaction.',
                            errorLabels: ['TransientTransactionError']
                        });

                        writeConflict = true;
                        // without ending the session, the transaction is retried
                        await session.endSession();
                    }
                }, options);
            });
        });

        expect(writeConflict).toBeTruthy();
    });

    async function getUserBalance(db, options) {
        if (options === undefined) 
            options = {};

        return (await db.collection(ACCOUNT_COLL).findOne(
            { "owner": "test2" },
            options
        )).balance;
    }

    test('Concurrent transaction/operation -> snapshot is taken after the first transactional operation', async () => {
        const options = {};

        await transactionWithCustomOptions(options, async (client, session, db) => {
            // the snapshot is taken after the first operation, not when the transaction starts
            await accountRepository.increaseBalance("test2", 10);
            expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);

            // the snapshot is taken here
            expect(await accountRepository.getBalance("test2", {}, { session })).toEqual(DEFAULT_BALANCE + 10);
            await accountRepository.increaseBalance("test2", 10, {}, { session });

            expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);
        });

        await clientWrapper(async (client, db) => {
            // after the transaction commits, the balance reflects transactional updates
            expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 20);
        });
    });

    test('Concurrent transaction/operation -> a transactional query marks the snapshot start', async () => {
        const options = {};
        let writeConflict = false;

        await transactionWithCustomOptions(options, async (client, session, db) => {
            expect(await accountRepository.getBalance("test2", {}, { session })).toEqual(DEFAULT_BALANCE);

            await accountRepository.increaseBalance("test2", 10);

            expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);
            expect(await accountRepository.getBalance("test2", {}, { session })).toEqual(DEFAULT_BALANCE);

            // there is no conflict here because the document modified is different
            await accountRepository.increaseBalance("test1", 10, {}, { session });

            try {
                await accountRepository.increaseBalance("test2", 10, {}, { session });
            }
            catch(exc) {
                expect(exc).toMatchObject({
                    codeName: 'WriteConflict',
                    message: 'WriteConflict error: this operation conflicted with another operation. Please retry your operation or multi-document transaction.',
                    errorLabels: ['TransientTransactionError']
                });

                writeConflict = true;
                // without ending the session, the transaction is retried
                await session.endSession();
            }
        });

        await clientWrapper(async (client, db) => {
            expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);
        });

        expect(writeConflict).toBeTruthy();
    });

    test('Concurrent transaction/operation -> newly inserted rows are invisible, no phantom reads', async () => {
        const options = {};

        await transactionWithCustomOptions(options, async (client, session, db) => {
            const beforeInsertUsers = await db.collection(ACCOUNT_COLL).countDocuments({}, { session });

            await accountRepository.insertAccount("test3", 2000);
            const afterInsertUsers = await db.collection(ACCOUNT_COLL).countDocuments({}, { session });

            expect(beforeInsertUsers).toEqual(afterInsertUsers);
        });
    });
});