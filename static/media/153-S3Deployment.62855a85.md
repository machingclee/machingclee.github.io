---
title: "Deployment of React Project Using S3 and Cloudfront"
date: 2023-07-08
id: blog0153
tag: react, aws
intro: "A full breakdown of steps deploying a react project to s3 with SSL encryption."
toc: true
---

#### S3

1. Created a new bucket named `wbbucket-dev-frontend`.

2. In frontend project we run
   ```text
   aws s3 sync --delete ./build/ s3://wbbucket-dev-frontend
   ```
   to sync our files in build folder to s3-bucket.
3. In **Permission** tab:

  <Center>
    <a href="/assets/tech/153/001.png">
      <img src="/assets/tech/153/001.png" width="600"/>
    </a>
  </Center>
  <p/>

  <Center>
    <a href="/assets/tech/153/002.png">
      <img src="/assets/tech/153/002.png"/>
    </a>
  </Center>
  <p/>

4. In **Properties** tab, we scroll to the bottom, click Edit,

  <Center>
    <a href="/assets/tech/153/003.png">
      <img src="/assets/tech/153/003.png" width="600"/>
    </a>
  </Center>
  <p/>

then choose

  <Center>
    <a href="/assets/tech/153/004.png">
      <img src="/assets/tech/153/004.png" width="600"/>
    </a>
  </Center>
  <p/>

#### CloudFront

1. Pricing:
<Center>
  <a href="/assets/tech/153/005.png">
    <img src="/assets/tech/153/005.png"/>
  </a>
</Center>
<p/>

1. Click Create distribution:
<Center>
  <a href="/assets/tech/153/006.png">
    <img src="/assets/tech/153/006.png" width="600"/>
  </a>
</Center>
<p/>
1. S3-buckets by default are among the choices for Origin domain:

  <Center>
    <a href="/assets/tech/153/007.png">
      <img src="/assets/tech/153/007.png"/>
    </a>
  </Center>
  <p/>

3. Once S3-bucket is chosen, aws fills the following:

  <Center>
    <a href="/assets/tech/153/008.png">
      <img src="/assets/tech/153/008.png" width="600"/>
    </a>
  </Center>
  <p/>

4. Check Redirect HTTP to HTTPS
<Center>
  <a href="/assets/tech/153/009.png">
    <img src="/assets/tech/153/009.png" width="600"/>
  </a>
</Center>
<p/>

5. Enable firewall
<Center>
  <a href="/assets/tech/153/010.png">
    <img src="/assets/tech/153/010.png" width="600"/>
  </a>
</Center>

<p/>

6. - Prepare a domain or subdomain in route53
   - Fill in alternate domain name and
   - Choose SSL certificate.

     <Center>
         <a href="/assets/tech/153/011.png">
         <img src="/assets/tech/153/011.png" width="600"/>
         </a>
     </Center>

     <p/>

   For example, I test the s3-deployment by using:

    <p/>
    <Center>
    <a href="/assets/tech/153/012.png">
    <img src="/assets/tech/153/012.png" width="600"/>
    </a>
    </Center>
    <p/>

7. Turn IPv6 Off

  <Center>
      <a href="/assets/tech/153/013.png">
      <img src="/assets/tech/153/013.png"/>
      </a>
  </Center>
  <p/>

#### Route53 to CloudFront

1. Once CloudFront was set up, we have the following "alias"

   <Center>
       <a href="/assets/tech/153/014.png">
       <img src="/assets/tech/153/014.png"/>
       </a>
   </Center>
   <p/>

   we will need the high-lighted id in configuring records in route53.

   Our website is already up and running:

     <Center>
         <a href="/assets/tech/153/015.png">
         <img src="/assets/tech/153/015.png" width="600"/>
         </a>
     </Center>
     <p/>

2. Go to route53, choose hosted zone, and edit our prepared record.

     <Center>
         <a href="/assets/tech/153/016.png">
         <img src="/assets/tech/153/016.png"/>
         </a>
     </Center>
     <p/>

   choose the domain prepared by CloudFront.

#### Cache Removal

1. After first deployment succeeds, we will fail to see new changes due to caching. The removal of cache is called `invalidation` in aws-cli.

2. We list all distributions by `aws cloudfront list-distributions > ./list.json`, we check the target id to remove cache:

   ```json
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
   ```

   By looking at the attribute we are sure `EQ7AXNACL2PQ6` is our target id.

3. ```aws-cli
   aws cloudfront create-invalidation --distribution-id EQ7AXNACL2PQ6 --paths "/*"
   ```

4. In frontend the complete deployment script becomes:

   ```json
    "scripts": {
       "build:uat": "env-cmd -f .env.uat  react-app-rewired build",
       "invalidation:uat": "aws cloudfront create-invalidation --distribution-id EQ7AXNACL2PQ6 --paths \"/*\" > ./invalidation.json",
       "deploy:uat": "yarn build:uat && yarn invalidation:uat && aws s3 sync --delete ./build/ s3://wbbucket-dev-frontend",
       ...
     },
   ```

   In `invalidation:uat` will pipe the output into a file to avoid the console prompting user input.
