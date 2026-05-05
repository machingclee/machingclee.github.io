const e=`---
title: "Gmail and Inbox Push Notification"
date: 2023-07-17
id: blog0155
tag: google-cloud
intro: "A introduction of OAuth2 Consent Setting and Pubsub for publishing update of gmail inbox."
toc: true
---

<style>
img {
   max-width: 100%; 
}
</style>

### Create a Projects to use These two Services

- Go to google cloud console https://console.cloud.google.com/

- Click

  ![](/assets/tech/155/001.png)

- Create a project

  ![](/assets/tech/155/002.png)

- Choose the service

  ![](/assets/tech/155/003.png)

  In our case we need

  - Gmail API

    ![](/assets/tech/155/004.png)

  - Pub/Sub API

    ![](/assets/tech/155/005.png)

  And then \`enable API, try now, ..., etc\` (each service has the button placed in different positions).

### Create OAuth Detail

- Then we can click

  ![](/assets/tech/155/006.png)

  to control the access right (called scope) to the service for users authenticated through oauth.

- **Step 1.** Most of the fields are optional, just fill in \`App name\` and \`User support email\`.

  ![](/assets/tech/155/007.png)

  then click save and continue at the bottom.

- **Step 2.** We define access right for oauth-authenticated users. Click \`Add or remove scopes\`:

  ![](/assets/tech/155/008.png)

  in our case we need:

  ![](/assets/tech/155/009.png)

- **Step 3.** Add users who is available to using the apis from this project

  ![](/assets/tech/155/010.png)

  james.lee now can use \`pubsub\` and \`gmailapi\` with defined rights in the scopes.

- Since we are the only users, we can keep staying at test state.

### Create Credentials

- Save and continue, we create credentials for authentication.
  ![](/assets/tech/155/011.png)
- Choose Desktop app

  ![](/assets/tech/155/012.png)

- Fill in the blanks, then \`create\`.

- The resulting \`credential.json\` is for api which use \`oauth-v2\` authentication.

### Another Version of Credential (can skip and revisit when needed, pubsub library may need it)

- Since we are not going to use pubsub's \`pulling\`, we just receive \`push\` notification by webhook (let google send post request to us), we don't need any package for pubsub in our project which requires \`oauth-v1\` credential.

- In the future if pulling is needed, we can get v1 credential in the folloing way:

> - ![](/assets/tech/155/013.png)
> - $\\to$ manage server account
> - $\\to$ manage keys
>   ![](/assets/tech/155/014.png)
> - $\\to$ add key $\\to$ download json:
>   ![](/assets/tech/155/015.png)

### Configure Pubsub API

#### Create Topic

- Go to pub/sub api page by using the search bar again

  ![](/assets/tech/155/016.png)

- Create a topic with default option

  ![](/assets/tech/155/017.png)

#### Create Subscription

- Create subscription and selected our newly created topic

  ![](/assets/tech/155/018.png)

#### Create Publisher for the Topic

- We next create publisher that monitor our mail box and push message to the topic. We following [documentation about push notifications in gmail api](https://developers.google.com/gmail/api/guides/push).

  > To do this, you need to **grant publish privileges to gmail-api-push@system.gserviceaccount.com**. You can do this using the Cloud Pub/Sub Developer Console permissions interface following the resource-level access control instructions.

  - Select Topic

    ![](/assets/tech/155/019.png)

  - Click Add Principal at the right column

    ![](/assets/tech/155/020.png)

  - Fill in the email address, then assign publisher right

    ![](/assets/tech/155/021.png)

#### Create Subscriber for the Topic

- Next we grant \`receiver\` right to our google users:

  - select a topic in subscriptions

    ![](/assets/tech/155/022.png)

  - Add principal at the right column, then fill in:

    ![](/assets/tech/155/023.png)

### Use the Credential in the Program

- Place your credential at

  ![](/assets/tech/155/024.png)

  name it \`credential-v2-gmail.json\`, this is configured in \`GoogleConfig.java\`.

  We may move the string to properties file, but 3 environments can share the same crendential.

- The actual authentication will be done when we run the springboot program, we will be asked to sigin in through a given link in the terminal.

- Once authentication is done, a file will be created in \`token-local/\` and we will not be asked to login again when that file exists.

- In properties file we have configured \`GoogleConfig\` to use \`token-uat/\`, \`token-prd/\` in different environment

- To avoid the package prompting login action in \`uat\` and \`prd\`, we may create these addional two folders $\\to$ sign-in $\\to$ copy the generated file into the correct folder before deployment.

### Code Implementation to Use Credential and Start Webhook in Java

The following is essentially a modification of code presented in documentation.

\`\`\`java
mport com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.extensions.java6.auth.oauth2.AuthorizationCodeInstalledApp;
import com.google.api.client.extensions.jetty.auth.oauth2.LocalServerReceiver;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.store.FileDataStoreFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.api.services.gmail.model.WatchRequest;
import com.google.api.services.gmail.model.WatchResponse;
import com.wonderbricks.web.service.impl.GmailServiceImpl;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GoogleConfig {

    @Value("\${google.token}")
    private String TOKENS_DIRECTORY_PATH;

    @Value("\${google.credential}")
    private String CREDENTIAL_FILE_PATH;

    @Value("\${google.app}")
    private String APPLICATION_NAME;

    @Value("\${google.pub.topic}")
    private String PUBLISHER_TOPIC_NAME;

    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    private static final List<String> SCOPES = Collections.singletonList(GmailScopes.MAIL_GOOGLE_COM);

    @Bean
    Gmail getGmail() throws GeneralSecurityException, IOException {
        final NetHttpTransport HTTP_TRANSPORT = GoogleNetHttpTransport.newTrustedTransport();
        Gmail service = new Gmail.Builder(HTTP_TRANSPORT, JSON_FACTORY, getCredentials(HTTP_TRANSPORT))
                .setApplicationName(APPLICATION_NAME)
                .build();
        return service;
    }

    private Credential getCredentials(final NetHttpTransport HTTP_TRANSPORT)
            throws IOException {

        InputStream in = GmailServiceImpl.class.getResourceAsStream(CREDENTIAL_FILE_PATH);
        if (in == null) {
            throw new FileNotFoundException("Resource not found: " + CREDENTIAL_FILE_PATH);
        }
        GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(JSON_FACTORY, new InputStreamReader(in));

        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                HTTP_TRANSPORT, JSON_FACTORY, clientSecrets, SCOPES)
                .setDataStoreFactory(new FileDataStoreFactory(new java.io.File(TOKENS_DIRECTORY_PATH)))
                .setAccessType("offline")
                .build();
        LocalServerReceiver receiver = new LocalServerReceiver.Builder().setPort(8888).build();
        Credential credential = new AuthorizationCodeInstalledApp(flow, receiver).authorize("user");
        return credential;
    }

    public void startWebHook(Gmail gmail) throws IOException, InterruptedException {
        WatchRequest request = new WatchRequest();
        request.setLabelIds(Arrays.asList("INBOX"));
        request.setTopicName(PUBLISHER_TOPIC_NAME);
        request.setLabelFilterAction("INCLUDE");
        WatchResponse res = gmail.users().watch("me", request).execute();
        Long expiredAfter = res.getExpiration(); // millis
        CompletableFuture.delayedExecutor(expiredAfter, TimeUnit.MILLISECONDS).execute(() -> {
            try {
                startWebHook(gmail);
            } catch (IOException | InterruptedException e) {
                e.printStackTrace();
            }
        });
    }

    // Run after application context has been created
    @Bean
    CommandLineRunner initWebhook(Gmail gmail) {
        return args -> {
            var logger = LoggerFactory.getLogger(GoogleConfig.class);
            logger.info("Start Watching Gmail Account");
            startWebHook(gmail);
        };
    }
}
\`\`\`
`;export{e as default};
