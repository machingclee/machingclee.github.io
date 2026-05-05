const n=`---
title: "CORS Configuration for HandlerInterceptors via Spring Security"
date: 2024-08-07
id: blog0308
tag: kotlin, springboot
toc: true
intro: "The generation of the bean of WebMvcConfigurer suffices to provide a global configuration of CORS via Rest Controller, but that fails to configure non-mvc requests (such as those intercepted by our interceptors). Let's study an alternative."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Failed Config

For example, [documentation](https://spring.io/guides/gs/rest-service-cors) provides an example that is similar to the following:

\`\`\`kotlin 
@Configuration
class GlobalCorsConfig {
    @Bean
    fun corsConfigurer(): WebMvcConfigurer {
        return object : WebMvcConfigurer {
            override fun addCorsMappings(registry: CorsRegistry) {
                registry.addMapping("/**") 
                    .allowedOrigins("*") 
                    .allowCredentials(true) 
                    .allowedMethods("GET", "POST", "PUT", "DELETE") 
                    .allowedHeaders("*") 
                    .exposedHeaders("Header1", "Header2")
            }
        }
    }
}
\`\`\`
but this fails to get custom header in \`HandlerInterceptors\`.

### Successful SecurityConfig for HandlerInterceptors


\`\`\`kotlin 
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.HttpStatusEntryPoint
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
class SecurityConfig {

    fun corsConfigurationSource(): CorsConfigurationSource {
        val config = CorsConfiguration()
        config.allowedOrigins = listOf("http://localhost:5173", "http://localhost:5173/")
        config.allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
        config.allowedHeaders = listOf("*")
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", config)
        return source
    }

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http.exceptionHandling { c ->
            c.authenticationEntryPoint(
                HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)
            )
        }
            .csrf { c -> c.disable() }
            .cors { c -> c.configurationSource(corsConfigurationSource()) }
            .sessionManagement { c -> c.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { req -> req.anyRequest().permitAll() }
        return http.build()
    }
}
\`\`\`

`;export{n as default};
