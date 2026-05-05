const n=`---
title: "K8S Basics Part III: EKS and Container Logging of Pods in CloudWatch via Fluentbit"
date: 2024-06-29
id: blog0275
tag: k8s, aws
intro: "We continue the previous study on k8s, this time the EKS."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Creation of EKS Clsuter

#### EKS > Create Cluster

- When creating a new cluster we will be stucked by providing a new VPC:

  ![](/assets/img/2024-06-29-19-09-02.png)

  which will be being named by ***eskVPC***.

#### Cloudformation Stack for Createing eskVPC

- Let's create a cloudformation stack of VPC's as follow:

  ![](/assets/img/2024-06-29-18-34-32.png)

- To get the S3 URL let's go to [this page (Creating a VPC)](https://docs.aws.amazon.com/eks/latest/userguide/creating-a-vpc.html#create-vpc) and copy the S3 URL listed there: 

  ![](/assets/img/2024-06-30-00-12-49.png)

- Click Next for the creation of stack, then give it a name and leave the rest as default

  ![](/assets/img/2024-06-29-19-00-18.png)

  finally click next and submit.

#### Back to Creating Cluster 

Select public and private and next as some pod will be private and some pod will be public:

![](/assets/img/2024-06-29-19-09-44.png)


### Config the \`kubectl\` of Local Computer to Control EKS Cluster Instead of Minikube

- In the past we have been controlling a faked cluster inside \`minikube\`. How is \`kubectl\` configured to achieve this? The config file lies in \`~/.kube\`. 

- Let's copy \`config\` to \`config.minikube\` for backup (in case we want to use \`minikube\` for further experiment, we can switch back)

- Now let's update \`~/.kube/config\` to communicate with \`Cluster\` in EKS (here the name should be found as well in the aws console):

  \`\`\`text
  aws eks --region ap-northeast-2 update-kubeconfig --name kub-dep-demo
  \`\`\`
  We should see the result:
  \`\`\`text
  Added new context arn:aws:eks:ap-northeast-2:562976154517:cluster/kub-dep-demo to C:\\Users\\machingclee\\.kube\\config
  \`\`\`

- We can run \`minikube delete\` now to delete the unused minikube (in the form of docker image or virtualbox).

### Create Worker Node

#### EKS > Clusters > cluster-name > Compute Tab

- Let's click on the Compute tab:

  ![](/assets/img/2024-06-30-00-26-59.png)


- When we scroll down we should see nothing on the node groups, let's add at least one:

  ![](/assets/img/2024-06-29-20-01-36.png)

- In the first page we have \`Node IAM role\`:

  ![](/assets/img/2024-06-30-00-29-26.png)

  This role must be ***created by us***, any default selection will eventually fail in the creation step, let's create it in the next section:

#### Create an \`EksNodeGroup\` Role

- Go to IAM > Create Role, then choose EC2:

  ![](/assets/img/2024-06-29-20-58-30.png)

- In the next step, we need to add these 4 roles for the nodes in the node group

  ![](/assets/img/2024-07-01-00-10-48.png)

  Here CNI stands for Container Network Interface. The \`CloudWatchLogsFullAccess\` is used to let worker nodes to forward the application log of each pod to cloudwatch.

#### Back to Add Node Group

- Now we can choose our \`EksNodeGroup\` and click Next.

  ![](/assets/img/2024-06-30-00-34-17.png)

- Don't use \`t3.micro\` as it may possibly fail in deployment, at least use \`t3.smaller\`:

  ![](/assets/img/2024-06-30-00-35-22.png)

  

### Test the Deployment

#### Repository

- https://github.com/machingclee/2024-06-29-k8s-networking-with-dummy-backends/tree/main/deploy-to-EKS

#### Experiment

1. Build your docker image of \`auth-api\` and \`users-api\` with your own tag.

2. Deploy them onto docker-hub. 
3. Create a valid \`MongoDB\` URL and fill that into \`k8s/users.yaml\`.
4. Execute to deploy everything \`kubectl apply -f k8s/auth.yaml -f k8s/users.yaml\`.
5. \`kubectl get pods\` to see if all pods are running. 
6. If \`CrashLoopBackOff\` status were found, try to run \`kubectl logs <pod-name>\` to see all the \`std\` output, where all the error message should be found.
7. Try to run \`k get services\`, if everything is done successfully, we should see:
    \`\`\`text
    NAME            TYPE           CLUSTER-IP       EXTERNAL-IP                                                                    PORT(S)        AGE
    auth-service    ClusterIP      10.100.157.135   <none>                                                                         3000/TCP       2m18s
    kubernetes      ClusterIP      10.100.0.1       <none>                                                                         443/TCP        117m
    users-service   LoadBalancer   10.100.80.215    a338660d2fcab498391efddae4a2426f-1774363841.ap-northeast-2.elb.amazonaws.com   80:31023/TCP   2m18s
    \`\`\`

8.  And we are done. The \`user-service\` is exposed to the net and \`auth-service\` is hidden inside of the k8s cluster!

    ![](/assets/img/2024-06-30-00-48-59.png)

### EKS Pod Logging in CloudWatch

- From official documentation  [quick-start](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-setup-EKS-quickstart.html):

  \`\`\`text
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.1/cert-manager.yaml
  \`\`\`

- As instructed from the quick-start we download the yaml file by 
  \`\`\`text
  https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/main/k8s-quickstart/cwagent-operator-rendered.yaml
  \`\`\`
  However, we modify it to get rid of all ***metrics-related logging*** since our primary focuses are the logging of the applications inside of the pods. 
  
- The modified \`configMap\` now becomes:

  <details>
  <summary> <b><i>Click To View the Large YAML</i></b> </summary>
  
  \`\`\`yml
  # cloudwatch.yml
  ---
  # create amazon-cloudwatch namespace
  apiVersion: v1
  kind: Namespace
  metadata:
    name: amazon-cloudwatch
    labels:
      name: amazon-cloudwatch

  ---

  apiVersion: v1
  kind: ServiceAccount
  metadata:
    name: cloudwatch-agent
    namespace: amazon-cloudwatch

  ---

  apiVersion: v1
  kind: ConfigMap
  metadata:
    name: fluent-bit-config
    namespace: amazon-cloudwatch
    labels:
      k8s-app: fluent-bit
  data:
    fluent-bit.conf: |
      [SERVICE]
          Flush                     5
          Grace                     30
          Log_Level                 error
          Daemon                    off
          Parsers_File              parsers.conf
          storage.path              /var/fluent-bit/state/flb-storage/
          storage.sync              normal
          storage.checksum          off
          storage.backlog.mem_limit 5M
      @INCLUDE application-log.conf

    application-log.conf: |
      [INPUT]
          Name                tail
          Tag                 application.*
          Exclude_Path        /var/log/containers/cloudwatch-agent*, /var/log/containers/fluent-bit*, /var/log/containers/aws-node*, /var/log/containers/kube-proxy*, /var/log/containers/cert-manager*
          Path                /var/log/containers/*.log
          multiline.parser    docker, cri
          DB                  /var/fluent-bit/state/flb_container.db
          Mem_Buf_Limit       50MB
          Skip_Long_Lines     On
          Refresh_Interval    10
          Rotate_Wait         30
          storage.type        filesystem
          Read_from_Head      \${READ_FROM_HEAD}

      [INPUT]
          Name                tail
          Tag                 application.*
          Path                /var/log/containers/fluent-bit*
          multiline.parser    docker, cri
          DB                  /var/fluent-bit/state/flb_log.db
          Mem_Buf_Limit       5MB
          Skip_Long_Lines     On
          Refresh_Interval    10
          Read_from_Head      \${READ_FROM_HEAD}

      [INPUT]
          Name                tail
          Tag                 application.*
          Path                /var/log/containers/cloudwatch-agent*
          multiline.parser    docker, cri
          DB                  /var/fluent-bit/state/flb_cwagent.db
          Mem_Buf_Limit       5MB
          Skip_Long_Lines     On
          Refresh_Interval    10
          Read_from_Head      \${READ_FROM_HEAD}

      [FILTER]
          Name                kubernetes
          Match               application.*
          Kube_URL            https://kubernetes.default.svc:443
          Kube_Tag_Prefix     application.var.log.containers.
          Merge_Log           On
          Merge_Log_Key       log_processed
          K8S-Logging.Parser  On
          K8S-Logging.Exclude Off
          Labels              Off
          Annotations         Off
          Use_Kubelet         On
          Kubelet_Port        10250
          Buffer_Size         32

      [OUTPUT]
          Name                cloudwatch_logs
          Match               application.*
          region              \${AWS_REGION}
          log_group_name      fallback-group
          log_stream_prefix   fallback-stream
          log_key             log
          auto_create_group   On
          log_group_template  $kubernetes['namespace_name']
          log_stream_template $kubernetes['pod_name'].$kubernetes['container_name']
          extra_user_agent    container-insights

    parsers.conf: |
      [PARSER]
          Name                syslog
          Format              regex
          Regex               ^(?<time>[^ ]* {1,2}[^ ]* [^ ]*) (?<host>[^ ]*) (?<ident>[a-zA-Z0-9_\\/\\.\\-]*)(?:\\[(?<pid>[0-9]+)\\])?(?:[^\\:]*\\:)? *(?<message>.*)$
          Time_Key            time
          Time_Format         %b %d %H:%M:%S

      [PARSER]
          Name                container_firstline
          Format              regex
          Regex               (?<log>(?<="log":")\\S(?!\\.).*?)(?<!\\\\)".*(?<stream>(?<="stream":").*?)".*(?<time>\\d{4}-\\d{1,2}-\\d{1,2}T\\d{2}:\\d{2}:\\d{2}\\.\\w*).*(?=})
          Time_Key            time
          Time_Format         %Y-%m-%dT%H:%M:%S.%LZ

      [PARSER]
          Name                cwagent_firstline
          Format              regex
          Regex               (?<log>(?<="log":")\\d{4}[\\/-]\\d{1,2}[\\/-]\\d{1,2}[ T]\\d{2}:\\d{2}:\\d{2}(?!\\.).*?)(?<!\\\\)".*(?<stream>(?<="stream":").*?)".*(?<time>\\d{4}-\\d{1,2}-\\d{1,2}T\\d{2}:\\d{2}:\\d{2}\\.\\w*).*(?=})
          Time_Key            time
          Time_Format         %Y-%m-%dT%H:%M:%S.%LZ
  ---

  apiVersion: v1
  kind: ConfigMap
  metadata:
    name: fluent-bit-windows-config
    namespace: amazon-cloudwatch
    labels:
      k8s-app: fluent-bit
  data:
    fluent-bit.conf: |
      [SERVICE]
          Flush                       5
          Log_Level                   error
          Daemon                      off
          net.dns.resolver            LEGACY
          Parsers_File                parsers.conf
      @INCLUDE application-log.conf

    application-log.conf: |
      [INPUT]
          Name                tail
          Tag                 application.*
          Exclude_Path        C:\\\\var\\\\log\\\\containers\\\\fluent-bit*, C:\\\\var\\\\log\\\\containers\\\\cloudwatch-agent*
          Path                C:\\\\var\\\\log\\\\containers\\\\*.log
          Parser              docker
          DB                  C:\\\\var\\\\fluent-bit\\\\state\\\\flb_container.db
          Mem_Buf_Limit       50MB
          Skip_Long_Lines     On
          Rotate_Wait         30
          Refresh_Interval    10
          Read_from_Head      \${READ_FROM_HEAD}

      [INPUT]
          Name                tail
          Tag                 application.*
          Path                C:\\\\var\\\\log\\\\containers\\\\fluent-bit*
          Parser              docker
          DB                  C:\\\\var\\\\fluent-bit\\\\state\\\\flb_log.db
          Mem_Buf_Limit       5MB
          Skip_Long_Lines     On
          Rotate_Wait         30
          Refresh_Interval    10
          Read_from_Head      \${READ_FROM_HEAD}

      [INPUT]
          Name                tail
          Tag                 application.*
          Path                C:\\\\var\\\\log\\\\containers\\\\cloudwatch-agent*
          Parser              docker
          DB                  C:\\\\var\\\\fluent-bit\\\\state\\\\flb_cwagent.db
          Mem_Buf_Limit       5MB
          Skip_Long_Lines     On
          Rotate_Wait         30
          Refresh_Interval    10
          Read_from_Head      \${READ_FROM_HEAD}

      [OUTPUT]
          Name                cloudwatch_logs
          Match               application.*
          region              \${AWS_REGION}
          log_group_name      fallback-group
          log_stream_prefix   fallback-stream
          log_key             log
          auto_create_group   On
          log_group_template  application-logs-$kubernetes['host'].$kubernetes['namespace_name']
          log_stream_template $kubernetes['pod_name'].$kubernetes['container_name']
          extra_user_agent    container-insights

    parsers.conf: |
      [PARSER]
          Name                docker
          Format              json
          Time_Key            time
          Time_Format         %b %d %H:%M:%S

      [PARSER]
          Name                container_firstline
          Format              regex
          Regex               (?<log>(?<="log":")\\S(?!\\.).*?)(?<!\\\\)".*(?<stream>(?<="stream":").*?)".*(?<time>\\d{4}-\\d{1,2}-\\d{1,2}T\\d{2}:\\d{2}:\\d{2}\\.\\w*).*(?=})
          Time_Key            time
          Time_Format         %Y-%m-%dT%H:%M:%S.%LZ

      [PARSER]
          Name                dataplane_firstline
          Format              regex
          Regex               (?<log>(?<="log":")\\S(?!\\.).*?)(?<!\\\\)".*(?<stream>(?<="stream":").*?)".*(?<time>\\d{4}-\\d{1,2}-\\d{1,2}T\\d{2}:\\d{2}:\\d{2}\\.\\w*).*(?=})
          Time_Key            time
          Time_Format         %Y-%m-%dT%H:%M:%S.%LZ
  ---

  apiVersion: rbac.authorization.k8s.io/v1
  kind: ClusterRole
  metadata:
    name: amazon-cloudwatch-observability-manager-role
  rules:
  - apiGroups: [ "" ]
    resources: [ "configmaps" ]
    verbs: [ "create", "delete", "get", "list", "patch", "update", "watch" ]
  - apiGroups: [ "" ]
    resources: [ "events" ]
    verbs: [ "create", "patch" ]
  - apiGroups: [ "" ]
    resources: [ "namespaces", "pods" ]
    verbs: [ "get","list","patch","update","watch" ]
  - apiGroups: [ "" ]
    resources: [ "serviceaccounts" ]
    verbs: [ "create","delete","get","list","patch","update","watch" ]
  - apiGroups: [ "" ]
    resources: [ "services" ]
    verbs: [ "create","delete","get","list","patch","update","watch" ]
  - apiGroups: [ "apps" ]
    resources: [ "daemonsets" ]
    verbs: [ "create","delete","get","list","patch","update","watch" ]
  - apiGroups: [ "apps" ]
    resources: [ "deployments" ]
    verbs: [ "create","delete","get","list","patch","update","watch" ]
  - apiGroups: [ "apps" ]
    resources: [ "statefulsets" ]
    verbs: [ "create","delete","get","list","patch","update","watch" ]
  - apiGroups: [ "apps" ]
    resources: [ "replicasets" ]
    verbs: [ "get","list","watch" ]
  - apiGroups: [ "cloudwatch.aws.amazon.com" ]
    resources: [ "amazoncloudwatchagents", "dcgmexporters", "neuronmonitors" ]
    verbs: [ "get","list","patch","update","watch" ]
  - apiGroups: [ "cloudwatch.aws.amazon.com" ]
    resources: [ "amazoncloudwatchagents/finalizers", "dcgmexporters/finalizers", "neuronmonitors/finalizers" ]
    verbs: [ "get","patch","update" ]
  - apiGroups: [ "cloudwatch.aws.amazon.com" ]
    resources: [ "amazoncloudwatchagents/status", "dcgmexporters/status", "neuronmonitors/status" ]
    verbs: [ "get","patch","update" ]
  - apiGroups: [ "cloudwatch.aws.amazon.com" ]
    resources: [ "instrumentations" ]
    verbs: [ "get","list","patch","update","watch" ]
  - apiGroups: [ "coordination.k8s.io" ]
    resources: [ "leases" ]
    verbs: [ "create","get","list","update" ]
  - apiGroups: [ "networking.k8s.io" ]
    resources: [ "ingresses" ]
    verbs: [ "create","delete","get","list","patch","update","watch" ]
  - apiGroups: [ "route.openshift.io" ]
    resources: [ "routes", "routes/custom-host" ]
    verbs: [ "create","delete","get","list","patch","update","watch" ]
  ---

  kind: ClusterRoleBinding
  apiVersion: rbac.authorization.k8s.io/v1
  metadata:
    name: cloudwatch-agent-role-binding
  roleRef:
    kind: ClusterRole
    name: cloudwatch-agent-role
    apiGroup: rbac.authorization.k8s.io
  subjects:
  - kind: ServiceAccount
    name: cloudwatch-agent
    namespace: amazon-cloudwatch
  ---

  apiVersion: rbac.authorization.k8s.io/v1
  kind: ClusterRoleBinding
  metadata:
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
    name: amazon-cloudwatch-observability-manager-rolebinding
  roleRef:
    apiGroup: rbac.authorization.k8s.io
    kind: ClusterRole
    name: amazon-cloudwatch-observability-manager-role
  subjects:
  - kind: ServiceAccount
    name: amazon-cloudwatch-observability-controller-manager
    namespace: amazon-cloudwatch
  ---

  apiVersion: rbac.authorization.k8s.io/v1
  kind: Role
  metadata:
    name: "dcgm-exporter-role"
    namespace: amazon-cloudwatch
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
  rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["dcgm-exporter-config-map"]
    verbs: ["get"]
  ---

  apiVersion: rbac.authorization.k8s.io/v1
  kind: Role
  metadata:
    name: "neuron-monitor-role"
    namespace: amazon-cloudwatch
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
  rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["neuron-monitor-config-map"]
    verbs: ["get"]
  ---

  apiVersion: rbac.authorization.k8s.io/v1
  kind: RoleBinding
  metadata:
    namespace: amazon-cloudwatch
    name: dcgm-exporter-role-binding
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
  roleRef:
    kind: Role
    name: "dcgm-exporter-role"
    apiGroup: rbac.authorization.k8s.io
  subjects:
  - kind: ServiceAccount
    name: dcgm-exporter-service-acct
    namespace: amazon-cloudwatch
  ---

  apiVersion: rbac.authorization.k8s.io/v1
  kind: RoleBinding
  metadata:
    namespace: amazon-cloudwatch
    name: neuron-monitor-role-binding
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
  roleRef:
    kind: Role
    name: "neuron-monitor-role"
    apiGroup: rbac.authorization.k8s.io
  subjects:
  - kind: ServiceAccount
    name: neuron-monitor-service-acct
    namespace: amazon-cloudwatch
  ---

  apiVersion: v1
  kind: Service
  metadata:
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
    name: amazon-cloudwatch-observability-webhook-service
    namespace: amazon-cloudwatch
  spec:
    ports:
    - port: 443
      protocol: TCP
      targetPort: 9443
    selector:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      control-plane: controller-manager
  ---

  apiVersion: apps/v1
  kind: DaemonSet
  metadata:
    name: fluent-bit
    namespace: amazon-cloudwatch
    labels:
      k8s-app: fluent-bit
      version: v1
      kubernetes.io/cluster-service: "true"
  spec:
    selector:
      matchLabels:
        k8s-app: fluent-bit
    template:
      metadata:
        annotations:
          checksum/config: 1356b1d704d353a90c127f6dad453991f51d88ae994a7583c1064e0c883d898e
        labels:
          k8s-app: fluent-bit
          version: v1
          kubernetes.io/cluster-service: "true"
      spec:
        containers:
        - name: fluent-bit
          image: public.ecr.aws/aws-observability/aws-for-fluent-bit:2.32.0.20240304
          imagePullPolicy: Always
          env:
          - name: AWS_REGION
            value: {{region_name}}
          - name: CLUSTER_NAME
            value: "{{cluster_name}}"
          - name: READ_FROM_HEAD
            value: "Off"
          - name: READ_FROM_TAIL
            value: "On"
          - name: HOST_NAME
            valueFrom:
              fieldRef:
                fieldPath: spec.nodeName
          - name: HOSTNAME
            valueFrom:
              fieldRef:
                apiVersion: v1
                fieldPath: metadata.name
          - name: CI_VERSION
            value: "k8s/1.3.24"
          resources:
            limits:
              cpu: 500m
              memory: 250Mi
            
            requests:
              cpu: 50m
              memory: 25Mi
          volumeMounts:
          # Please don't change below read-only permissions
          - name: fluentbitstate
            mountPath: /var/fluent-bit/state
          - name: varlog
            mountPath: /var/log
            readOnly: true
          - name: varlibdockercontainers
            mountPath: /var/lib/docker/containers
            readOnly: true
          - name: fluent-bit-config
            mountPath: /fluent-bit/etc/
          - name: runlogjournal
            mountPath: /run/log/journal
            readOnly: true
          - name: dmesg
            mountPath: /var/log/dmesg
            readOnly: true
        terminationGracePeriodSeconds: 10
        hostNetwork: true
        dnsPolicy: ClusterFirstWithHostNet
        volumes:
        - name: fluentbitstate
          hostPath:
            path: /var/fluent-bit/state
        - name: varlog
          hostPath:
            path: /var/log
        - name: varlibdockercontainers
          hostPath:
            path: /var/lib/docker/containers
        - name: fluent-bit-config
          configMap:
            name: fluent-bit-config
        - name: runlogjournal
          hostPath:
            path: /run/log/journal
        - name: dmesg
          hostPath:
            path: /var/log/dmesg
        serviceAccountName: cloudwatch-agent
        nodeSelector:
          kubernetes.io/os: linux
  ---

  apiVersion: apps/v1
  kind: DaemonSet
  metadata:
    name: fluent-bit-windows
    namespace: amazon-cloudwatch
    labels:
      k8s-app: fluent-bit
      version: v1
      kubernetes.io/cluster-service: "true"
  spec:
    selector:
      matchLabels:
        k8s-app: fluent-bit
    template:
      metadata:
        annotations:
          checksum/config: a54dc0c777b3caf8ea8c5e895f9e6054af9b06c72bed9d012c4414165bc85a41
        labels:
          k8s-app: fluent-bit
          version: v1
          kubernetes.io/cluster-service: "true"
      spec:
        securityContext:
          windowsOptions:
            hostProcess: true
            runAsUserName: "NT AUTHORITY\\\\System"
        hostNetwork: true
        nodeSelector:
          kubernetes.io/os: windows
        containers:
        - name: fluent-bit
          image: public.ecr.aws/aws-observability/aws-for-fluent-bit:2.31.12-windowsservercore
          imagePullPolicy: Always
          command: ["powershell.exe", "-Command", "New-Item -ItemType Directory -Path C:\\\\var\\\\fluent-bit\\\\state -Force;", "%CONTAINER_SANDBOX_MOUNT_POINT%/fluent-bit/bin/fluent-bit.exe", "-e", "%CONTAINER_SANDBOX_MOUNT_POINT%/fluent-bit/kinesis.dll", "-e", "%CONTAINER_SANDBOX_MOUNT_POINT%/fluent-bit/firehose.dll", "-e", "%CONTAINER_SANDBOX_MOUNT_POINT%/fluent-bit/cloudwatch.dll", "-c", "%CONTAINER_SANDBOX_MOUNT_POINT%/fluent-bit/configuration/fluent-bit.conf"]
          env:
          - name: AWS_REGION
            value: {{region_name}}
          - name: CLUSTER_NAME
            value: "{{cluster_name}}"
          - name: READ_FROM_HEAD
            value: "Off"
          - name: HOST_NAME
            valueFrom:
              fieldRef:
                fieldPath: spec.nodeName
          - name: HOSTNAME
            valueFrom:
              fieldRef:
                apiVersion: v1
                fieldPath: metadata.name
          - name: CI_VERSION
            value: "k8s/1.3.24"
          resources:
            limits:
              cpu: 500m
              memory: 600Mi
            
            requests:
              cpu: 300m
              memory: 300Mi
          volumeMounts:
            - name: fluent-bit-config
              mountPath: fluent-bit\\configuration\\
        volumes:
          - name: fluent-bit-config
            configMap:
              name: fluent-bit-windows-config
        terminationGracePeriodSeconds: 10
        dnsPolicy: ClusterFirstWithHostNet
        serviceAccountName: cloudwatch-agent
  ---

  apiVersion: apps/v1
  kind: Deployment
  metadata:
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
      control-plane: controller-manager
    name: amazon-cloudwatch-observability-controller-manager
    namespace: amazon-cloudwatch
  spec:
    replicas: 1
    selector:
      matchLabels:
        app.kubernetes.io/name: amazon-cloudwatch-observability
        control-plane: controller-manager
    template:
      metadata:
        annotations:
        labels:
          app.kubernetes.io/name: amazon-cloudwatch-observability
          control-plane: controller-manager
          
      spec:
        containers:
        - image: public.ecr.aws/cloudwatch-agent/cloudwatch-agent-operator:1.3.0
          args:
          - "--auto-annotation-config={\\"java\\":{\\"daemonsets\\":[],\\"deployments\\":[],\\"namespaces\\":[],\\"statefulsets\\":[]},\\"python\\":{\\"daemonsets\\":[],\\"deployments\\":[],\\"namespaces\\":[],\\"statefulsets\\":[]}}"
          - "--auto-instrumentation-java-image=public.ecr.aws/aws-observability/adot-autoinstrumentation-java:v1.32.1"
          - "--auto-instrumentation-python-image=public.ecr.aws/aws-observability/adot-autoinstrumentation-python:v0.1.0"
          - "--feature-gates=operator.autoinstrumentation.multi-instrumentation,operator.autoinstrumentation.multi-instrumentation.skip-container-validation"
          command:
          - /manager
          name: manager
          ports:
          - containerPort: 9443
            name: webhook-server
            protocol: TCP
          resources: 
              requests:
                cpu: 100m
                memory: 64Mi
          volumeMounts:
          - mountPath: /tmp/k8s-webhook-server/serving-certs
            name: cert
            readOnly: true
        serviceAccountName: amazon-cloudwatch-observability-controller-manager
        terminationGracePeriodSeconds: 10
        volumes:
        - name: cert
          secret:
            defaultMode: 420
            secretName: amazon-cloudwatch-observability-controller-manager-service-cert
        nodeSelector:
          kubernetes.io/os: linux
  ---

  apiVersion: cert-manager.io/v1
  kind: Certificate
  metadata:
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
    name: amazon-cloudwatch-observability-serving-cert
    namespace: amazon-cloudwatch
  spec:
    dnsNames:
      - amazon-cloudwatch-observability-webhook-service.amazon-cloudwatch
      - amazon-cloudwatch-observability-webhook-service.amazon-cloudwatch.svc
      - amazon-cloudwatch-observability-webhook-service.amazon-cloudwatch.svc.cluster.local
    issuerRef:
      kind: Issuer
      name: amazon-cloudwatch-observability-selfsigned-issuer
    secretName: amazon-cloudwatch-observability-controller-manager-service-cert
    subject:
      organizationalUnits:
        - amazon-cloudwatch-observability
  ---

  apiVersion: cert-manager.io/v1
  kind: Certificate
  metadata:
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
    name: "amazon-cloudwatch-observability-agent-cert"
    namespace: amazon-cloudwatch
  spec:
    dnsNames:
      - "dcgm-exporter-service"
      - "dcgm-exporter-service.amazon-cloudwatch.svc"
      - "neuron-monitor-service"
      - "neuron-monitor-service.amazon-cloudwatch.svc"
    issuerRef:
      kind: Issuer
      name: "agent-ca"
    secretName: "amazon-cloudwatch-observability-agent-cert"
  ---

  apiVersion: cert-manager.io/v1
  kind: Issuer
  metadata:
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
    name: amazon-cloudwatch-observability-selfsigned-issuer
    namespace: amazon-cloudwatch
  spec:
    selfSigned: { }
  ---

  apiVersion: cert-manager.io/v1
  kind: Issuer
  metadata:
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
    name: "agent-ca"
    namespace: amazon-cloudwatch
  spec:
    selfSigned: { }
  ---

  apiVersion: admissionregistration.k8s.io/v1
  kind: MutatingWebhookConfiguration
  metadata:
    annotations:
      cert-manager.io/inject-ca-from: amazon-cloudwatch/amazon-cloudwatch-observability-serving-cert
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
    name: amazon-cloudwatch-observability-mutating-webhook-configuration
  webhooks:
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /mutate-cloudwatch-aws-amazon-com-v1alpha1-instrumentation
    failurePolicy: Ignore
    name: minstrumentation.kb.io
    rules:
    - apiGroups:
      - cloudwatch.aws.amazon.com
      apiVersions:
      - v1alpha1
      operations:
      - CREATE
      - UPDATE
      resources:
      - instrumentations
    sideEffects: None
    timeoutSeconds: 10
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /mutate-cloudwatch-aws-amazon-com-v1alpha1-amazoncloudwatchagent
    failurePolicy: Ignore
    name: mamazoncloudwatchagent.kb.io
    rules:
    - apiGroups:
      - cloudwatch.aws.amazon.com
      apiVersions:
      - v1alpha1
      operations:
      - CREATE
      - UPDATE
      resources:
      - amazoncloudwatchagents
    sideEffects: None
    timeoutSeconds: 10
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /mutate-v1-pod
    failurePolicy: Ignore
    name: mpod.kb.io
    rules:
    - apiGroups:
      - ""
      apiVersions:
      - v1
      operations:
      - CREATE
      - UPDATE
      resources:
      - pods
    sideEffects: None
    timeoutSeconds: 10
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /mutate-v1-namespace
    failurePolicy: Ignore
    name: mnamespace.kb.io
    rules:
    - apiGroups:
      - ""
      apiVersions:
      - v1
      operations:
      - CREATE
      - UPDATE
      resources:
      - namespaces
    sideEffects: None
    timeoutSeconds: 10
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /mutate-v1-workload
    failurePolicy: Ignore
    name: mworkload.kb.io
    rules:
    - apiGroups:
      - apps
      apiVersions:
      - v1
      operations:
      - CREATE
      - UPDATE
      resources:
      - daemonsets
      - deployments
      - statefulsets
    sideEffects: None
    timeoutSeconds: 10
  ---

  apiVersion: admissionregistration.k8s.io/v1
  kind: ValidatingWebhookConfiguration
  metadata:
    annotations:
      cert-manager.io/inject-ca-from: amazon-cloudwatch/amazon-cloudwatch-observability-serving-cert
    labels:
      app.kubernetes.io/name: amazon-cloudwatch-observability
      app.kubernetes.io/instance: amazon-cloudwatch-observability
      app.kubernetes.io/version: "1.0.0"
      app.kubernetes.io/managed-by: "amazon-cloudwatch-agent-operator"
    name: amazon-cloudwatch-observability-validating-webhook-configuration
  webhooks:
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /validate-cloudwatch-aws-amazon-com-v1alpha1-instrumentation
    failurePolicy: Ignore
    name: vinstrumentationcreateupdate.kb.io
    rules:
    - apiGroups:
      - cloudwatch.aws.amazon.com
      apiVersions:
      - v1alpha1
      operations:
      - CREATE
      - UPDATE
      resources:
      - instrumentations
    sideEffects: None
    timeoutSeconds: 10
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /validate-cloudwatch-aws-amazon-com-v1alpha1-instrumentation
    failurePolicy: Ignore
    name: vinstrumentationdelete.kb.io
    rules:
    - apiGroups:
      - cloudwatch.aws.amazon.com
      apiVersions:
      - v1alpha1
      operations:
      - DELETE
      resources:
      - instrumentations
    sideEffects: None
    timeoutSeconds: 10
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /validate-cloudwatch-aws-amazon-com-v1alpha1-amazoncloudwatchagent
    failurePolicy: Ignore
    name: vamazoncloudwatchagentcreateupdate.kb.io
    rules:
    - apiGroups:
      - cloudwatch.aws.amazon.com
      apiVersions:
      - v1alpha1
      operations:
      - CREATE
      - UPDATE
      resources:
      - amazoncloudwatchagents
    sideEffects: None
    timeoutSeconds: 10
  - admissionReviewVersions:
    - v1
    clientConfig:
      service:
        name: amazon-cloudwatch-observability-webhook-service
        namespace: amazon-cloudwatch
        path: /validate-cloudwatch-aws-amazon-com-v1alpha1-amazoncloudwatchagent
    failurePolicy: Ignore
    name: vamazoncloudwatchagentdelete.kb.io
    rules:
    - apiGroups:
      - cloudwatch.aws.amazon.com
      apiVersions:
      - v1alpha1
      operations:
      - DELETE
      resources:
      - amazoncloudwatchagents
    sideEffects: None
    timeoutSeconds: 10
  \`\`\`
  </details>

  <p></p>

- Create \`configMap\` by
  \`\`\`shell
  ClusterName='kub-dep-demo'
  RegionName='ap-northeast-2'

  cat create-cloudwatch.yml | sed 's/{{cluster_name}}/'\${ClusterName}'/g;s/{{region_name}}/'\${RegionName}'/g' | kubectl apply -f -
  \`\`\`

- Delete \`configMap\` by: 
  \`\`\`shell
  ClusterName='kub-dep-demo'
  RegionName='ap-northeast-2'

  cat create-cloudwatch.yml | sed 's/{{cluster_name}}/'\${ClusterName}'/g;s/{{region_name}}/'\${RegionName}'/g' | kubectl delete -f -
  # curl https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/main/k8s-quickstart/cwagent-custom-resource-definitions.yaml | kubectl delete -f -
  \`\`\`

- Now go to \`cloudwatch\`, the logging will be exactly the same as usual ***ECS*** or ***Lambda***:

  ![](/assets/img/2024-06-30-19-55-03.png)`;export{n as default};
