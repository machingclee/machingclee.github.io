---
title: "Fundamentals of Kubernetes"
date: 2024-05-04
id: blog0259
tag: k8s
intro: "We study the basic objects in the world of k8s"
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Installation

- We installl `kubectrl` from  [here](https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/).

- install `minikube` from [here](https://minikube.sigs.k8s.io/docs/start/).
- Note that `kubectl` will be configured by `minikube` to use minikube as to create cluster.

#### Basic minikube Commands

- There no need to install virtual box as we can use 
  ```text
  minikube start --driver=docker
  ```
  to simulate our environment

- We can spin up the dashboard for clusters by 
  ```text
  minikube dashboard
  ```

- Build a basic docker image:
  ```text
  docker build -t kub-first-app .
  ```

#### Kubectl: Imperative Approach

In the sequel we will set the alias `alias k=kubectl`.

##### Create a deployment object
```text
k create deployment first-app --image=kub-first-app
```
At this point no pods is running because `minikube` cannot pull image from my local machine

##### Get all deployments
```text
k get deployments
```
##### Check the status of all pods
```text
k get pods
```

##### Delete a deployment object
```text
k delete deployment first-app
```


#####  Create a service by an existing deployment
```text
k expose deployment first-app --type=LoadBalancer --port=8080
```
here `type` can be of:
- `ClusterIP` Only reachable inside the cluster
- `NodePort` Create an IP address for a specific worker node
- `LoadBalancer` Create an IP address to a loadbalancer that route the traffics to the deployment evenly

#####  List all services
```text
k get services
```
example: 
```text
NAME         TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
first-app    LoadBalancer   10.107.213.78   <pending>     8080:31967/TCP   8s
kubernetes   ClusterIP      10.96.0.1       <none>        443/TCP         
```
- If our cluster is provided by a cloud provider, then we will get an external-IP address.

- In local environment, we can run `minikube service first-app` to let minikube map a local port to the service

##### Scale to multiple pods
```text
k scale deployment/first-app --replicas=3
```
##### Update the deployment
###### Update to new image
we first build and pusb a new container to docker hub ***with new tag***.
```text
k set image deployment/first-app kub-first-app=machingclee/kub-first-app:2
```

Here `kub-first-app` is a running container inside our pod, the name can be found in the dashboard (recall we can use `minikube dashboard`):

![](/assets/img/2024-05-04-01-58-38.png)

###### Check update status
```text
k rollout status deployment/first-app
```

###### Undo the latest deployment
```text
k rollout undo deployment/first-app
```

###### View all the rollout histories
```text
k rollout history deployment/first-app
```
Which results in:
```text
deployment.apps/first-app 
REVISION  CHANGE-CAUSE
2         <none>
3         <none
```
###### Get the detail about the deployment
```text
k rollout history deployment/first-app --revision=2
```
Which results in:
```text
deployment.apps/first-app with revision #2
Pod Template:
  Labels:       app=first-app
        pod-template-hash=7cd7d85cf5
  Containers:
   kub-first-app:
    Image:      machingclee/kub-first-app:2
    Port:       <none>
    Host Port:  <none>
    Environment:        <none>
    Mounts:     <none>
  Volumes:      <none>
  Node-Selectors:       <none>
  Tolerations:  <none>
```

###### Reset to specific deployment history
```text
k rollout undo deployment/first-app --to-revision=1
```
##### Delete a Service
```text
k delete service first-app
```

##### Appendix: Make a new reference by a new tag to an existing image
This is to push to docker hub.
```text
docker tag kub-first-app machingclee/kub-first-app
```
  

#### Kubectl: Declarative Approach

##### deployment.yml
```yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: second-app-deployment
spec: # spec of deployment,
  replicas: 1
  selector:
    matchLabels:
      app: second-app
      tier: backend
  template: # in what follows k8s always expect a pod template spec
    # <--- no need to add "kind: Pod" here.
    metadata:
      labels: # deplyment.yml is more strict, all labels must match in order to deploy a pod
        app: second-app
        tier: backend
    spec: # sepc of pod
      containers:
        - name: second-nodejs-app
          image: machingclee/kub-first-app
```

##### service.yml

```yml
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    # service is less strict,
    # "app: second-app" will match all selectors that use this key-value
    app: second-app
  ports:
    - protocol: "TCP"
      port: 80
      targetPort: 8080
  type: LoadBalancer
```

##### Apply a service.yml and a deployment.yml
```text
k apply -f service.yml
k apply -f deployment.yml
```

##### Connect to the Service just Created
We run (`backend` is the service name we just defined)
```text
minikube service backend
```
because we don't have cloud provider for k8s for the moment.

##### Delete Resources
```text
k delete -f deployment.yml -f service.yml
```

##### Merge service.yml and deployment.yml into one
```yml
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    # service is less strict,
    # "app: second-app" will match all selectors that use this key-value
    app: second-app
  ports:
    - protocol: "TCP"
      port: 80
      targetPort: 8080
  type: LoadBalancer
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: second-app-deployment
spec: # spec of deployment,
  replicas: 1
  selector:
    matchLabels:
      app: second-app
      tier: backend
  template: # in what follows k8s always expect a pod template spec
    # <--- no need to add "kind: Pod" here.
    metadata:
      labels: # deplyment.yml is more strict, all labels must match in order to deploy a pod
        app: second-app
        tier: backend
    spec: # sepc of pod
      containers:
        - name: second-nodejs-app
          image: machingclee/kub-first-app
```

The key difference is that we need to separate them by `---.`

Note that the service object ***is a living organism*** in the cluster, it will monitor all the changes, therefore it is better to create a service object first, then apply deployment objects.

Now we can deploy by `k apply -f merged-file.yml`.

#### Volume