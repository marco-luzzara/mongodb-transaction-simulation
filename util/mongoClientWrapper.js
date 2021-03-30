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

const client = createClientForReplicaSet();

module.exports = async function (cb) {
    if (!client.isConnected())
        await client.connect();
    
    const db = client.db(DB_NAME);

    return await cb(client, db);
}