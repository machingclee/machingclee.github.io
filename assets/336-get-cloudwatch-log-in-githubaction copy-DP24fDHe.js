const e=`---
title: "Github Action: Docker Action in Python to get Artifact of CloudWatch Logging"
date: 2024-11-05
id: blog0336
tag: github-actions
toc: true
intro: "Installing python and executing a python script with argument can be tedious to teammates who are not used to python. The same siutation can apply to all other languages, let's simplify the execution by doing it on github actions."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Results
#### Selection List in Workflow Dispatch
[![](/assets/img/2024-11-06-03-37-39.png)](/assets/img/2024-11-06-03-37-39.png)

[![](/assets/img/2024-11-06-03-37-44.png)](/assets/img/2024-11-06-03-37-44.png)

#### Download the Artifact

![](/assets/img/2024-11-07-02-46-38.png)

### The Project Structure

Unlike javascript action, this time we don't implement an \`action.yml\` to organize the input variables:

<center>
<img src="/assets/img/2024-11-06-03-28-03.png">
</center>

For an example of javascript action, reader may refer to [Github Action for Deployment on ECS Fargate](/blog/article/Github-Action-for-Deployment-on-ECS-Fargate)) where you can see that  \`action.yml\` is used to interact with the \`with\` part of each step in a job.

### .github/actions/get-cloudwatch-log/Dockerfile
\`\`\`dockerfile
FROM realsalmon/alpinelinux-python-boto3

COPY get_log.py /get_log.py 

CMD ["python", "/get_log.py"]
\`\`\`

### .github/actions/get-cloudwatch-log/get_log.py


\`\`\`py-1{16-20}
import boto3
import os
from datetime import datetime, timezone, timedelta

def text_transform(text):
    try:
        return text.encode().decode("unicode_escape").replace("\\t", " ")
    except Exception as e:
        print(f"{e}")


def timestamp_transform(timestamp_ms):
    return datetime.fromtimestamp(timestamp_ms/1000).strftime("%Y-%m-%d %H:%M:%S")


def convert_to_utc8(timestamp_ms):
    dt = datetime.fromtimestamp(timestamp_ms/1000, tz=timezone.utc)
    tz_utc8 = timezone(timedelta(hours=8))
    dt_utc8 = dt.astimezone(tz_utc8)
    return dt_utc8.strftime("%Y-%m-%d %H:%M:%S")
\`\`\`
- By default the timestamp transformed from \`boto3\`'s millisecond via \`datetime\` package in python will be converted to the timezone that the github action worker machine lies in. 

- To convert back to \`UTC+8\` we need to manually adjust the timezone, otherwise we get a time 8 hours before.
\`\`\`py-21{68}
def getter(obj, key, default_value):
    value = None
    try:
        v = obj[key]
        if v is not None:
            value = v
        else:
            raise Exception("cannot be None")
    except Exception as e:
        value = default_value
    return value

def main():
    LOG_GROUP = os.environ["LOG_GROUP"]
    FROM_TIMESTAMP = os.environ["START_FROM"].strip()
    END_TIMESTAMP = None
    REGION_NAME = "ap-southeast-2"
    N = 10

    client = boto3.client('logs', region_name=REGION_NAME)

    # Determine if I should
    should_end = False
    if LOG_GROUP is None:
        print("Argument: --log_group= \\tFor example: //ecs/billie-chat-prod, ('/' will be resolved into local file system in git-bash)")
        should_end = True
    else:
        LOG_GROUP = LOG_GROUP.replace("//", "/")

    if FROM_TIMESTAMP is None:
        print("Argument: --start= \\texample: \\"2024-05-09 12:00:00\\" in your local time")
        print("Argument: --end= \\tis optional and the default is set to be current")
        should_end = True
    else:
        dt = datetime.strptime(FROM_TIMESTAMP, '%Y-%m-%d %H:%M:%S')
        tz = timezone(timedelta(hours=8))
        dt = dt.replace(tzinfo=tz)
        FROM_TIMESTAMP = int(dt.timestamp()*1000)
        END_TIMESTAMP = int(datetime.strptime(END_TIMESTAMP, '%Y-%m-%d %H:%M:%S').timestamp()*1000) \\
            if END_TIMESTAMP is not None \\
            else int(datetime.now().timestamp()*1000)
    if should_end is True:
        return

    print("LOG_GROUP\\t", LOG_GROUP)
    print("TIMESTAMP\\t", FROM_TIMESTAMP, ">>", END_TIMESTAMP)
    
    FILE_DIR = "/github/workspace"
\`\`\`
- The highlighted directory inside of the container will be bind-mounted to the working directory of the github action.

- In other words, a file saved at \`/github/workspace/haha.txt\` inside of the container will be available to the remaining step of the job outside of the container (at the root project level).
\`\`\`py-70
    if not os.path.exists(FILE_DIR):
        os.makedirs(FILE_DIR)

    log_group_name = LOG_GROUP

    log_streams = client.describe_log_streams(
        logGroupName=log_group_name,
        orderBy="LastEventTime",
        descending=True
    )

    log_stream_names = [desc["logStreamName"]
                        for desc in log_streams["logStreams"]][0: N][::-1]
    i = 0
    
    SAVE_DESTINIATION = f"{FILE_DIR}/result.log"

    if os.path.exists(SAVE_DESTINIATION):
        os.unlink(SAVE_DESTINIATION)

    with open(SAVE_DESTINIATION, "a+", encoding="utf8") as file:
        for log_stream_name in log_stream_names:
            i += 1
            print()
            print(f"Downloading [{i}-th stream: {log_stream_name}] ...")
            response = {"nextForwardToken": None}
            started = False
            page = 0
            n_lines = 0
            while started is False or response['nextForwardToken'] is not None:
                started = True
                page += 1

                karg = {} if response['nextForwardToken'] is None else {
                    "nextToken": response['nextForwardToken']}
                response = client.get_log_events(
                    startTime=FROM_TIMESTAMP,
                    endTime=END_TIMESTAMP,
                    logGroupName=log_group_name,
                    logStreamName=log_stream_name,
                    startFromHead=True,
                    **karg
                )
                data = response["events"]
                data = sorted(data, key=lambda datum: datum["timestamp"])
                data_ = [{"timestamp": convert_to_utc8(
                    datum["timestamp"]), "message": text_transform(datum["message"])} for datum in data]
                if len(data_) == 0:
                    if page > 1:
                        print()
                    print("No more data for the current stream")
                    break
                n_lines += len(data_)
                print(
                    f"Loading Page {page}, accumulated: {n_lines} lines                              ", end="\\r")
                for datum in data_:
                    print("datum", datum)
                    line = getter(datum, "timestamp", "") + " |" + \\
                        "\\t" + getter(datum, "message", "") + "\\n"
                    file.write(line)
                    


if __name__ == "__main__":
    main()
\`\`\`

### .github/workflows/cloudwatch_logging.yml with Retention Period
\`\`\`yml
name: 'Get Cloudwatch Logging'
on:
  workflow_dispatch:
    inputs:
      log_group:
        description: 'Select a Log Group'
        required: true
        default: '/ecs/billie-chat-dev'
        type: choice
        options:
          - /aws/lambda/nodejs-billie-report-excel-lambda-dev-api
          - /aws/lambda/nodejs-billie-report-excel-lambda-prod-api
          - /aws/lambda/nodejs-billie-report-excel-lambda-uat-api
          - /aws/lambda/nodejs-billie-walk-pdf-lambda-docker-prod-api
          - /aws/lambda/nodejs-billie-walk-pdf-lambda-docker-uat-api
          - /aws/lambda/revenue-cat-prod
          - /aws/lambda/revenue-cat-trial
          - /aws/lambda/revenue-cat-uat
          - /aws/lambda/wb-live-session-excel-generator-prod-api
          - /aws/lambda/wb-live-session-excel-generator-uat-api
          - /ecs/billie-chat-dev
          - /ecs/billie-chat-poc
          - /ecs/billie-chat-prod
          - /ecs/billie-chat-uat
      start_from:
        type: string
        description: "From Time in the format: 2024-11-01 11:20:00"
        required: true
        
jobs:
  logging:
    runs-on: ubuntu-latest
    environment: deployment
    env:
      AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
    steps:
    - name: Get Code
      uses: actions/checkout@v4
      with:
        ref: main
        fetch-depth: 1   
    - name: Run Docker Action
      run: |
        docker build -t get-cloudwatch-log .github/actions/get-cloudwatch-log
        docker run --user root \\
        -v "\${{ github.workspace }}":/github/workspace:rw \\
        -e AWS_ACCESS_KEY_ID="\${{ env.AWS_ACCESS_KEY_ID }}" \\
        -e AWS_SECRET_ACCESS_KEY="\${{ env.AWS_SECRET_ACCESS_KEY }}" \\
        -e LOG_GROUP="\${{ github.event.inputs.log_group }}" \\
        -e START_FROM="\${{ github.event.inputs.start_from }}" \\
        get-cloudwatch-log
    - name: Upload Artifact
      uses: actions/upload-artifact@v3
      with:
        name: Get Resulting Log
        path: result.log
        retention-days: 5
\`\`\``;export{e as default};
