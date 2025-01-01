---
title: "Swagger for Spring Boot in SnapStarted Lambda"
date: 2025-01-02
id: blog0357
tag: springboot, swagger
toc: true
intro: "We study the integration of snapStarted lambda with API-gateway."
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Configurations

##### Resource Config

```kotlin
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class SwaggerConfig : WebMvcConfigurer {
    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        registry
            .addResourceHandler("/swagger-ui/**")
            .addResourceLocations("classpath:/META-INF/resources/webjars/swagger-ui/")
            .setCachePeriod(3600)
            .resourceChain(false)
    }
}
```

##### Spring Doc Config

```kotlin
import org.springdoc.core.properties.SpringDocConfigProperties
import org.springdoc.core.properties.SwaggerUiConfigParameters
import org.springdoc.core.properties.SwaggerUiConfigProperties
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.core.env.Environment
import org.springframework.core.env.get

@Configuration
class SpringDocConfig(
    @Value("\${stage.env}") private val stage: String,
    private val env: Environment
) {

    private fun getPrefix(): String {
        val isLambda = env["IS_LAMBDA"] == "true"
        val prefix = when (isLambda) {
            true -> "/$stage"
            else -> ""
        }
        return prefix
    }

    @Primary
    @Bean
    fun swaggerUiConfig(swaggerUiConfig: SwaggerUiConfigProperties): SwaggerUiConfigParameters {
        val prefix = getPrefix()
        return SwaggerUiConfigParameters(swaggerUiConfig).apply {
            url = "$prefix/v3/api-docs"
            configUrl = "$prefix/v3/api-docs/swagger-config"
            path = "/api"
        }
    }

    @Primary
    @Bean
    fun apiDocsConfig(apiDocsProperties: SpringDocConfigProperties): SpringDocConfigProperties {
        val prefix = getPrefix()
        return apiDocsProperties.apply {
            apiDocs.path = "$prefix/v3/api-docs"
        }
    }
}
```

#### application.yml

```kotlin
server:
  servlet:
    encoding:
      charset: UTF-8
      force: true
```