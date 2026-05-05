const e=`---
title: "Redirect from 3rd-party Subdomain (WIX in our example) to AWS Cloudfront Distribution Where we host our Frontend"
date: 2024-12-22
id: blog0350
tag: domain-transfer, cloudfront, aws
toc: true
intro: "Given that a domain is brought from third-party DNS provider, we study how to route the traffic to our cloudfront distribution."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### What Problem to Solve?

- Our react pages are served by \`S3\` and \`Cloudfront\`. For a complete guide how to deploy it from scratch the reader can see [my blog post](/blog/article/Deployment-of-React-Project-Using-S3-and-Cloudfront).

- If our domain is bought inside of aws \`Route53\`, there is a natural linkage from the GUI of \`Route53\` in aws console to route all traffic from our sub-domain to our aws resource (cloudfront).

- **_Unfortunately_** if our domain is bought from other services such as go-daddy or wix.com, we will need the steps in the next section.

### External Sub-domain to Cloudfront Distribution

Assume that we have deployed a webpage using cloudfront, the main target is to set the **_alternative domain name_**:

[![](/assets/img/2024-12-22-01-37-08.png)](/assets/img/2024-12-22-01-37-08.png)

Let's achieve this target in the following steps:

#### Update cloudfront distribution
1. When updating the distribution setting there are two (and only two) inputs that are ***not available for the moment***:

    [![](/assets/img/2024-12-22-01-37-15.png)](/assets/img/2024-12-22-01-37-15.png)

    They are respectively:
    - The desired alternative domain name;
    - A certificate authroized to the 3rd party DNS provider 
        
    
    For the moment please leave both the *Alternative Domain Name* and the *Custom SSL Certifiacte* ***blank***. In step 3 below we will be
      1. Verifying we own the domain (and thereby turning the certificate into valid state)

      2. Then we can add CName record which route traffic from Alternative Domain Name to our cloudfront distribution
    
    After that we can fill in the blank options.

   

   

#### Request certificate, what is CNAME, CNAME Name and CNAME Value by the way?

2. Click **request certificate**, a certificate in pending validation state will be created for us with the following attributes:

    [![](/assets/img/2024-12-22-01-37-23.png)](/assets/img/2024-12-22-01-37-23.png)

    Here:
      - ***CNAME (Canonical Name)*** is a type of DNS record that allows us to create an alias from one domain name to another domain name. 
      - ***CNAME Name*** is the domain name we need to create in our DNS records.
      - ***CNAME Value*** is the value that the CNAME record should point to.


#### Add CName records into 3rd Party DNS record mangement console


3. In our 3rd party DNS record management console:
   - ***Firstly***, add a cname record that is required to prove to AWS that we have the control over the domain  (in order for our requested certificate to change from \`pending state\` to \`valid state\`).

      ![](/assets/img/2024-12-22-01-59-06.png)

      Be careful that strings provided from aws has an **extra period** \`.\` **at the end**, which we will **need to remove** when copying into 3rd party service provider records.
   - ***Secondly*** we need to add a cname record to redirect a subdomain to our cloudfront distribution

      ![](/assets/img/2024-12-22-01-51-05.png)


#### Adjust alternative domain name after cert-validation is completed

4. Just wait our certificate to be validated, then we can return to step 1 and update the alternative domain name successfully:

   [![](/assets/img/2024-12-22-01-37-39.png)](/assets/img/2024-12-22-01-37-39.png)

####  Verify DNS records are propagated (may take 10-15 minutes)

5. It takes 10 - 15 minutes to propagate the DNS records. To validate our routing is updated successfully, we can:

   \`\`\`sh
   dig @8.8.8.8 web.******.construction (google DNS records)
   # or
   dig @1.1.1.1 web.******.construction (cloudflare DNS records)
   \`\`\`

   Let's take \`8.8.8.8\` as an example, a successful redirection should see:

   \`\`\`sh
   ;; ANSWER SECTION:
   web.******.construction. 3600	IN	CNAME	d12**********.cloudfront.net.
   d12**********.cloudfront.net. 60 IN	A	13.35.186.104
   d12**********.cloudfront.net. 60 IN	A	13.35.186.62
   d12**********.cloudfront.net. 60 IN	A	13.35.186.15
   d12**********.cloudfront.net. 60 IN	A	13.35.186.28
   \`\`\`

   If the \`ANSWER SECTION\` is correct (at this stage our DNS may still not be correctly resolved yet), then we are all done, just wait.
`;export{e as default};
