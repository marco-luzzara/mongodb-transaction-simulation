const { MongoClient } = require("mongodb");
const DB_NAME = process.env.DB_NAME;
const USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const PASSWORD = process.env.MONGO_INITDB_ROOT_PASSWORD;
const REPLICA_SET_NAME = process.env.MONGO_REPLICA_SET_NAME;

function buildConnStringMembersFromEnv () {
    let replicaMembersProperties = new Map();

    for (const prop in process.env) {
        if (prop.startsWith("MONGO_HOST") || prop.startsWith("MONGO_PORT")) {
            const memberId = prop.substr(10);

            if (!replicaMembersProperties.has(memberId))
            replicaMembersProperties.set(memberId, {})

            replicaMembersProperties.get(memberId)[prop.substr(0, 10)] = process.env[prop];
        }
    }

    const replicaMembersFromConnString = Array.from(replicaMembersProperties.values())
        .map(elem => `${elem.MONGO_HOST}:${elem.MONGO_PORT}`)
        .join(',');

    return replicaMembersFromConnString;
}

function createClientForReplicaSet() {
    const connStringMembers = buildConnStringMembersFromEnv();

    const uri =
        `mongodb://${USER}:${PASSWORD}@${connStringMembers}/?replicaSet=${REPLICA_SET_NAME}`;
    const client = new MongoClient(uri, { useUnifiedTopology: true });
    
    return client;
}

const client_pool = [createClientForReplicaSet()];

module.exports = function (client_id) {
    if (client_id === undefined)
        client_id = 0;

    if (client_pool[client_id] === undefined)
        client_pool[client_id] = createClientForReplicaSet();

    return async function (cb, useDb) {
        const client = client_pool[client_id];
        if (!client.isConnected())
            await client.connect();
        
        const dbName = useDb !== undefined ? useDb : DB_NAME;
        const db = client.db(dbName);

        return await cb(client, db);
    }
}