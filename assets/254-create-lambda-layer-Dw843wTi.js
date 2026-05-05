const n=`---
title: "Create Custom Layer for Lambda Functions in Python"
date: 2024-04-12
id: blog0254
tag: aws
intro: "We record a standard procedure to create a custom layer for 3rd party libraries."
toc: false
---


- Note that \`aws-xray-sdk\` is not a natively supported package in lambda.

- Let's create a layer in order to make \`aws-xray-sdk\` importable into our lambda function in python.

- Make sure we have conda installed, and put 
  \`\`\`text
  source ~/anaconda3/etc/profile.d/conda.sh
  \`\`\`
  in our \`~/.bashrc\`, this is to make sure \`conda\` is identifiable as a executable command.

1. Open an empty folder and \`cd\` into it

2. \`pip install -t $(pwd) aws-xray-sdk\`

    ![](/assets/img/2024-04-05-00-53-08.png)

3. Create a new folder named \`python\`, drag all package related files into it, and zip that \`python\` folder

    ![](/assets/img/2024-04-05-00-56-15.png)

4. Go to Layers and click \`Create Layer\`

    ![](/assets/img/2024-04-05-01-06-23.png)

5. Upload the \`zip\` file and we are ready to go.

    ![](/assets/img/2024-04-05-01-07-02.png)

6. Test the import statement which originally throwed error without our additional layer:

    ![](/assets/img/2024-04-05-01-15-58.png)

    \`\`\`python
    import json
    from aws_xray_sdk.core import xray_recorder

    def lambda_handler(event, context):
        # TODO implement
        return {
            'statusCode': 200,
            'body': json.dumps('Hello from Lambda!')
        }
    \`\`\``;export{n as default};
