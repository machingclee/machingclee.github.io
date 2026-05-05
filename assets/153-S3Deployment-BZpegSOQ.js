const n=`---
title: "Deployment of React Project Using S3 and Cloudfront"
date: 2023-07-08
id: blog0153
tag: react, aws
intro: "A full breakdown of steps deploying a react project to s3 with SSL encryption."
toc: true
---

<style>
  img{
    max-width: 660px
  }
</style>

### S3

1. Created a new bucket named \`wbbucket-dev-frontend\`.

2. In frontend project we run
   \`\`\`text
   aws s3 sync --delete ./build/ s3://wbbucket-dev-frontend
   \`\`\`
   to sync our files in build folder to s3-bucket.
3. In **Permission** tab:
   ![](/assets/img/2024-01-24-01-04-15.png)

   ![](/assets/img/2024-01-24-01-04-58.png)

   Here

   \`\`\`json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "Statement1",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::wb-admin-frontend/*"
       }
     ]
   }
   \`\`\`

4. In **Properties** tab, we scroll to the bottom, click Edit,

   ![](/assets/img/2024-01-24-01-06-31.png)

   then choose

   ![](/assets/img/2024-01-24-01-06-49.png)

### CloudFront

1.  Pricing:

    ![](/assets/img/2024-01-24-01-07-22.png)

2.  Click Create distribution:

    ![](/assets/img/2024-01-24-01-08-32.png)

3.  S3-buckets by default are among the choices for Origin domain:

    ![](/assets/img/2024-01-24-01-09-03.png)

4.  Once S3-bucket is chosen, aws fills the following:

    ![](/assets/img/2024-01-24-01-26-35.png)

5.  Check Redirect HTTP to HTTPS

    ![](/assets/img/2024-01-24-01-27-00.png)

6.  Enable firewall, note that this we charge for AWF service, if you are certain your react page has almost no backend behind the scene, we can choose not to enable security protections.

    ![](/assets/img/2024-01-24-01-27-22.png)

7.  - Prepare a domain or subdomain in route53
    - Fill in alternate domain name and
    - Choose SSL certificate.

      ![](/assets/img/2024-01-24-01-28-46.png)

      For example, I test the s3-deployment by using:

      ![](/assets/img/2024-01-24-01-29-11.png)

8.  Turn IPv6 Off

    ![](/assets/img/2024-01-24-01-29-34.png)

### Route53 to CloudFront

1.  Once CloudFront was set up, we have the following "alias"

    ![](/assets/img/2024-01-24-01-29-57.png)

    we will need the high-lighted id in configuring records in route53.

    Our website is already up and running:

    ![](/assets/img/2024-01-24-01-30-26.png)

2.  Go to route53, choose hosted zone, and edit our prepared record.

    ![](/assets/img/2024-01-24-01-30-44.png)

    choose the domain prepared by CloudFront.

### Cache Removal

1. After first deployment succeeds, we will fail to see new changes due to caching. The removal of cache is called \`invalidation\` in aws-cli.

2. We list all distributions by \`aws cloudfront list-distributions > ./list.json\`, we check the target id to remove cache:

   \`\`\`json
   {
       "DistributionList": {
           "Items": [
               {...
               },
               {...
               },
               {
                   "Id": "EQ7AXNACL2PQ6",
                   "ARN": "arn:aws:cloudfront::798404461798:distribution/EQ7AXNACL2PQ6",
                   "Status": "Deployed",
                   "LastModifiedTime": "2023-07-06T06:29:17.206000+00:00",
                   "DomainName": "d1i8cgdq44oar0.cloudfront.net",
                   "Aliases": {
                       "Quantity": 1,
                       "Items": [
                           "wb-admin-s3-test.wonderbricks.com"
                       ]
                   },
                   "Origins": {
                       "Quantity": 1,
                       "Items": [
                       ...
               }
   \`\`\`

   By looking at the attribute we are sure \`EQ7AXNACL2PQ6\` is our target id.

3. \`\`\`aws-cli
   aws cloudfront create-invalidation --distribution-id EQ7AXNACL2PQ6 --paths "/*"
   \`\`\`

4. In frontend the complete deployment script becomes:

   \`\`\`json
    "scripts": {
       "build:uat": "env-cmd -f .env.uat  react-app-rewired build",
       "invalidation:uat": "aws cloudfront create-invalidation --distribution-id EQ7AXNACL2PQ6 --paths \\"/*\\" > ./invalidation.json",
       "deploy:uat": "yarn build:uat && yarn invalidation:uat && aws s3 sync --delete ./build/ s3://wbbucket-dev-frontend",
       ...
     },
   \`\`\`

   In \`invalidation:uat\` will pipe the output into a file to avoid the console prompting user input.
`;export{n as default};
