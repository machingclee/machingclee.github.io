---
title: "Revisit Docker from the Beginning"
date: 2023-06-15
id: blog0140
tag: docker
intro: "Revisit the fundamentals of docker."
toc: true
---

#### Basic Commands

- `docker ps` List all running containers
- `docker ps -a` List all container regardless of if it is runing
- `docker run <image-tag>` Run a docker image
- `docker run -d <image-tag>` Run a docker image in detached mode
- `docker stop <container-id>` Stop a container by  and 
- `docker start <same-id>` Get a list of all available images `docker images`
- `docker run -p6000:6379 redis` Specify the port from our computer to the port used by the image in the container
- `docker logs <container-name>` See the log of the container
- `docker run redis --name old_redis` Provides a name to a container
- `docker exec -it <image-name> /bin/bash` ssh into the container, and `exit` to get out
- `docker logs <container-name> | tail` Display the stream of  log lines
- `docker rm -f $(docker ps -a -q)` Delete all running container

#### Docker Network

##### Basic Commands


- `docker network create <network-name>` Create a network
- `docker network ls` List all networks


We run two docker images in the same network:



- ```docker
    docker run -p 27017:27017 \ 
    -d \
    -e MONGO_INITDB_ROOT_USERNAME=admin \
    -e MONGO_INITDB_ROOT_PASSWORD=123 \
    --name mongodb \
    --net mongo-network \
    mongo
    ```
- ```docker
    docker run -d -p 8081:8081 \
    -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin \
    -e ME_CONFIG_MONGODB_ADMINPASSWORD=123 \
    --net mongo-network \
    --name mongo-express \
    -e ME_CONFIG_MONGODB_SERVER=mongodb \
    mongo-express
    ```

##### How do Two Containers Communicate?

When both container are in the same network, they can commnunicate with each other by **container-name** as a domain.

#### Docker-Compose and Dependencies

We don't need to specify the network as `docker-compose` takes care of it.

```yaml
version: '3'
services: 
    mongodb:                # container name (--name param)
        image: mongo        # the image tag
        ports:
            - 27017:27017 
        environment:
            - MONGO_INITDB_ROOT_USERNAME=admin
            - MONGO_INITDB_ROOT_PASSWORD=123
    mongo-express:
        image: mongo-express
        ports:
            - 8080:8081
        depends_on:
          - mongodb         # wait for the container mongodb to start
        environment:
          - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
          - ME_CONFIG_MONGODB_ADMINPASSWORD=123
          - ME_CONFIG_MONGODB_SERVER=mongodb 
```

- Now we can run `docker-compose -f mongo.yaml up -d` to run both `mongo` and `mongo-express` containers. 
- We can stop the containers and remove the network by `docker-compose -f mongo.yaml down`.


#### Build Docker Images

Suppose that we have a backend service written in node-js and we want to dockerize it:

<Center>
    <img src="/assets/tech/140/001.png"/>
</Center>

<p></p>
<center></center>

We write the following in `Dockerfile.backend`:

```dockerfile
FROM node:13-alpine

# ENV MONGO_DB_USERNAME=admin
# ENV MONGO_DB_PWD=123

RUN mkdir -p /home/app
COPY ./backend /home/app

CMD ["npm", "run", "start"]
```

and run 
```text
docker build -t add-user:1.0 -f Dockerfile.backend .
```

- `-t` means a tuple `<img_name>:<version>`, it is used for images. 
- We also have a concept of `name`, which is for the name of **running container**.
- In short, `tags` are for launching the containers, `names` are for utilizing running containers.


#### Volumes
- `docker volume rm $(docker volume ls -q) -f` Remove all volume




```yaml
version: '3'
services: 
    add-user:
       image: add-user:1.0
       ports:
            - 3000:3000
       depends_on:
            - mongodb-test
    mongodb-test:                # container name (--name param)
        image: mongo            # the image tag
        ports:
            - 27018:27017 
        environment:
            - MONGO_INITDB_DATABASE=JamesTestDB
            - MONGO_INITDB_ROOT_USERNAME=admin
            - MONGO_INITDB_ROOT_PASSWORD=123
        volumes:
            - mongo-data:/data/db   # position to save db data within the container
            - ./init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js
    mongo-express:
        image: mongo-express
        restart: always
        ports:
            - 8080:8081
        depends_on:
            - mongodb-test          # wait for the container mongodb to start
        environment:
            - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
            - ME_CONFIG_MONGODB_ADMINPASSWORD=123
            - ME_CONFIG_MONGODB_SERVER=mongodb-test 
volumes:
    mongo-data:                     # volume name
        driver: local
```

- For windows volums are saved in 
    - `\\wsl$\docker-desktop-data\version-pack-data\community\docker\volumes`

- For linux/mac the volumes are saved in `/var/lib/docker`