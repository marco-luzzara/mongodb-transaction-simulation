echo "Setup time now: $(date +\"%T\")"

mongo --host ${MONGO_HOST1}:${MONGO_PORT1} -u ${MONGO_INITDB_ROOT_USERNAME} -p ${MONGO_INITDB_ROOT_PASSWORD} <<EOF
var cfg = {
    "_id": "${MONGO_REPLICA_SET_NAME}",
    "protocolVersion": 1,
    "version": 1,
    "members": [
        {
            "_id": 0,
            "host": "${MONGO_HOST1}:${MONGO_PORT1}",
            "priority": 2
        },
        {
            "_id": 1,
            "host": "${MONGO_HOST2}:${MONGO_PORT2}",
            "priority": 0
        },
        {
            "_id": 2,
            "host": "${MONGO_HOST3}:${MONGO_PORT3}",
            "priority": 0,
        }
    ]
};
rs.initiate(cfg, { force: true });
EOF