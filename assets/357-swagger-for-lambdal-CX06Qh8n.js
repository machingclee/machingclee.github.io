const e=`---
title: "① Swagger-UI for Spring Boot in SnapStarted Lambda ② Automation of  Authorization-Header Assignment for API Testings ③ Basic Functionalities"
date: 2025-01-02
id: blog0357
tag: springboot, swagger-ui
toc: true
intro: "We study the integration of snapStarted lambda with API-gateway."
img: spring
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### Setup in Spring Boot Application

#### Installation

\`\`\`kotlin
// build.gradle.kts

dependencies {
    ...
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0")
}
\`\`\`

### Component: SwaggerConfig

#### What to configure and why?

##### Task 1. Solve the swagger configuration problem due to the deployment via API-Gateway.

When deploying via api-gateway we need to divide our resource paths by \`dev\`, \`uat\` and \`prod\`.

For example, a lambda function deployed to api-gateway of stage \`dev\` can be accessed via

- https://rkfm9k8phd.execute-api.ap-northeast-1.amazonaws.com/dev
  By default the \`spring-doc\` framework has done the following incorrectly since the auto-generated swagger-rosources do not belong to the spring framework: The \`swagger-ui/index.html\`
- fetches its \`swagger-config\` from \`/v3/api-docs/swagger-config\`
- fetches its \`apiDoc-config\` from \`/v3/api-docs\`
  which are both incorrect as we need to start with \`/dev/v3/\`.

To solve these, we either

- set different paths from \`application-<stage>.yml\`'s
- set them programmatically by creating the beans according to the deployment stage:

\`\`\`kotlin
@Primary
@Bean
fun swaggerUiConfig(swaggerUiConfig: SwaggerUiConfigProperties): SwaggerUiConfigParameters {
    val prefix = getLambdaPrefix()
    return SwaggerUiConfigParameters(swaggerUiConfig).apply {
        url = "$prefix/v3/api-docs"
        configUrl = "$prefix/v3/api-docs/swagger-config"
        path = "/api"
    }
}

@Primary
@Bean
fun apiDocsConfig(apiDocsProperties: SpringDocConfigProperties): SpringDocConfigProperties {
    val prefix = getLambdaPrefix()
    return apiDocsProperties.apply {
        apiDocs.path = "$prefix/v3/api-docs"
    }
}
\`\`\`

##### Task 2. Accomplish the automation of the "authorization-header assignment" once we are authenticated via \`login-url\`

As in postman with \`Scripts\` tab:

![](/assets/img/2025-01-05-14-36-16.png)

we can set the resulting token into our environment variable and start the API testing, we wish to **_automate_** this process as well in swagger-ui.

#### The SwaggerConfig: WebMvcConfigurer

##### Imports

\`\`\`kotlin-1
package dev.james.alicetimetable.commons.config

import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.security.SecurityRequirement
import io.swagger.v3.oas.models.security.SecurityScheme
import io.swagger.v3.oas.models.servers.Server
import org.springdoc.core.properties.SpringDocConfigProperties
import org.springdoc.webmvc.ui.SwaggerIndexTransformer
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.core.env.Environment
import org.springframework.core.env.get
import org.springframework.core.io.Resource
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.net.URI
import java.net.URL
\`\`\`

##### Util functions for prefixes (dev, uat, prod)

\`\`\`kotlin-26
@Configuration
@ConditionalOnProperty(
    name = ["springdoc.swagger-ui.enabled"],
    havingValue = "true",
    matchIfMissing = false
)
class SwaggerConfig(
    private val env: Environment,
    @Value("\\\${stage.env}") private val stage: String,
    @Value("\\\${swagger-config.login-url}") private val loginUrl: String,
    @Value("\\\${swagger-config.accessTokenPath}") private val accessTokenPath: String
) : WebMvcConfigurer {
    private fun isLambda(): Boolean {
        return env["IS_LAMBDA"] == "true"
    }

    fun getLambdaPrefix(): String {
        val isLambda = isLambda()
        val prefix = when (isLambda) {
            true -> "/$stage"
            else -> ""
        }
        return prefix
    }
\`\`\`

##### Inject custom javascript to automate the process of setting authorization header after authentication

Next we inject the logic for \`requestInterceptor\` and \`responseInterceptor\`, they are used to automate the following:

1. **Login.** When we login we will set the \`accessToken\` to local storage

2. **Make Request.** When we make request we will take the \`accessToken\` from local storage and set \`authorization: Bearer <token>\` to the header.

The injection of interceptors is achieved by surgery on \`swagger-initializer.js\`. For spring boot it is as simple as creating the bean of type \`SwaggerIndexTransformer\`:

\`\`\`kotlin-51
    private class TransformedResource(
        private val original: Resource,
        private val content: ByteArray,
    ) : Resource {
        override fun getInputStream(): InputStream = ByteArrayInputStream(content)
        override fun exists(): Boolean = true
        override fun isOpen(): Boolean = false
        override fun getDescription(): String = "Transformed resource"
        override fun getFilename(): String? = original.filename
        override fun getURL(): URL = original.url
        override fun createRelative(relativePath: String): Resource = original.createRelative(relativePath)
        override fun getURI(): URI = original.uri
        override fun contentLength(): Long = content.size.toLong()
        override fun lastModified(): Long = original.lastModified()
        override fun getFile(): File = original.file
    }

    @Bean
    fun swaggerIndexTransformer(): SwaggerIndexTransformer {
        return SwaggerIndexTransformer { request, resource, transformerChain ->
            val transformedResource = transformerChain.transform(request, resource)
            val filename = resource.filename
            when {
                filename?.endsWith("swagger-initializer.js") == true -> {
                    val content = String(transformedResource.inputStream.readAllBytes())
                    val updatedContent = content.replace(
                        """url: "https://petstore.swagger.io/v2/swagger.json"""",
                        newSwaggerUiConfig()
                    )
                    TransformedResource(transformedResource, updatedContent.toByteArray())
                }

                else -> transformedResource
            }
        }
    }
\`\`\`

In the following _injection_ we also define \`springdoc.swagger-ui.<property>\`'s, they only differ by the deployment stage and we don't need to make variants on \`application-<stage>.yml\`:

\`\`\`kotlin-88
    private fun newSwaggerUiConfig(): String {
        val prefix = getLambdaPrefix()
        val url = "$prefix/v3/api-docs"
        val configUrl = "$prefix/v3/api-docs/swagger-config"
        val path = "$prefix/api"
        return """
    url: "$url",
    path: "$path",
    configUrl: "$configUrl",
    tagsSorter: "alpha",
    requestInterceptor: (request) => {
        const token = localStorage.getItem('bearer_token');
        if (token) {
            request.headers['Authorization'] = \`Bearer \${'$'}{token}\`;
        }
        return request;
    },
    responseInterceptor: (response) => {
        if (response.url.endsWith('$loginUrl')) {
            try {
                const responseBody = JSON.parse(response.text);
                if (responseBody.result && responseBody.\${this.accessTokenPath}) {
                    const token = responseBody.\${this.accessTokenPath};
                    localStorage.setItem('bearer_token', token);
                    const bearerAuth = {
                        bearerAuth: {
                            name: "Authorization",
                            schema: { type: "http", scheme: "bearer" },
                            value: \`Bearer \${'$'}{token}\`
                        }
                    };
                    window.ui.authActions.authorize(bearerAuth);
                }
            } catch (e) {
                console.error('Error processing login response:', e);
            }
        }
        return response;
    },
    onComplete: () => {
        const storedToken = localStorage.getItem('bearer_token');
        if (storedToken) {
            const bearerAuth = {
                bearerAuth: {
                    name: "Authorization",
                    schema: { type: "http", scheme: "bearer" },
                    value: \`Bearer \${'$'}{storedToken}\`
                }
            };
            window.ui.authActions.authorize(bearerAuth);
        }
    }
        """
    }
\`\`\`

##### Configure \`baseURL\`'s and api-info to the swagger documentation

\`\`\`kotlin-143
    @Bean
    fun customOpenAPI(): OpenAPI {
        val localServer = Server()
            .url("http://localhost:$serverPort")
            .description("Local")

        val devServer = Server()
            .url("https://rkfm9k8phd.execute-api.ap-northeast-1.amazonaws.com/dev")
            .description("Development server for alice timetable system")

        return OpenAPI()
            .openapi("3.1.0")
            .info(Info()
                      .title("Alice Timetable System")
                      .description("This is the api spec of alice timetable system, under development")
                      .version("1.0"))
            .servers(listOf(localServer,
                            devServer))
    }

    @Primary
    @Bean
    fun apiDocsConfig(apiDocsProperties: SpringDocConfigProperties): SpringDocConfigProperties {
        val prefix = getLambdaPrefix()
        return apiDocsProperties.apply {
            apiDocs.path = "$prefix/v3/api-docs"
        }
    }
}
\`\`\`

#### Demonstration Video

<center style="padding-top: 20px">
  <video controls width="500">
    <source  src="/assets/img/2025-01-05-00-09-52.mp4" type="video/mp4">
    Sorry, your browser doesn't support embedded videos.
  </video>
</center>

### More on Decoding Configuration in application.yml

#### Issues from API-Gateway

By default response header for the content-type of \`js\`-bundles generated by \`springdoc-openapi-starter\` is

\`\`\`text
text/javascript
\`\`\`

from which API-Gateway has no clue how to decode it, and therefore generated something like

\`\`\`text
Ã:"A",Ã:"A",Ã:"A",Ã:"A",Ã:"A",Ã:"A",Ã :"a",Ã¡:"a",
Ã¢:"a",Ã£:"a",Ã¤:"a",Ã¥:"a",Ã:"C",Ã§:"c",Ã:"D",Ã°:"d",Ã:"E",Ã:"E",Ã
\`\`\`

in the \`js\` files. To get around this problem, let's force every response header to have \`charset=UTF-8\` by setting

\`\`\`kotlin
// application.yml
server:
  servlet:
    encoding:
      charset: UTF-8
      force: true
\`\`\`

in \`application.yml\`. Now API-Gateway understands how to decode it when they read:

![](/assets/img/2025-01-03-01-39-18.png)

### Common Usages

#### Add multiple servers for API testing

This is suitable for testing the same api in \`local\`, \`dev\`, \`uat\`, \`prod\`, etc, environments. It provides a dropdown list that we can switch very easily.

[![](/assets/img/2025-01-03-02-32-06.png)](/assets/img/2025-01-03-02-32-06.png)

Let's extend the \`customOpenAPI\` from the previous section:

\`\`\`kotlin{22,23}
    @Bean
    fun customOpenAPI(): OpenAPI {
        val devServer = Server()
            .url("https://rkfm9k8phd.execute-api.ap-northeast-1.amazonaws.com/dev")
            .description("Development server for alice timetable system")
        val prodServer = Server()
            .url("")
            .description("Production server for alice timetable system (not created yet)")

        return OpenAPI().components(
            Components().addSecuritySchemes("bearer-jwt",
                                            SecurityScheme()
                                                .type(SecurityScheme.Type.HTTP)
                                                .scheme("bearer")
                                                .bearerFormat("JWT")
                                                .\`in\`(SecurityScheme.In.HEADER)
                                                .name("Authorization")))
            .addSecurityItem(SecurityRequirement().addList("bearer-jwt"))
            .info(Info()
                      .title("Alice Timetable System")
                      .version("1.0"))
            .servers(listOf(devServer,
                            prodServer))
    }
\`\`\`

#### Add default example value to \`@RequestBody\`

\`\`\`kotlin
    data class LoginRequest(
        @field:Schema(
            description = "User Email",
            example = "test@gmail.com"
        )
        val email: String,
        @field:Schema(
            description = "Password",
            example = "some-password!"
        )
        val password: String,
    )

    @PostMapping("/login")
    fun login(@RequestBody loginRequest: LoginRequest): APIResponse<LoginResult> {
        val (accessToken, refreshToken, accessTokenPayload) = authApplicationService.handleLoginRequest(
            loginRequest
        )
        return APIResponse(LoginResult(accessToken = accessToken,
                                       refreshToken = refreshToken,
                                       user = accessTokenPayload))
    }
\`\`\`

Which results in

[![](/assets/img/2025-01-03-02-53-40.png)](/assets/img/2025-01-03-02-53-40.png)

#### Add default example value to \`@PathVariable\` and \`@RequestParam\`

\`\`\`kotlin
    @GetMapping("/{studentId}/student-packages")
    fun getStudentPackages(
        @Parameter(
            description = "Student ID",
            example = "4b05543b-4ee5-4ce7-b045-a8975b305b09",
            required = true
        )
        @PathVariable("studentId") studentId: String
    ): APIResponse<List<StudentPackageResposne>> {
        val packages = AliceLoggingUtil.hibernateSQL {
            studentApplicationService.getStudentPackages(studentId)
        }
        return APIResponse(packages)
    }
\`\`\`

Which results in

[![](/assets/img/2025-01-03-02-49-33.png)](/assets/img/2025-01-03-02-49-33.png)

#### Add ordering to the Controllers by Tags

Sometimes we wish a simple controller (like \`auth\`) to be always on top of others (as we access it most frequently once our \`accessToken\` expires).

Here is how we do this:

\`\`\`kotlin{1}
@Tag(name = "01. Auth Controller")
@RestController
@RequestMapping("/auth")
class AuthContorller(
    private val jwtService: JwtService,
    private val authApplicationService: AuthApplicationService,
    private val authService: AuthService,
) {
    ...
}
\`\`\`

Note that by default \`swagger-ui\` arranges them in \`descending\` order. To order the controllers correctly let's add:

\`\`\`yml
# application.yml
springdoc:
  swagger-ui:
    tags-sorter: alpha
\`\`\`

And we are done!

[![](/assets/img/2025-01-03-03-23-35.png)](/assets/img/2025-01-03-03-23-35.png)
`;export{e as default};
