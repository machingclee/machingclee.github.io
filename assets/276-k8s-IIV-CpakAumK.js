const e=`---
title: "K8S Basics Part IV: Deep Dive into EKS"
date: 2024-06-29
id: blog0276
tag: k8s
wip: true
intro: "We continue to study EKS"
---

<style>
  img {
    max-width: 660px;
  }
</style>

in .bashrc alias e=eksctl

e create cluster --name eksctl-test --nodegroup-name ng-default --node-type t3.micro --nodes 2


The maximum number of pods is directly based on the EC2 instance type, here is a list:

- https://github.com/aws/amazon-vpc-cni-k8s/blob/master/misc/eni-max-pods.txt

\`m5.large\` has 2vCPU, and 1vCPU = 1000mCPU (milicore).

\`\`\`yml
  spec: containers:
    - name: php-apache
      image: k8s.gcr.io/hpa-example
      ports:
      - containerPort: 80
      resources:
        requests: 
          cpu: 500m # sometimes 0.5 as well
          memory: 256Mi
        limits:
          cpu: 1000m # sometimes 1 as well
          memory: 512Mi
\`\`\`
thus we are requesting each pod to consume $\\texttt{cpu}\\in[500\\texttt{m}, 1000\\texttt{m}]$ 

In this way if an EC2 of instance type \`m5.large\`, we get 2\`vCPU\`, 

![](/assets/img/2024-07-01-12-34-32.png)

and 1 EC2 can (as a worker node) can run at most 4 pods with cpu capped by 500\`mCPU\`.
A complete list can be found [here](https://aws.amazon.com/ec2/instance-types/).





Allow auto scaling group:

\`\`\`text
eksctl create cluster --name my-cluster --version 1.15 --managed \\
  --asg-access
\`\`\`

kubernetes official dashboard, follow [this page](https://kubernetes.io/docs/tasks/access-application-cluster/web-ui-dashboard/) and use helm to install. 

Next create a service account by following [this page](https://github.com/kubernetes/dashboard/blob/master/docs/user/access-control/creating-sample-user.md).



### Metrics Server and Prometheus

According to https://github.com/kubernetes-sigs/metrics-server#deployment

run 
\`\`\`text
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
\`\`\`
to install metric servers

next follow the instruction in [this page](https://docs.aws.amazon.com/eks/latest/userguide/prometheus.html)




`;export{e as default};
