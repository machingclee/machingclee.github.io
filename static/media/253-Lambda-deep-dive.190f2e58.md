---
title: "More About Lambda Functions, Thottling, Concurrency, RDS Proxy and Integration with CloudWatch Events"
date: 2024-04-04
id: blog0253
tag: AWS
intro: "We study the concurrency models in lambda functions to avoid unexpected failure."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Concurrency 
##### Unreserved Concurrency

- Free for all functions in $\displaystyle \frac{\text{account}}{\text{region}}$.

- If one function concumes all concurrency, the others will get throttled.


##### Reserved Concurrency

- This is the ***number of containers*** allowed to run concurrently for a specific lambda function.

- This number is taken away from the unreserved concurrency pool.

- You can use reserved concurrency to ***minimize*** or ***maximize*** the processing rate.

- By default, the maximum number of concurrency is set to 1000, but that ***doesn't mean*** you are allowed to  spawn 1000 containers by default.

- By default my applied account-level quota value ***is just 10***.

  [![](/assets/img/2024-04-04-21-11-39.png)](/assets/img/2024-04-04-21-11-39.png)


- To get the maximum number of concurrency we need to request it from:

  ![](/assets/img/2024-04-04-21-32-42.png)

- Go to `Monitor` > `Throttles`, which counts the number of function invokation that is beyond the concurrency limit. If it is **not** intentionally done to rate limit an api endpoint, then **any positive value is an alarm**.

  ![](/assets/img/2024-04-04-21-20-23.png)

  For experiment, in this picture we have 3 counts beyond the `concurrency limit` (which is set to be 0).

- We can also monitor the number of **concurrent execution** to adjust the configuration of max number of concurrency:

  ![](/assets/img/2024-04-04-21-24-41.png)

##### Provisioned Concurrency

- As with reserved concurrency, it also subtracts from unreserved concurrency pool.

- It is a pool of concurrency that is **always on** (for optimal latency).

- Very **Expensive**.

- It supports autoscaling group policies.


#### Create a Custom Layer (aws-xray-sdk)

- Note that `aws-xray-sdk` is not a natively supported package in lambda.

- Let's create a layer in order to make `aws-xray-sdk` importable into our lambda function in python.

- Make sure we have conda installed, and put 
  ```text
  source ~/anaconda3/etc/profile.d/conda.sh
  ```
  in our `~/.bashrc`, this is to make sure `conda` is identifiable as a executable command.

1. Open an empty folder and `cd` into it

2. `pip install -t $(pwd) aws-xray-sdk`

    ![](/assets/img/2024-04-05-00-53-08.png)

3. Create a new folder named `python`, drag all package related files into it, and zip that `python` folder

    ![](/assets/img/2024-04-05-00-56-15.png)

4. Go to Layers and click `Create Layer`

    ![](/assets/img/2024-04-05-01-06-23.png)

5. Upload the `zip` file and we are ready to go.

    ![](/assets/img/2024-04-05-01-07-02.png)

6. Test the import statement which originally throwed error without our additional layer:

    ![](/assets/img/2024-04-05-01-15-58.png)

    ```python
    import json
    from aws_xray_sdk.core import xray_recorder

    def lambda_handler(event, context):
        # TODO implement
        return {
            'statusCode': 200,
            'body': json.dumps('Hello from Lambda!')
        }
    ```

#### Database Proxies for RDS

- Lambda functions are executed inside a container, and when concurrency reaches to some level, the database is unable to handle large amount of concurrent requests for new connections

- RDS Proxy helps minimize the number of requests for new connections unless it is necessary:

  ![](/assets/img/2024-04-05-01-38-01.png)


#### CloudWatch Events with Lambda

- Choose `CloudWatch` and then choose `Rules`:

  ![](/assets/img/2024-04-05-02-08-06.png)

- Give it a name and choose `Schedule`, we will be redirected to EventBridge Scheduler page:

  ![](/assets/img/2024-04-05-02-09-16.png)

- Choose `Recurring schedule` and we are led to define a `cron expression`:

  ![](/assets/img/2024-04-05-02-10-19.png)

- A list of templates and experiments on the `cron expression`:

  - https://crontab.guru/

- Choose Lambda Invokation as a target and complete the invokation payload:

  ![](/assets/img/2024-04-05-02-18-51.png)