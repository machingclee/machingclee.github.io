const e=`---
title: "K8S Basics Part II: Networking"
date: 2024-06-28
id: blog0274
tag: k8s
intro: "We continue the previous study on k8s, this time the networking."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Repository
- https://github.com/machingclee/2024-06-29-k8s-networking-with-dummy-backends

### Revisit Deployment and Service



Let's start with a simple deployment and service script:

- \`\`\`yml
  # users-deployment.yml
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: users-deployment
  spec:
    replicas: 1
    selector:
      matchLabels:
        app: users
    template:
      metadata:
        labels:
          app: users
      spec:
        containers:
          - name: users
            image: machingclee/kub-demo-users
  \`\`\`
- \`\`\`text
  k apply -f users-deployment.yml
  \`\`\`

- \`\`\`yml{9}
  # k8s/users-service.yml
  apiVersion: v1
  kind: Service
  metadata:
    name: users-service
  spec:
    selector:
      app: users
    type: LoadBalancer 
    ports:
      - protocol: TCP
        port: 8080 # outside facing
        targetPort: 8080 # container expected port
  \`\`\`
  Note the choice of service type here:
  - \`ClusterIP\` This is the default choice, it is equipped with an internal IP with internal load balanacing.
  - \`NodePort\` The IP address is not stable as nodes are changing when being created and deleted.
  - \`LoadBalancer\` will expose the target deployment selected by \`selector\` to the public.

- \`\`\`text
  k apply -f k8s/users-service.yml
  \`\`\`
- \`\`\`text
  minikube service users-service <-- minikube only, k8s service provider should provide the address automatically
  \`\`\`

This sequence of ymls and scripts can deploy a ***deployment*** and expose that deployment by ***service*** to outside of the k8s cluster.


### Networking within Pods in a k8s Cluster

#### Two Containers in a Pod

It is possible to deploy two containers ***using one pod*** to mimic what we have done in a docker compose:

\`\`\`yml{16-19}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: users-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: users
  template:
    metadata:
      labels:
        app: users
    spec:
      containers:
        - name: users
          image: machingclee/kub-demo-users:latest
        - name: auth
          image: machingclee/kub-demo-auth:latest
\`\`\`
- Note that we add \`:latest\` in the image name so that k8s ***always refetch the latest*** one for deployment.

- The above configruation tries to run two containers inside the same pod. 

- In that case, two containers can commuicate with each other by the magic address \`http://localhost:<port>\`.

#### Two Containers in Seperated Pods with 


![](/assets/img/2024-06-29-13-38-26.png)

##### auth-deployment.yml and auth-service.yml

Our \`auth-deployment.yml\` and \`auth-service.yml\`:

\`\`\`yml
# auth-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: auth
  template:
    metadata:
      labels:
        app: auth
    spec:
      containers:
        - name: auth
          image: machingclee/kub-demo-auth:latest
\`\`\`

\`\`\`yml
# auth-service.yml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
spec:
  selector:
    app: auth
  type: ClusterIP
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80

\`\`\`

##### Method 1: By k8s Generated Environemnt Variable

- The networking configuration provided by \`auth-service.yml\` has a metadata called \`auth-service\`
- Therefore the address inside a k8s cluster can be retrieved by \`AUTH_SERVICE_SERVICE_HOST\`
- Which can be directly applied in our code as shown by the highlighted:

  \`\`\`js{26}
  const express = require('express');
  const bodyParser = require('body-parser');
  const axios = require('axios');

  const app = express();

  app.use(bodyParser.json());

  app.post('/signup', async (req, res) => {
    // It's just a dummy service - we don't really care for the email
    const email = req.body.email;
    const password = req.body.password;

    if (
      !password ||
      password.trim().length === 0 ||
      !email ||
      email.trim().length === 0
    ) {
      return res
        .status(422)
        .json({ message: 'An email and password needs to be specified!' });
    }

    try {
      const hashedPW = await axios.get(\`http://\${process.env.AUTH_SERVICE_SERVICE_HOST}/hashed-password/\` + password);
      // const hashedPW = "dummy text";

      // since it's a dummy service, we don't really care for the hashed-pw either
      console.log(hashedPW, email);
      res.status(201).json({ message: 'User created!' });
    } catch (err) {
      console.log(err);
      return res
        .status(500)
        .json({ message: 'Creating the user failed - please try again later.' });
    }
  });
  \`\`\`

##### Method 2: By k8s' core-DNS


- Alternatively, a ***namespace*** of each service has been provided automatically inside a k8s cluster by the \`core-DNS\` feature.

- Therefore in \`users-deployment\` script we can as well:
  \`\`\`yml
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: users-deployment
  spec:
    replicas: 1
    selector:
      matchLabels:
        app: users
    template:
      metadata:
        labels:
          app: users
      spec:
        containers:
          - name: users
            image: machingclee/kub-demo-users:latest
            env:
              - name: AUTH_ADDRESS
                value: "auth-service.default" # actually a namespace
  \`\`\`
  Now to communicate with \`auth-service\` pod we simply use \`http://\${AUTH_ADDRESS}/*\` in our deployment.
`;export{e as default};
