const n=`---
title: "Lambda Function Running Python Docker Image"
date: 2024-11-06
id: blog0337
tag: lambda, docker, aws, python
toc: true
intro: "We discuss how to create a lambda function that executes in docker container to get around the 250MB size limit."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Repository 

- https://github.com/machingclee/2024-11-05-lang-chain-and-deploy-study

### Summary

- Dependencies are installed in docker image, size is not an issue any more.

- We can build a Flask app as usual, and then create a \`wsgi_handler.py\` that wrap the \`Flask\`'s \`app\` object as a lambda handler, after that, we are done!

- I have intensionally installed huge packages which results in a docker image of size 725MB, and such an image have cold-start for 3s only!

  [![](/assets/img/2024-11-06-03-57-42.png)](/assets/img/2024-11-06-03-57-42.png)

### serverless.yml

\`\`\`yml
service: llm-trial

provider:
  name: aws
  region: ap-southeast-2
  stage: dev
  timeout: 900
  iam:
    role:
      name: \${self:service}-\${self:provider.stage}-role
  environment:
    AZURE_OPENAI_API_KEY:
    AZURE_OPENAI_ENDPOINT:
    PROXY_CURL:
  ecr:
    images:
      llm-trial:
        path: ./

functions:
  api:
    image:
      name: llm-trial
    timeout: 900
    events:
      - http: ANY /
      - http: ANY /{proxy+}

custom:
  pythonRequirements:
    dockerizePip: true
    slim: true
    noDeploy:
      - pip
      - autopep8
      - debugpy

package:
  exclude:
    - node_modules/**
    - .dockerignore
    - Dockerfile
    - docker-compose*
\`\`\`

### wsgi_handler.py
\`\`\`py
from aws_lambda_wsgi import response
from src.main import app  # Import your Flask app

def lambda_handler(event, context):
    return response(app, event, context)
\`\`\`

### Dockerfile
\`\`\`dockerfile
FROM public.ecr.aws/lambda/python:3.10
WORKDIR /var/task
COPY . .
ENV PYTHONPATH=/var/task

RUN yum install -y \\
    gcc \\
    gcc-c++ 
RUN pip install --no-cache-dir -r requirements.txt
RUN yum remove -y gcc gcc-c++ && \\
    yum clean all

CMD ["wsgi_handler.lambda_handler"]
\`\`\``;export{n as default};
