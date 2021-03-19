const { MongoClient } = require("mongodb");
const USER = process.env.MONGO_INITDB_ROOT_USERNAME;
const PASSWORD = process.env.MONGO_INITDB_ROOT_PASSWORD;
const HOSTNAME = process.env.HOSTNAME;
const MONGO_PORT = process.env.MONGO_PORT;

module.exports = function() {
    const uri =
        `mongodb://${USER}:${PASSWORD}@${HOSTNAME}:${MONGO_PORT}`;
    const client = new MongoClient(uri);
    
    return client;
}