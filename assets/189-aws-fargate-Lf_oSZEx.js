const e=`---
title: "AWS Fargate: Let's Create Service and Run Task!"
date: 2023-10-07
id: blog0189
tag: aws, ecs
intro: 'There are two ways of deploying tasks in ECS fargate,  by either "create service" or "run task", let''s get hands on experience with both methods.'
toc: true
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

### What is Task? Task Definition? Service?

In short:

- **Task Definition.** Define which image to use, define how much resources (vCPU, memory, etc) should be allocated to the task.

- **Task.** It is the most basic building blocks in Fargate, they are **_instances_** of Task Definition.

- **Service.** It is a system that **_ensures_** _X_ amount of tasks are up and running.

When we have containerized an application, we can readily deploy it on cloud using ECS Fargate!

Fargate is designed to work with load balancer. Make sure to have one before proceeding.

### Procedures to Create an ECS Fargate Service/Task

#### Create a Task Definition

- We fill in the highlighted fields and leave the rest as default.

  [![](/assets/tech/189/001.png)](/assets/tech/189/001.png)

- A new definition revision will be created

  [![](/assets/tech/189/002.png)](/assets/tech/189/002.png)

- Since we will repeatedly create **_new docker image_** as an update, we can reuse our old revision by **_simply changing the image URI_**:

  1. Create new revision

     [![](/assets/tech/189/003.png)](/assets/tech/189/003.png)

  2. Use latest docker image

     [![](/assets/tech/189/004.png)](/assets/tech/189/004.png)

#### Create Target Group and Associte it with a Load Balancer

- We can only use Target Group of type \`IP Address\`

  [![](/assets/tech/189/image.png)](/assets/tech/189/image.png)

- Target group acts like a forward proxy, we just need HTTP (without SSL):

  [![](/assets/tech/189/image-22.png)](/assets/tech/189/image-22.png)

- Make sure we have created a route for health-check, in my case I use \`/test\` which simply responses \`{"success": true}\`.

  [![](/assets/tech/189/image-2.png)](/assets/tech/189/image-2.png)

- Click Next.

  [![](/assets/tech/189/image-3.png)](/assets/tech/189/image-3.png)

- Fill in the destination port

  [![](/assets/tech/189/image-4.png)](/assets/tech/189/image-4.png)

  since we have not created a task/service yet, we can leave everything unchanged and click **_create target group_**.

- Associate this target group with our load balancer by creating a new listener:

  [![](/assets/tech/189/image-5.png)](/assets/tech/189/image-5.png)

- Choose a certificate:

  [![](/assets/tech/189/image-6.png)](/assets/tech/189/image-6.png)

- and click Add:

  [![](/assets/tech/189/image-7.png)](/assets/tech/189/image-7.png)

#### Back to ECS's Task Definition: Create a Service

- We can start our deployment by running a task or creating a service using this task definition.

  [![](/assets/tech/189/image-8.png)](/assets/tech/189/image-8.png)

- Why there are two options?

  - **Create service.** With this option we can set how many tasks are up and running, we can also set min and max number of tasks to handle sudden changes of traffic.

  - **Run task.** However, not every task is readily scalable.

    For example, if our web server is also a socket.io chat server, we need to scale it by subscribing and publishing to a redis client (see [here](/blog/article/Scaling-Websocket-Chat-Sever-by-Redis)) and change the mechanism of "client send message" in backend to adapt this change.

    In such cases, we only want 1 task to be kept running.

  Back to task definition, check our desired revision, we first proceed by "Create service".

- Choose cluster (which groups our services), choose Launch type and choose FARGATE (default)

  [![](/assets/tech/189/image-9.png)](/assets/tech/189/image-9.png)

- Input a service name, then configure deployment options (leave it unchanged)

  [![](/assets/tech/189/image-10.png)](/assets/tech/189/image-10.png)

- We use an existing security group, later we will allow load balancer to access our service by adding a new inbound rule.

  [![](/assets/tech/189/image-11.png)](/assets/tech/189/image-11.png)

- Choose our load balancer, and then skip to **Target Group**, choose the target group that we have asscoiated with the load balancer, the _Listener_ fields will be filled up automatically.

  [![](/assets/tech/189/image-12.png)](/assets/tech/189/image-12.png)

- Click Create.

  [![](/assets/tech/189/image-13.png)](/assets/tech/189/image-13.png)

#### Let Load Balancer Access our Service

- In clusters dashboard, click the service name

  [![](/assets/tech/189/image-15.png)](/assets/tech/189/image-15.png)

- Go to Networking tab

  [![](/assets/tech/189/image-16.png)](/assets/tech/189/image-16.png)

- Now the networking is governed by the security group list here, click it

  [![](/assets/tech/189/image-17.png)](/assets/tech/189/image-17.png)

- Edit inbound rules and add the security group of our load balancer into the whitelist.

  [![](/assets/tech/189/image-19.png)](/assets/tech/189/image-19.png)

- We can find the name of security group of the load balancer here

  [![](/assets/tech/189/image-18.png)](/assets/tech/189/image-18.png)

- After that our deployment is complete.

  [![](/assets/tech/189/image-20.png)](/assets/tech/189/image-20.png)

#### Verifying it is Working

- We have created a \`/test\` route, let's check it:

  [![](/assets/tech/189/image-23.png)](/assets/tech/189/image-23.png)

#### Run a Task Instead of Running a Service

- Recall that our deployment setting is:

  [![](/assets/tech/189/image-25.png)](/assets/tech/189/image-25.png)

- If we want only one instance (task) to be deployed, we might want to change the **Max running tasks %** from 200 to 101, which in my case results in buggy behaviour.

- To make sure there are only one task, we can choose to **_run task_** instead of **_create service_**.

  [![](/assets/tech/189/image-26.png)](/assets/tech/189/image-26.png)

- Same setting as before:

  [![](/assets/tech/189/image-27.png)](/assets/tech/189/image-27.png)

- Next we leave everything unchanged, click create.

  [![](/assets/tech/189/image-28.png)](/assets/tech/189/image-28.png)

- This time we will bind our task to Target Group through **_private IP_**.

- Click Tasks tab and click the running task:

  [![](/assets/tech/189/image-29.png)](/assets/tech/189/image-29.png)

- Copy the private IP

  [![](/assets/tech/189/image-30.png)](/assets/tech/189/image-30.png)

- Choose our old target group that associated with our load balancer, register a new target:

  [![](/assets/tech/189/image-31.png)](/assets/tech/189/image-31.png)

- Choose an availability zone that does not show warning, then click **_Include as pending below_**.

- Finally click **_Register pending targets_**.

  [![](/assets/tech/189/image-32.png)](/assets/tech/189/image-32.png)

- Let's wait for health check:

  [![](/assets/tech/189/image-33.png)](/assets/tech/189/image-33.png)

- and we are done:

  [![](/assets/tech/189/image-35.png)](/assets/tech/189/image-35.png)

- Same result:

  [![](/assets/tech/189/image-34.png)](/assets/tech/189/image-34.png)

- Cheers!
`;export{e as default};
