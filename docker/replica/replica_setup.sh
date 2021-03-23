#!/bin/bash
# arguments:
# - $1: number of replicas

# if [[ $(("$1" % 2)) -eq 1 ]]; then 
#     echo "the number of replicas must be odd"
#     exit 1
# fi

# volume creation
for ((i = 1; i <= 3; i++))
do 
    docker volume inspect mongo_replica_data${i} &> /dev/null && echo "mongo_replica_data${i} already exists" || docker volume create mongo_replica_data${i}
done

# keyfile creation
if [[ ! -f ./keys/mongo_replica.key ]]
then
    echo "key creation"
    mkdir -p keys

    openssl rand -base64 756 > ./keys/mongo_replica.key
    chmod 400 ./keys/mongo_replica.key
    chown 999:999 ./keys/mongo_replica.key
fi

chmod a+x replica_config_script.sh
# docker compose start
docker container inspect mongo_replica1 &> /dev/null && echo "mongo_replicas already exist" || \
    docker-compose up -d --no-recreate

for ((i = 1; i <= 3; i++))
do 
    if [[ $(docker container inspect --format="{{json .State.Status }}" mongo_replica${i}) != "\"running\"" ]]; then 
        docker start mongo_replica${i}
    fi
done