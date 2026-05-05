const n=`---
title: Deletion of a VPC with Dangling/Orphaned ENIs
date: 2025-05-21
id: blog0397
tag: terraform
toc: true
intro: "We discuss how to remove a VPC completely when dangling ENIs remain there."
---


<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px
  }
</style>


### Root Cause of Dangling ENIs

Assume that a function has been assigned a VPC config using a security group id \`sg_id\` and private subnet ids \`[subnet_id_1, subnet_id_2,subnet_id_3]\`, then a dangling ENI happens when we **_delete the lambda function directly_**.

### Correct Procedure to Delete a Lambda Function

#### Case 1. Lambda is created from cloudformation stack

- Delete the cloudfromation stack.

- Make sure to empty the S3 bucket first because the deletion of cloudformation stack does not help us empty the bucket, causing a failure in the deletion process.

#### Case 2. Otherwise

- **_Step 1._** Remove the VPC configuration
- **_Step 2._** Wait until AWS asynchronously deletes the ENI given that:

  - **Rule 1.** All published versions \`:n\` for $n\\in\\mathbb N$ that have VPC configuration **_are deleted_**

  - **Rule 2.** The latest version \`$:latest\` has no VPC configuration

  Violation of either one of the rules will prevent AWS from releasing the ENI, keeping the ENI in \`in-use\` state and undeletable.

No matter a function is in case 1 or case 2, we can remove the ENI in the following manner:

#### Unified approach to delete ENI by keeping only the lambda functions\\:latest

Assume that we are going to destroy the entire VPC (including its resources), at some point we will be blocked by dangling ENIs. Now we delete and update functions that are using those ENIs.

First we borrow a script from AWS official repository[^official-repo-aws]:

[^official-repo-aws]: \`cd\` into \`Lambda/FindEniMappings/\` of [aws-support-tools](https://github.com/awslabs/aws-support-tools.git)

##### Step 1: Find all functions that are using the ENI

- We create a file called: \`findEniAssociations\` (see the code detail in footnote[^awsscript], no file extension here).

[^awsscript]:
    Shell script to get a list of lambda functions using the target ENI:

    \`\`\`bash
    #!/bin/bash
    # Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

    # SPDX-License-Identifier: MIT-0

    # jq is required for this script to work, exit if it isn't present

    which jq &> /dev/null
    if [ $? -ne 0 ]
    then
    echo "The json parsing package 'jq' is required to run this script, please install it before continuing"
    exit 1
    fi

    set -e #fail if any of our subcommands fail
    printf "This script is for determining why an ENI that is managed by AWS Lambda has not been deleted.\\n\\n"

    # take the region and the ENI id as parameters

    POSITIONAL=()
    while [[$# -gt 0]]
    do
    key="$1"

    case $key in
      --eni)
      ENI="$2"
      shift # past argument
      shift # past value
      ;;
      --region)
      REGION="$2"
      shift # past argument
      shift # past value
      ;;
    esac
    done
    set -- "\${POSITIONAL[@]}" # restore positional parameters

    # Both parameters are required, fail if they are absent

    if [ -z $ENI ] && [ -z $REGION ];
    then
    echo "Both --eni and --region are required"
    exit 1
    elif [ -z $ENI ]
    then
    echo "--eni is required"
    exit 1
    elif [ -z $REGION ]
    then
    echo "--region is required"
    exit 1
    fi

    # search for the ENI to get the subnet and security group(s) it uses

    METADATA="$(aws ec2 describe-network-interfaces --network-interface-ids \${ENI} --filters Name=network-interface-id,Values=\${ENI} --region \${REGION} --output json --query 'NetworkInterfaces[0].{Subnet:SubnetId,SecurityGroups:Groups[*].GroupId}')"

    read Subnet < <(echo $METADATA | jq -ar '.Subnet')
    SecurityGroups=()
    for row in $(echo $METADATA | jq -ar '.SecurityGroups[]')
    do
      SecurityGroups+=(\${row})
    done

    # Sort the list of SGs, so that we can easily compare with the list from a Lambda function

    IFS=$'\\n' SortedSGs=($(sort <<<"\${SecurityGroups[*]}"))
    unset IFS
    #convert Subnet to "echo-able", if $Subnet is used directly, GitBash skips the call outputting: ' using Security Groups "sg-012345example" '
    SUBNET_STRING=$(echo $Subnet)
    echo "Found "\${ENI}" with $SUBNET_STRING using Security Groups" \${SortedSGs[@]}
    echo "Searching for Lambda function versions using "$SUBNET_STRING" and Security Groups" \${SortedSGs[@]}"..."

    # Get all the Lambda functions in an account that are using the same subnet, including versions

    Functions=()
    Response="$(aws lambda list-functions --function-version ALL --max-items 1000 --region \${REGION} --output json --query '{"NextToken": NextToken, "VpcConfigsByFunction": Functions[?VpcConfig!=\`null\` && VpcConfig.SubnetIds!=\`[]\`] | [].{Arn:FunctionArn, Subnets:VpcConfig.SubnetIds, SecurityGroups: VpcConfig.SecurityGroupIds} | [?contains(Subnets, \`'$Subnet'\`) == \`true\`] }')"

    # Find functions using the same subnet and security group as target ENI. Use paginated calls to enumerate all functions.

    while : ; do
    NextToken=$(echo $Response | jq '.NextToken')
        for row in $(echo $Response | jq -c -r '.VpcConfigsByFunction[]')
        do
            Functions+=(\${row})
    done
    [[$NextToken != "null"]] || break
    Response="$(aws lambda list-functions --function-version ALL --max-items 1000 --starting-token $NextToken --region \${REGION} --output json --query '{"NextToken": NextToken, "VpcConfigsByFunction": Functions[?VpcConfig!=\`null\` && VpcConfig.SubnetIds!=\`[]\`] | [].{Arn:FunctionArn, Subnets:VpcConfig.SubnetIds, SecurityGroups: VpcConfig.SecurityGroupIds} | [?contains(Subnets, \`'$Subnet'\`) == \`true\`] }')"
    done

    # check if we got any functions with this subnet at all

    if [ $(echo "\${#Functions[@]}") -eq 0 ]
    then
    printf "\\nNo Lambda functions or versions found that were using the same subnet as this ENI.\\nIf this ENI is not deleted automatically in the next 24 hours then it may be 'stuck'. If the ENI will not allow you to delete it manually after 24 hours then please contact AWS support and send them the output of this script.\\n"
    exit 0
    fi
    Results=()
    for each in "\${Functions[@]}"
    do

    # Check if there are any functions that match the security groups of the ENI

    LambdaSGs=()
    for row in $(echo "$each" | jq -ar '.SecurityGroups[]')
    do
    LambdaSGs+=(\${row})
    done

    # Need both lists of SGs sorted for easy comparison

    IFS=$'\\n' SortedLambdaSGs=($(sort <<<"\${LambdaSGs[*]}"))
      unset IFS
      set +e # diff is wierd and returns exit code 1 if the inputs differ, so we need to temporarily disable parent script failure on non-zero exit codes
      diff=$(diff <(printf "%s\\n" "\${SortedSGs[@]}") <(printf "%s\\n" "\${SortedLambdaSGs[@]}"))
    set -e
    if [[-z "$diff"]]; then
    Results+=($(echo "$each" | jq -r '.Arn'))
    fi
    done
    if [ \${#Results[@]} -eq 0 ]; # if we didn't find anything then we need to check if the ENI was modified, as Lambda will still be using it, even if the SGs no longer match
    then
      printf "No functions or versions found with this subnet/security group combination. Searching for manual changes made to the ENI...\\n"
      Changes="$(aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=ModifyNetworkInterfaceAttribute --region \${REGION} --output json --query 'Events[] | [?contains(CloudTrailEvent, \`'$ENI'\`) == \`true\`&& contains(CloudTrailEvent,\`groupId\`) == \`true\`&& contains(CloudTrailEvent,\`errorMessage\`) == \`false\`]')"
    if [ "$(echo $Changes | jq -r 'length')" -gt 0 ]
    then
    printf "\\nChanges were made to this ENI's security group outside of the Lambda control plane. Any Lambda function that pointed to this ENI originally will still be using it, even with changes on the ENI side.\\n\\nThe following functions share the same subnet as this ENI. Any of them that are will need to be disassociated/deleted before Lambda will clean up this ENI. Each of these could potentially be using this ENI:\\n"
    for each in "\${Functions[@]}"
        do
          echo "$each" | jq -r '.Arn'
    done
    else
    printf "\\nNo manual changes to the ENI found. ENIs may take up to 20 minutes to be deleted. If this ENI is not deleted automatically in the next 24 hours then it may be 'stuck'. If IAM roles associated with a VPC Lambda function are deleted before the ENI is deleted, Lambda will not be able to complete the clean-up of the ENI. If the ENI will not allow you to delete it manually after 24 hours then please contact AWS support and send them the output of this script.\\n"
    fi
    else
    printf "\\nThe following function version(s) use the same subnet and security groups as "\${ENI}". They will need to be disassociated/deleted before Lambda will clean up this ENI:\\n"
      printf "%s\\n" "\${Results[@]}"
    fi
    \`\`\`

- Now we execute

  \`\`\`bash
  ./findEniAssociations --eni eni-03a2b666d92cdfd13 --region ap-southeast-2
  \`\`\`

  to get a list of functions using this ENI. In my case I get the following:

  \`\`\`text
  The following function version(s) use the same subnet and security groups as eni-03a2b666d92cdfd13. They will need to be disassociated/deleted before Lambda will clean up this ENI:
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:6
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-E-dev-api:7
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:7
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:8
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:8
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-E-dev-api:8
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:9
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:9
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-E-dev-api:9
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:10
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:10
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:11
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:11
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:12
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:12
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-A-dev-api:13
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-D-dev-api:13
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-A-dev-api:14
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-A-dev-api:15
  ...
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-A-dev-api:39
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-B-dev-api:60
  arn:aws:lambda:ap-southeast-2:798404461798:function:service-C-dev-api:62
  \`\`\`

  **Remark 1.** Any function with an integer \`:n\` is considered as a **_published version_**.

  **Remark 2.** To delete the ENI, we need to delete all published versions and update \`:latest\` version to remove all security id and subnet ids.

##### Step 2: Remove and update lambda functions using the list of functions just obtained in step 1

- Having obtained a list of functions using the ENI, we use the the **_python script_**[^remove-old-and-update-latest] to do the following processes:

  - Delete the published version
  - Update the latest version into _no VPC config_.

[^remove-old-and-update-latest]:
    Python script to delete the published lambda functions and update the latest lambda function:

    \`\`\`python
    import boto3
    import time
    from botocore.exceptions import ClientError

    # Configuration
    REGION = "ap-southeast-2"

    # Set to True to delete published versions specified in FUNCTION_LIST (use with caution)
    # Set to False to skip deleting published versions
    DELETE_PUBLISHED_VERSIONS = True

    # List of Lambda functions with optional versions (as provided by you)
    # Format: "function-name" or "function-name:version"
    FUNCTION_LIST = [
        "service-D-dev-api:13",
        "service-A-dev-api:14",
        "service-A-dev-api:15",
        "service-H-dev-api"
    ]

    # Initialize the Lambda client
    lambda_client = boto3.client('lambda', region_name=REGION)


    def get_unique_function_names(function_list):
        """Extract unique function names from the list, ignoring versions."""
        unique_functions = set()
        for func in function_list:
            func_name = func.split(':')[0]
            unique_functions.add(func_name)
        return list(unique_functions)


    def get_versions_to_delete(function_list):
        """Extract function names and specific versions to delete from the list."""
        versions_to_delete = {}
        for func in function_list:
            if ':' in func:
                func_name, version = func.split(':')
                if func_name not in versions_to_delete:
                    versions_to_delete[func_name] = []
                versions_to_delete[func_name].append(version)
        return versions_to_delete


    def remove_vpc_config(function_name):
        """Remove VPC configuration (SubnetIds and SecurityGroupIds) for the $LATEST version of a Lambda function."""
        try:
            response = lambda_client.update_function_configuration(
                FunctionName=function_name,
                VpcConfig={
                    'SubnetIds': [],
                    'SecurityGroupIds': []
                }
            )
            print(
                f"Successfully removed VPC configuration for {function_name} ($LATEST)")
            return True
        except ClientError as e:
            print(f"Error removing VPC configuration for {function_name}: {e}")
            return False


    def delete_version(function_name, version):
        """Delete a specific version of a Lambda function."""
        try:
            response = lambda_client.delete_function(
                FunctionName=function_name,
                Qualifier=version
            )
            print(f"Successfully deleted version {version} of {function_name}")
            return True
        except ClientError as e:
            print(f"Error deleting version {version} of {function_name}: {e}")
            return False


    def main():
        print("Processing list of Lambda functions to delete old versions and remove VPC configurations...")

        # Extract unique function names for updating $LATEST
        unique_functions = get_unique_function_names(FUNCTION_LIST)

        # Extract versions to delete if DELETE_PUBLISHED_VERSIONS is True
        versions_to_delete = get_versions_to_delete(FUNCTION_LIST)

        print(f"\\nFound {len(unique_functions)} unique Lambda functions to process for VPC configuration removal ($LATEST):")
        print("---------------------------------------------------------------")
        for func in FUNCTION_LIST:
            func_name = func.split(':')[0]
            version = func.split(':')[1] if ':' in func else '$LATEST'
            print(f"Function: {func_name}, Version: {version}")
        print("---------------------------------------------------------------")

        if DELETE_PUBLISHED_VERSIONS:
            print("\\nDeleting published versions as requested...")
            for func_name, versions in versions_to_delete.items():
                for version in versions:
                    delete_version(func_name, version)
                    # Add a small delay to avoid rate limiting
                    time.sleep(2)
        else:
            print("\\nSkipping deletion of published versions. Set DELETE_PUBLISHED_VERSIONS=True to delete specified versions.")

        print("\\nRemoving VPC configurations (SubnetIds and SecurityGroupIds) for $LATEST version of each unique function...")
        for func_name in unique_functions:
            remove_vpc_config(func_name)
            # Add a small delay to avoid rate limiting
            time.sleep(2)

        print("\\nScript completed.")
        print("Note: Only $LATEST version configurations were updated. Published versions retain their original VPC configurations unless deleted.")
        print("ENI cleanup can take 1-2 hours. Check the EC2 console under 'Network Interfaces' for status.")
        print("If the ENI remains 'in use', consider invoking functions to refresh execution environments, deleting additional unused versions, or contacting AWS Support.")


    if __name__ == "__main__":
        main()

    \`\`\`

- Result:

  \`\`\`text
  ...
  Successfully deleted version 39 of service-A-dev-api
  Successfully deleted version 60 of service-B-dev-api
  Successfully deleted version 62 of service-C-dev-api

  Removing VPC configurations (SubnetIds and SecurityGroupIds) for $LATEST version of each unique function...
  Successfully removed VPC configuration for service-D-dev-api ($LATEST)
  Successfully removed VPC configuration for service-E-dev-api ($LATEST)
  Successfully removed VPC configuration for service-C-dev-api ($LATEST)
  Successfully removed VPC configuration for service-D-dev-api ($LATEST)
  Successfully removed VPC configuration for service-B-dev-api ($LATEST)
  Successfully removed VPC configuration for service-A-dev-api ($LATEST)
  \`\`\`

### Oh my Gosh! I Deleted a Lambda Function Accidentally, Causing a Dangling ENI

#### Recovery Strategy

Our strategy is to create a **_placeholder function_** with exactly the same

- \`function-name\`
- \`sg_id\`
- \`subnet_id\`'s.

Being of the same \`sg_id\` and \`subnet_id\`'s will prompt AWS to reuse the same ENI.

Now removing the VPC config of the lambda function (can be by console or \`aws-cli\`) will trigger the ENI removal (when no published version is using the ENI) by AWS[^aws-doc].

[^aws-doc]:
    [Official documention](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html#configuration-vpc-enis) states that

    > When you update a function to remove its VPC configuration, Lambda requires up to 20 minutes to delete the attached Hyperplane ENI. Lambda only deletes the ENI if no other function (or published function version) is using that Hyperplane ENI.

#### Steps to restore the deleted function by a placeholder funciton

1. Create an \`index.js\`:

   \`\`\`js
   exports.handler = async (event) => {
     return { statusCode: 200, body: "OK" };
   };
   \`\`\`

2. zip the file by \`zip function.zip index.js\`

3. Randomly pick a role, and create a function with desired \`sg_id\` and \`subnet_id\`'s:

   \`\`\`bash
   aws lambda create-function \\
     --function-name target-function-name \\
     --runtime nodejs18.x \\
     --role arn:aws:iam::798404461798:role/<random-role> \\
     --handler index.handler \\
     --zip-file fileb://function.zip \\
     --vpc-config "{\\"SubnetIds\\": [\\"subnet_id_1\\", \\"subnet_id_2\\", \\"subnet_id_3\\"], \\"SecurityGroupIds\\": [\\"sg_id\\"]}"
   \`\`\`

4. Delete the VPC config in aws console to trigger the ENI removal.

After 5-10 minutes the ENI will change its state from \`in-use\` to \`Available\`, now we are free to delete them.

### Footnotes
`;export{n as default};
