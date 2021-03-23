const { MongoClient } = require("mongodb");
const USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const PASSWORD = process.env.MONGO_INITDB_ROOT_PASSWORD;
const REPLICA_SET_NAME = process.env.MONGO_REPLICA_SET_NAME;

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

function connectToReplicaSet() {
    const uri =
        `mongodb://${USER}:${PASSWORD}@${replicaMembersFromConnString}/?replicaSet=${REPLICA_SET_NAME}`;
    const client = new MongoClient(uri);
    
    return client;
}

module.exports = {
    connectToReplicaSet
};