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

async function sessionWithCustomOptions(options, cb) {
    await clientWrapper(async (client, db) => {
        await client.withSession(async (session) => {
            await cb(client, session, db);
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

describe('General', () => {
    test('Outside reads still possible when documents are locked in a transaction', async () => {
        await transactionWithCustomOptions({}, async (client, session, db) => {
            await accountRepository.increaseBalance("test2", 10, {}, { session });

            const user = await accountRepository.getAccount("test2");

            expect(user.balance).toEqual(DEFAULT_BALANCE);
        });
    });

    test('Transactional reads do not lock documents', async () => {
        await transactionWithCustomOptions({}, async (client, session, db) => {
            const trxBalance = await accountRepository.getBalance("test2", {}, { session });
            await accountRepository.increaseBalance("test2", 10);

            const outUser = await accountRepository.getAccount("test2");
            const trxUser = await accountRepository.getAccount("test2", {}, { session });

            expect(outUser.balance).toEqual(DEFAULT_BALANCE + 10);
            expect(trxUser.balance).toEqual(DEFAULT_BALANCE);
        });
    });

    test('Snapshot is taken after the first transactional operation (read or write)', async () => {
        await transactionWithCustomOptions({}, async (client, session, db) => {
            // the transaction already started but snapshot is not taken yet
            await accountRepository.increaseBalance("test2", 10);
            expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);

            // the snapshot is taken here
            expect(await accountRepository.getBalance("test2", {}, { session })).toEqual(DEFAULT_BALANCE + 10);
            await accountRepository.increaseBalance("test2", 10, {}, { session });

            expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);
        });

        // after the transaction commits, the balance reflects transactional updates
        expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 20);
    });
})

describe('Transaction/Operation conflict', () => {
    test('maxTimeMS expires, the transaction cannot complete and the non-transactional operation retries with backoff logic', async () => {
        async function FirstTypeWriteConflict() {
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
        
        await expect(FirstTypeWriteConflict).rejects.toThrow(/operation exceeded time limit/);
    });

    test('TransientTransactionError with retryable writes (Callback API)', async () => {
        let retries = 0;

        await transactionWithCustomOptions({}, async (client, session, db) => {
            // the snapshot is taken
            await accountRepository.increaseBalance("test1", 10, {}, { session });

            // test2 is updated outside
            await accountRepository.increaseBalance("test2", 10);

            try {
                // test2 cannot be updated inside transaction because the snapshot points to a 
                // different document than the actual one
                await accountRepository.increaseBalance("test2", 10, {}, { session });
            }
            catch(exc) {
                expect(exc).toMatchObject({
                    codeName: 'WriteConflict',
                    message: 'WriteConflict error: this operation conflicted with another operation. Please retry your operation or multi-document transaction.',
                    errorLabels: ['TransientTransactionError']
                });

                retries += 1;
                // without ending the session, the transaction is retried again
                if (retries == 3)
                    await session.endSession();
            }
        });

        expect(retries).toEqual(3);
        // the transaction eventually aborts but outside writes remain
        expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10 * (retries));
    });

    test('TransientTransactionError without retryable writes (Core API)', async () => {
        expect.assertions(2);

        await sessionWithCustomOptions({}, async (client, session, db) => {
            session.startTransaction();
            // the snapshot is taken
            await accountRepository.increaseBalance("test1", 10, {}, { session });

            // test2 is updated outside
            await accountRepository.increaseBalance("test2", 10);

            try {
                // test2 cannot be updated inside transaction because the snapshot points to a 
                // different document than the actual one
                await accountRepository.increaseBalance("test2", 10, {}, { session });
            }
            catch(exc) {
                expect(exc).toMatchObject({
                    codeName: 'WriteConflict',
                    message: 'WriteConflict error: this operation conflicted with another operation. Please retry your operation or multi-document transaction.',
                    errorLabels: ['TransientTransactionError']
                });
            }
        });

        // the transaction eventually aborts but outside writes remain
        expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);
    });
});

describe('Transaction/Transaction conflict', () => {
    test('TransientTransactionError with retryable writes (Callback API)', async () => {
        let retries = 0;

        await transactionWithCustomOptions({}, async (client, session, db) => {
            await accountRepository.increaseBalance("test2", 10, {}, { session });

            await client.withSession(async (session1) => {
                await session1.withTransaction(async () => {
                    try {
                        // the document is already locked by the other transaction, therefore WriteConflict
                        await accountRepository.increaseBalance("test2", 10, {}, { session: session1 });
                    }
                    catch (exc) {
                        expect(exc).toMatchObject({
                            codeName: 'WriteConflict',
                            message: 'WriteConflict error: this operation conflicted with another operation. Please retry your operation or multi-document transaction.',
                            errorLabels: ['TransientTransactionError']
                        });

                        retries += 1;

                        // without ending the session, the transaction is retried again
                        if (retries == 3)
                            await session1.endSession();
                    }
                }, {});
            });
        });

        // the inner transaction aborted but the outer transaction commits successfully
        expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);
        expect(retries).toEqual(3);
    });

    test('TransientTransactionError without retryable writes (Core API)', async () => {
        expect.assertions(2);

        await transactionWithCustomOptions({}, async (client, session, db) => {
            await accountRepository.increaseBalance("test2", 10, {}, { session });

            await client.withSession(async (session1) => {
                session1.startTransaction();
                try {
                    // the document is already locked by the other transaction, therefore WriteConflict
                    await accountRepository.increaseBalance("test2", 10, {}, { session: session1 });
                }
                catch (exc) {
                    expect(exc).toMatchObject({
                        codeName: 'WriteConflict',
                        message: 'WriteConflict error: this operation conflicted with another operation. Please retry your operation or multi-document transaction.',
                        errorLabels: ['TransientTransactionError']
                    });
                }
            });
        });

        // the inner transaction aborted but the outer transaction commits successfully
        expect(await accountRepository.getBalance("test2")).toEqual(DEFAULT_BALANCE + 10);
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