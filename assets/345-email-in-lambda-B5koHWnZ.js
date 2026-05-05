const e=`---
title: "Email Configuration for Spring Boot in SnapStarted Lambda"
date: 2024-12-01
id: blog0345
tag: springboot
toc: true
intro: "Due to the lambda-nature, snapStarted spring boot differs from ordinary spring boot application as it 
lacks the write permission to the /var/task of the lambda function."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Setup in the past Succeeded in Local and Containerized Environment (e.g., ECS) but Failed in Lambda Functions

In the past we have defined an gmail service using kotlin [in this article](/blog/article/Send-Gmail-in-Kotlin).

This method fails when we use a \`snapStarted\` $\\lambda$-function running a spring boot because 
1. By default the \`tokens-prod/StoredCredential\` that we put in \`project-root/\` or \`resources/\` of the project will be clone to \`/var/task\` of the lambda function, however;

2. \`/var/task\` is only ***readable*** but ***not writable***
Unfortunatelly every time we submit our credential, google-related sdk will make an adjustment to our \`tokens-prod/StoredCredential\`, meaning that \`/var/task\` must be a \`writable\` directory, leading to a failure to launch the gmail service due to non-writability.

### Workaround

Good news is that for every lambda function the \`/tmp\` folder is writable, and we can move our credential into that folder before launching the \`gmail-authflow\`.

#### Step 1. Locate your credential to resources folder

Let's place our credential here:

![](/assets/img/2024-11-30-22-10-52.png)

Next let's define the file path by \`classpath:directory-name\`

![](/assets/img/2024-11-30-22-12-28.png)

#### Step 2. Setup resource loader

Let's create a \`BeanConfig\` class to manage our beans:

![](/assets/img/2024-11-30-22-14-44.png)

and let's define 

\`\`\`kt
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.io.DefaultResourceLoader
import org.springframework.core.io.ResourceLoader

@Configuration
class BeanConfig {
    @Bean
    fun resourceLoader(): ResourceLoader {
        return DefaultResourceLoader()
    }
}
\`\`\`
#### Step 3. Adjust \`getCredentials\` method in previous article

We have mentioned [this article](/blog/article/Send-Gmail-in-Kotlin) at the beginning (which includes all the implementation of our \`GmailService\`), now let's adjust \`getCredentials\` by the highlighted lines:


\`\`\`kt{8,19,25-28,35-58,60-70}
@Service
class GmailServiceImpl(
    @Value("\\\${gmail.error-receiver}") private val errorReceiver: String,
    @Value("\\\${gmail.credential-path}") private val credentialPath: String,
    @Value("\\\${stage.env}") private val env: String,
    @Value("\\\${gmail.email-sender}") private val emailSender: String,
    @Value("\\\${gmail.token-path}") private val tokenPath: String,
    @Qualifier("resourceLoader") private val resourceLoader: ResourceLoader,
    private val environment: Environment,
) : EmailService {


    private val httpTransport = GoogleNetHttpTransport.newTrustedTransport()
    private val jsonFactory = GsonFactory.getDefaultInstance()

    @Throws(IOException::class)
    private fun getCredentials(httpTransport: NetHttpTransport, jsonFactory: GsonFactory): Credential {
        // Load client secrets.
        val isLambdaEnvironment = environment.getProperty("IS_LAMBDA") == "true"
        val inputStream: InputStream = resourceLoader.getResource(credentialPath).inputStream
            ?: throw FileNotFoundException("Resource not found: $credentialPath")
        val clientSecrets =
            GoogleClientSecrets.load(jsonFactory, InputStreamReader(inputStream))
        val resourceTokenPath = resourceLoader.getResource(tokenPath)
        val flow = when {
            !isLambdaEnvironment -> standardAuthFlow(httpTransport, jsonFactory, clientSecrets, resourceTokenPath)
            else -> lambdaAuthflow(resourceTokenPath, httpTransport, jsonFactory, clientSecrets)
        }
        val receiver = LocalServerReceiver.Builder().setPort(8888).build()
        val credential: Credential = AuthorizationCodeInstalledApp(flow, receiver).authorize("user")
        // returns an authorized Credential object.
        return credential
    }

    private fun lambdaAuthflow(
        resourceTokenPath: Resource,
        httpTransport: NetHttpTransport,
        jsonFactory: GsonFactory,
        clientSecrets: GoogleClientSecrets?,
    ): GoogleAuthorizationCodeFlow? {
        val tmpTokenDir = "/tmp/tokens-prod"
        val tempDir = File(tmpTokenDir)
        tempDir.mkdirs()
        resourceTokenPath.file.listFiles()?.forEach { file ->
            val tempFile = File(tempDir, file.name)
            file.inputStream().use { inputStream ->
                FileOutputStream(tempFile).use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
        }
        return GoogleAuthorizationCodeFlow.Builder(
            httpTransport, jsonFactory, clientSecrets, setOf(GmailScopes.GMAIL_SEND)
        )
            .setDataStoreFactory(FileDataStoreFactory(tempDir.toPath().toFile()))
            .setAccessType("offline")
            .build()
    }

    private fun standardAuthFlow(
        httpTransport: NetHttpTransport,
        jsonFactory: GsonFactory,
        clientSecrets: GoogleClientSecrets?,
        resourceTokenPath: Resource,
    ): GoogleAuthorizationCodeFlow? = GoogleAuthorizationCodeFlow.Builder(
        httpTransport, jsonFactory, clientSecrets, setOf(GmailScopes.GMAIL_SEND)
    )
        .setDataStoreFactory(FileDataStoreFactory(Paths.get(resourceTokenPath.uri).toFile()))
        .setAccessType("offline")
        .build()

    override fun sendEmail(subject: String, bodyText: String, toEmail: String?): Message? {
        val service = Gmail.Builder(httpTransport, jsonFactory, getCredentials(httpTransport, jsonFactory))
            .setApplicationName("payment")
            .build()

        val props = Properties()
        val session: Session = Session.getDefaultInstance(props, null)
        val email: MimeMessage = MimeMessage(session)
        email.setFrom(InternetAddress(emailSender))
        email.addRecipient(
            javax.mail.Message.RecipientType.TO,
            InternetAddress(toEmail ?: errorReceiver)
        )
        email.subject = subject
        email.setContent(bodyText, "text/html; charset=utf-8")

        val buffer = ByteArrayOutputStream()
        email.writeTo(buffer)
        val rawMessageBytes = buffer.toByteArray()
        val encodedEmail = Base64.encodeBase64URLSafeString(rawMessageBytes)
        var message = Message()
        message.setRaw(encodedEmail)

        try {
            // Create send message
            message = service.users().messages().send("me", message).execute()
            println("Message id: " + message.id)
            println(message.toPrettyString())
            return message
        } catch (e: GoogleJsonResponseException) {
            val error = e.details
            if (error.code == 403) {
                println("Unable to create draft: " + e.details)
                throw Exception("403 not found")
            } else {
                throw e
            }
        }
    }
}
\`\`\`
What we have done:
1. When env variable \`IS_LAMBDA\` is found and equal to \`"true"\`, we use the \`lambdaAuthflow\`, which clones everything in \`/var/task/tokens-prod\` into \`/tmp/tokens-prod\` and trigger the \`auth-flow\` as before.

2. Otherwise we go back to \`standardAuthFlow\` (which is the code copied from documentation)

Apart from highlighted content, the rest remains the same.`;export{e as default};
