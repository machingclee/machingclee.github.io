---
title: "Fundamentals of k8s Part 3: EKS"
date: 2024-06-29
id: blog0275
tag: k8s
intro: "We continue the previous study on k8s, this time the EKS."
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Creation of EKS Clsuter

##### EKS > Create Cluster

- When creating a new cluster we will be stucked by providing a new VPC:

  ![](/assets/img/2024-06-29-19-09-02.png)

  which will be being named by ***eskVPC***.

##### Cloudformation Stack for Createing eskVPC

- Let's create a cloudformation stack of VPC's as follow:

  ![](/assets/img/2024-06-29-18-34-32.png)

- To get the S3 URL let's go to [this page (Creating a VPC)](https://docs.aws.amazon.com/eks/latest/userguide/creating-a-vpc.html#create-vpc) and copy the S3 URL listed there: 

  ![](/assets/img/2024-06-30-00-12-49.png)

- Click Next for the creation of stack, then give it a name and leave the rest as default

  ![](/assets/img/2024-06-29-19-00-18.png)

  finally click next and submit.

##### Back to Creating Cluster 

Select public and private and next as some pod will be private and some pod will be public:

![](/assets/img/2024-06-29-19-09-44.png)


#### Config the `kubectl` of Local Computer to Control EKS Cluster Instead of Minikube

- In the past we have been controlling a faked cluster inside `minikube`. How is `kubectl` configured to achieve this? The config file lies in `~/.kube`. 

- Let's copy `config` to `config.minikube` for backup (in case we want to use `minikube` for further experiment, we can switch back)

- Now let's update `~/.kube/config` to communicate with `Cluster` in EKS (here the name should be found as well in the aws console):

  ```text
  aws eks --region ap-northeast-2 update-kubeconfig --name kub-dep-demo
  ```
  We should see the result:
  ```text
  Added new context arn:aws:eks:ap-northeast-2:562976154517:cluster/kub-dep-demo to C:\Users\machingclee\.kube\config
  ```

- We can run `minikube delete` now to delete the unused minikube (in the form of docker image or virtualbox).

#### Create Worker Node

##### EKS > Clusters > cluster-name > Compute Tab

- Let's click on the Compute tab:

  ![](/assets/img/2024-06-30-00-26-59.png)


- When we scroll down we should see nothing on the node groups, let's add at least one:

  ![](/assets/img/2024-06-29-20-01-36.png)

- In the first page we have `Node IAM role`:

  ![](/assets/img/2024-06-30-00-29-26.png)

  This role must be ***created by us***, any default selection will eventually fail in the creation step.
Create a role > EC2:

##### Create an `EksNodeGroup` Role

- Go to IAM > Create Role, then choose EC2:

  ![](/assets/img/2024-06-29-20-58-30.png)

- In the next step, we need to add these 3 roles for the nodes in the node group

  ![](/assets/img/2024-06-29-20-05-33.png)

  Here CNI stands for Container Network Interface.

##### Back to Add Node Group

- Now we can choose our `EksNodeGroup` and click Next.

  ![](/assets/img/2024-06-30-00-34-17.png)

- Don't use `t3.micro` as it may possibly fail in deployment, at least use `t3.smaller`:

  ![](/assets/img/2024-06-30-00-35-22.png)

  

#### Test the Deployment

##### Repository

- https://github.com/machingclee/2024-06-29-k8s-networking-with-dummy-backends/tree/main/deploy-to-EKS

##### Experiment

1. Build your docker image of `auth-api` and `users-api` with your own tag.

2. Deploy them onto docker-hub. 
3. Create a valid `MongoDB` URL and fill that into `k8s/users.yaml`.
4. Execute to deploy everything `kubectl apply -f k8s/auth.yaml -f k8s/users.yaml`.
5. `kubectl get pods` to see if all pods are running. 
6. If `CrashLoopBackOff` status were found, try to run `kubectl logs <pod-name>` to see all the `std` output, where all the error message should be found.
7. Try to run `k get services`, if everything is done successfully, we should see:
    ```text
    NAME            TYPE           CLUSTER-IP       EXTERNAL-IP                                                                    PORT(S)        AGE
    auth-service    ClusterIP      10.100.157.135   <none>                                                                         3000/TCP       2m18s
    kubernetes      ClusterIP      10.100.0.1       <none>                                                                         443/TCP        117m
    users-service   LoadBalancer   10.100.80.215    a338660d2fcab498391efddae4a2426f-1774363841.ap-northeast-2.elb.amazonaws.com   80:31023/TCP   2m18s
    ```

8.  And we are done. The `user-service` is exposed to the net and `auth-service` is hidden inside of the k8s cluster!

    ![](/assets/img/2024-06-30-00-48-59.png)