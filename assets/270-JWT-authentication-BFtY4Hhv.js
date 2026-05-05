const n=`---
title: "JWT in Spring boot I: Using Spring-Security"
date: 2024-06-23
id: blog0270
tag: springboot, kotlin
intro: "We try to implement a JWT authentication and study how to construct custom token payload for the backend."
toc: true
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Preface

- This blog post will be full of configuration/util classes and no explanation will be provided.

- The \`spring-security\` is notoriously difficult to use (for no good reason), I am recording it for the shere purpose of study and ***not intent to use it*** in any of my project.

- If you come from other background such as \`nodejs\`, you can realize how stupid and clunky the way that \`spring-boot-security\` provides us.


### TokenParams


\`\`\`kotlin
// defined in data/types.kt
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.userdetails.UserDetails

data class TokenParams(
    val firstName: String,
    val lastName: String,
    private val passwordHash: String,
    val email: String,
) : UserDetails {
    override fun getAuthorities(): MutableCollection<out GrantedAuthority> {
        return mutableListOf()
    }

    override fun getPassword(): String {
        return passwordHash
    }

    override fun getUsername(): String {
        return email
    }
}
\`\`\`

### ApplicationConfig

\`\`\`kotlin 
package com.kotlinspring.config

import com.kotlinspring.data.TokenParams
import com.kotlinspring.db.tables.daos.UserDao
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.AuthenticationProvider
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder


@Configuration
class ApplicationConfig(
    private val userDAO: UserDao
) {
    @Bean
    fun userDetailsService(): UserDetailsService {
        return UserDetailsService { email: String ->
            try {
                val user = userDAO.fetchByEmail(email ?: "").getOrNull(0)
                if (user == null) {
                    throw UsernameNotFoundException("User cannot be found")
                }
                val userDetails = TokenParams(
                    user.firstname,
                    user.lastname,
                    user.passwordhash,
                    user.email
                )
                userDetails
            } catch (e: Exception) {
                throw UsernameNotFoundException("$e")
            }
        }
    }

    @Bean
    fun passwordEncoder(): BCryptPasswordEncoder {
        return BCryptPasswordEncoder()
    }

    @Bean
    @Throws(Exception::class)
    fun authenticationManager(config: AuthenticationConfiguration): AuthenticationManager {
        return config.authenticationManager
    }

    @Bean
    fun authenticationProvider(): AuthenticationProvider {
        val authProvider = DaoAuthenticationProvider()
        authProvider.setUserDetailsService(userDetailsService())
        authProvider.setPasswordEncoder(passwordEncoder())

        return authProvider
    }
}
\`\`\`

### SecurityConfig 
\`\`\`kotlin
package com.kotlinspring.config

import com.kotlinspring.filter.JwtAuthenticationFilter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.authentication.AuthenticationProvider
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
open class SecurityConfig(
    private val jwtAuthenticationFilter: JwtAuthenticationFilter,
    private val authenticationProvider: AuthenticationProvider
) {
    @Bean
    @Throws(Exception::class)
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { csrfCustomizer -> csrfCustomizer.disable() }
            .authorizeHttpRequests { authorize ->
                authorize
                    .requestMatchers("/v1/courses").authenticated()
                    .anyRequest().permitAll()
            }
            .sessionManagement { session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authenticationProvider(authenticationProvider)
            .addFilterBefore(jwtAuthenticationFilter, BasicAuthenticationFilter::class.java)
        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        // configuration.allowedOrigins = listOf("http://localhost:8005")
        // the payment system is called by mobile, which has no origin header in the request
        configuration.allowedOrigins = listOf("/**")
        configuration.allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTION")
        configuration.allowedHeaders = listOf("Authorization", "Content-Type")

        val source = UrlBasedCorsConfigurationSource()

        source.registerCorsConfiguration("/**", configuration)

        return source
    }
}
\`\`\`

### JwtAuthenticationFilter

\`\`\`kotlin
package com.kotlinspring.filter

import com.kotlinspring.service.JwtService
import jakarta.servlet.FilterChain
import jakarta.servlet.ServletException
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.lang.NonNull
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import org.springframework.web.servlet.HandlerExceptionResolver
import java.io.IOException

@Component
class JwtAuthenticationFilter(
    private val jwtService: JwtService,
    private val userDetailsService: UserDetailsService,
    private val handlerExceptionResolver: HandlerExceptionResolver
) : OncePerRequestFilter() {
    @Throws(ServletException::class, IOException::class)
    override fun doFilterInternal(
        @NonNull request: HttpServletRequest,
        @NonNull response: HttpServletResponse,
        @NonNull filterChain: FilterChain
    ) {
        val authHeader = request.getHeader("Authorization")

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response)
            return
        }

        try {
            val jwt = authHeader.substring(7)
            // We assign subject as userEmail in auth/login method
            val userEmail = jwtService.extractSubject(jwt)

            val authentication: Authentication? = SecurityContextHolder.getContext().authentication

            if (userEmail != null && authentication == null) {
                val userDetails = userDetailsService.loadUserByUsername(userEmail)

                if (jwtService.isTokenValid(jwt, userDetails)) {
                    val authToken = UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.authorities
                    )

                    authToken.details = WebAuthenticationDetailsSource().buildDetails(request)
                    SecurityContextHolder.getContext().authentication = authToken
                }
            }

            filterChain.doFilter(request, response)
        } catch (exception: Exception) {
            handlerExceptionResolver.resolveException(request, response, null, exception)
        }
    }
}
\`\`\`


### JwtService

\`\`\`kotlin
package com.kotlinspring.service

import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.SignatureAlgorithm
import io.jsonwebtoken.io.Decoders
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.stereotype.Service
import java.security.Key
import java.util.Date

@Service
class JwtService {
    @Value("\\\${spring.security.jwt.secretKey}")
    lateinit var secretKey: String

    @Value("\\\${spring.security.jwt.expirationTime}")
    var expirationTime: Long = 0

    fun extractSubject(token: String?): String {
        return extractClaim(token, Claims::getSubject)
    }

    fun <T> extractClaim(token: String?, claimsResolver: (Claims) -> T): T {
        val claims = extractAllClaims(token)
        return claimsResolver(claims)
    }

    fun generateToken(userDetails: UserDetails): String {
        return generateToken(HashMap(), userDetails)
    }

    fun generateToken(extraClaims: Map<String?, Any?>, userDetails: UserDetails): String {
        return buildToken(extraClaims, userDetails, expirationTime)
    }

    private fun buildToken(
        extraClaims: Map<String?, Any?>,
        userDetails: UserDetails,
        expiration: Long
    ): String {
        return Jwts
            .builder()
            .setClaims(extraClaims)
            .setSubject(userDetails.username)
            .setIssuedAt(Date(System.currentTimeMillis()))
            .setExpiration(Date(System.currentTimeMillis() + expiration))
            .signWith(getSignInKey(), SignatureAlgorithm.HS256)
            .compact()
    }

    fun isTokenValid(token: String?, userDetails: UserDetails): Boolean {
        val username = extractSubject(token)
        return (username == userDetails.username) && !isTokenExpired(token)
    }

    private fun isTokenExpired(token: String?): Boolean {
        return extractExpiration(token).before(Date())
    }

    private fun extractExpiration(token: String?): Date {
        return extractClaim(token, Claims::getExpiration)
    }

    private fun extractAllClaims(token: String?): Claims {
        return Jwts
            .parserBuilder()
            .setSigningKey(getSignInKey())
            .build()
            .parseClaimsJws(token)
            .body
    }

    private fun getSignInKey(): Key {
        val keyBytes = Decoders.BASE64.decode(secretKey)
        return Keys.hmacShaKeyFor(keyBytes)
    }

}
\`\`\`
### For Authentication and Authenticated Users

#### Signup and Login

\`\`\`kotlin 
package com.kotlinspring.controller

import com.kotlinspring.data.TokenParams
import com.kotlinspring.db.tables.pojos.User
import com.kotlinspring.dto.LoginResponse
import com.kotlinspring.dto.LoginUserDto
import com.kotlinspring.dto.RegisterUserDTO
import com.kotlinspring.service.AuthenticationService
import com.kotlinspring.service.JwtService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController


@RestController
@RequestMapping("/auth")
class AuthController(
    val authService: AuthenticationService,
    val jwtService: JwtService
) {
    @PostMapping("/signup")
    fun register(@RequestBody registerUserDto: RegisterUserDTO): ResponseEntity<User> {
        val registeredUser = authService.signup(registerUserDto)
        return ResponseEntity.ok(registeredUser)
    }

    @PostMapping("/login")
    fun authenticate(@RequestBody loginUserDto: LoginUserDto?): ResponseEntity<LoginResponse> {
        val authenticatedUser = authService.authenticate(loginUserDto!!)
        // the framework only ships us with the getSubject method, and this subject comes from
        // username using the required interface **UserDetails** in spring-security
        val tokenParams = TokenParams(
            firstName = authenticatedUser.firstname,
            lastName = authenticatedUser.lastname,
            email = authenticatedUser.email,
            passwordHash = authenticatedUser.passwordhash
        )
        val extraClaim = mapOf<String?, Any>(
            "email" to authenticatedUser.email,
            "firstName" to authenticatedUser.firstname,
            "lastName" to authenticatedUser.lastname,
        )
        val jwtToken = jwtService.generateToken(extraClaim, tokenParams)

        val loginResponse = LoginResponse()
        loginResponse.token = jwtToken
        loginResponse.expiresIn = jwtService.expirationTime

        return ResponseEntity.ok(loginResponse)
    }
}
\`\`\`
#### UserService to get Token Payload for Loginned Users via SecurityContextHolder


\`\`\`kotlin
package com.kotlinspring.service

import com.kotlinspring.data.TokenParams
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Service

@Service
class UserService {
    val authData: TokenParams
        get() {
            val auth = SecurityContextHolder.getContext().authentication
            val tokenDetail = auth.principal as TokenParams
            return tokenDetail
        }
}
\`\`\`


### Conclusion 

- We have seen that using Spring-Security forces us to create plenty of counter-intuitive configurations. Not a few, it is ***plenty***. 

- The configuration is highly non-resuable as the logic highly depends on your database structure and what \`extraClaims\` you want to add into.

- Note that a jwt-token with just the \`username\`/\`userId\` is ***meaningless*** (which we usually set as \`subject\` in \`spring-security\`). 
  
  Consider \`extractClaim\` method with a *limited* number of \`claims::getXXX\`'s, it is not suited to the purpose of avoiding frequent DB connections just for retrieving user information. 

- The best strategy to implement JWT authentication is "***not to use*** \`spring-boot-starter-security\`", which we will introduce in the next post.`;export{n as default};
