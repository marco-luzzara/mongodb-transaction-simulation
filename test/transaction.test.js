const clientWrapper = require('../util/mongoClientWrapper');

const accountRepository = require('../data/accountRepository');
const constants = require('../constants');
const ACCOUNT_COLL = constants.ACCOUNT_COLL;

async function transactionWithCustomOptions(options, cb) {
    await clientWrapper(async (client, db) => {
        await client.withSession(async (session) => {
            await session.withTransaction(async () => {
                await cb(session, db);
            }, options);
        });
    });
}

describe('Transaction with different readConcern', () => {
    beforeEach(async () => {
        await clientWrapper(async (client, db) => {
            await accountRepository.insertAccount("test1", 1000);
            await accountRepository.insertAccount("test2", 1000);
        });
    });

    afterEach(async () => {
        await clientWrapper(async (client, db) => {
            await accountRepository.deleteAccount("test1");
            await accountRepository.deleteAccount("test2");
        });
    });

    afterAll(async () => {
        await clientWrapper(async (client, db) => {
            await client.close();
        });
    })

    it('should fail because it is dangerous to acquire a lock already acquired by a transaction', async () => {
        try {
            await transactionWithCustomOptions({}, async (session, db) => {
                await db.collection(ACCOUNT_COLL).findOneAndUpdate(
                    { "owner": "test2" },
                    { "$inc": { "balance": 10 } },
                    { session }
                );
    
                await db.collection(ACCOUNT_COLL).findOneAndUpdate(
                    { "owner": "test2" },
                    { "$inc": { "balance": 10 } },
                    { "maxTimeMS": 3000 }
                );
            });
        }
        catch (err) {
            console.error(err.message);
        }
    });

    it('should not read new write thanks to readConcern=snapshot', async () => {
        await transactionWithCustomOptions({
            "readConcern": {
                "level": "snapshot"
            },
            "writeConcern": {
                "w": "majority"
            }
        }, async (session, db) => {
            const usersBefore = await db.collection(ACCOUNT_COLL)
                .find({}, { session }).toArray();
            console.log(JSON.stringify(usersBefore));

            await db.collection(ACCOUNT_COLL).findOneAndUpdate(
                { "owner": "test2" },
                { "$inc": { "balance": 10 } },
                {
                    "writeConcern": {
                        "w": "majority"
                    }
                }
            );

            const usersAfter = await db.collection(ACCOUNT_COLL)
                .find({}, { session }).toArray();
            console.log(JSON.stringify(usersAfter));
        });
    });
});