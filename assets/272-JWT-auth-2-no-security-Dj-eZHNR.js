const n=`---
title: "JWT in Spring boot II: Get rid of Spring-Security. More on Parsing Json String into Pojo"
date: 2024-06-24
id: blog0272
tag: kotlin, gradle, springboot
intro: "A JWT authentication should be simple and straight-forward. Let's forget about spring-security and start with the basic idea."
toc: true
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Depenencies Needed

\`\`\`text
plugins {
    kotlin("plugin.serialization") version "2.0.0"
}

dependencies {
    implementation("org.json:json:20240303")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")
    implementation("io.fusionauth:fusionauth-jwt:5.3.3")
    implementation("at.favre.lib:bcrypt:0.10.2")
}
\`\`\`
- \`org.json:json\` is to import \`JSONObject\` which can take a \`Map\` to \`Json\` string via \`toString()\` method.

- \`kotlinx-serialization-json\` is to use \`Json.decodeFromString<JwtPayload>(str)\`  to transform a json string into a \`Pojo\`.
- \`bcrypt\` is responsible for hashing tasks which is usually used in login and signup process.
- \`fusionauth-jwt\` is by far, from my experiment, the only functioning package to parse the JWT-token generate by  \`node.js\` using \`HS256\` algorithm. 
- Knowing the following will be helpful to make sense of the APIs in \`fusionauth-jwt\` (like the use of \`HMACVerifier\`): 
  - \`HS256\` stands for \`HMAC-SHA256\`
  - \`HMAC\` stands for Hash-based Message Authentication Code and 
  - \`SHA256\` is an hashing algorithm

### Interceptor

JWT authentication is usually handled by ***middlewares***. The closest possible analog in the world of spring boot is ***interceptors***.

Let's add an interceptor to the route \`/course/**\`:
\`\`\`kotlin
package com.kotlinspring.restapi.config


import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

import com.kotlinspring.restapi.interceptor.JwtHandlerInterceptor
import com.kotlinspring.restapi.jwt.Jwt

@Configuration
class JwtWebMvcConfigurer(
    private val jwtHandlerInterceptor: JwtHandlerInterceptor
) : WebMvcConfigurer {

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(jwtHandlerInterceptor).addPathPatterns("/course/**")
    }
}
\`\`\`

Let's define the remaining missing pieces, 
- the \`Jwt\` class and 
- the \`JwtHandlerInterceptor\` class

### 3 Major Components

#### Jwt

\`\`\`kotlin
package com.kotlinspring.restapi.jwt

import at.favre.lib.crypto.bcrypt.BCrypt
import com.machingclee.payment.model.JwtPayload
import io.fusionauth.jwt.Verifier
import io.fusionauth.jwt.domain.JWT
import io.fusionauth.jwt.hmac.HMACSigner
import io.fusionauth.jwt.hmac.HMACVerifier
import kotlinx.serialization.json.Json
import org.json.JSONObject
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

@Service
class JwtService private constructor() {
    @Value("\\\${jwt.secretKey}")
    var secretKey: String? = null

    @Value("\\\${jwt.expirationTime}")
    var expirationTime: Long = 0L

    private val saltLength = 10
    var jwtDecode: ((token: String) -> JwtPayload)? = null

    fun hashPassword(password: String): String {
        return BCrypt.withDefaults().hashToString(saltLength, password.toCharArray())
    }

    fun comparePasswordWithHash(password: String, bcryptHash: String): Boolean {
        return BCrypt.verifyer().verify(password.toCharArray(), bcryptHash).verified
    }

    fun createToken(obj: Map<String, Any>): String? {
        val signer = HMACSigner.newSHA256Signer(this.secretKey)
        val jwt = JWT()
        obj.forEach { entry ->
            jwt.addClaim(entry.key, entry.value)
        }
        return JWT.getEncoder().encode(jwt, signer)
    }

    private fun initDecoder() {
        if (jwtDecode == null) {
            secretKey?.let {
                val verifier: Verifier = HMACVerifier.newVerifier(it)
                jwtDecode = { token ->
                    val jwt = JWT.getDecoder().decode(token, verifier)
                    val strinyPayload = JSONObject(jwt.otherClaims).toString()
                    val tokenPayload = Json.decodeFromString<JwtPayload>(strinyPayload)
                    tokenPayload
                }
            }
        }
    }

    //    documentation: https://github.com/FusionAuth/fusionauth-jwt#verify-and-decode-a-jwt-using-hmac
    fun parseAndVerifyToken(token: String?): JwtPayload? {
        initDecoder()
        return jwtDecode?.let { decoder -> token?.let { token -> decoder(token) } }
    }
}
\`\`\`

#### UserContext

On each request we should be able to acquire the user information from \`accessToken\` rather than accessing it over and over again from the database. 

##### In our Strategy

\`\`\`kotlin
package com.kotlinspring.restapi.jwt

class UserContext {
    private val threadLocal: ThreadLocal<TokenPayload?> = ThreadLocal<TokenPayload?>()

    fun clear() {
        threadLocal.set(null)
    }

    fun setUser(tokenPayload: TokenPayload?) {
        threadLocal.set(tokenPayload)
    }

    fun getUser(): TokenPayload? {
        return threadLocal.get()
    }

    companion object {
        val instance: UserContext = UserContext()
    }
}
\`\`\`

##### On the Contrary, In Spring Security

We save those data using \`TheadLocal\`, which is used in one of the implementations of \`SecurityContextHolder\` with which in \`spring-security\` we assign and get user data by:

\`\`\`kotlin 
// assign
SecurityContextHolder.getContext().authentication = authToken
// get
SecurityContextHolder.getContext().authentication
\`\`\`



#### JwtHandlerInterceptor 
\`\`\`kotlin 
import com.machingclee.payment.service.JwtService
import com.machingclee.payment.model.JwtPayload
import com.machingclee.payment.model.UserContext
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.fusionauth.jwt.JWTExpiredException
import io.github.oshai.kotlinlogging.KLogger
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor

@Component
class JwtHandlerInterceptor(private val jwtService: JwtService) : HandlerInterceptor {
    private val authHeader: String = "authorization"

    companion object {
        var logger: KLogger = KotlinLogging.logger {}
    }

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        UserContext.instance.clear()
        try {
            val accessToken = request.getHeader(authHeader).replace("Bearer ", "")
            if (accessToken.isEmpty()) {
                throw Exception("AccessToken cannot be empty")
            }
            val payload: JwtPayload = jwtService.parseAndVerifyToken(accessToken)!!
            UserContext.instance.setUser(payload)
            return true
        } catch (exception: Exception) {
            val errorMessage = when (exception) {
                is JWTExpiredException -> "JWT_EXPIRED"
                else -> exception.toString()
            }
            response.contentType = "application/json"
            response.status = HttpServletResponse.SC_UNAUTHORIZED
            val error = mapOf("success" to false, "errorMessage" to errorMessage)
            val objectMapper = jacksonObjectMapper()
            val jsonString = objectMapper.writeValueAsString(error)
            response.writer.write(jsonString)
            return false
        }
    }
}
\`\`\`


### Parse the Token From Header
#### Result: Let's make a Simple Request with Authorization Header

How simple it is? Now when I make a request with \`Authorization: Bearer <token>\` I immediately get the user info:

![](/assets/img/2024-08-01-01-17-48.png)


#### More on the Token

- Our token is generated from a \`node.js\` backend and therefore we don't expect to have attributes like \`audience\`, \`exp\`, \`iat\`, \`iss\`, etc, keys that are usually pre-defined in \`java\` ecosystem. 

  ![](/assets/img/2024-08-01-01-23-32.png)

- Conversely our \`Jwt.createToken\` converts a map into a JWT token. Especially when the keys are not among the predefined ones:

  ![](/assets/img/2024-08-01-01-21-35.png)

  They will fall into \`otherClaims\`.

### Back to \`authController/{signup, login}\`

No need to explain and straight-forward ;).

\`\`\`kotlin
package com.kotlinspring.restapi.controller

import com.kotlinspring.infrastructure.db.tables.daos.UserDao
import com.kotlinspring.infrastructure.db.tables.pojos.User
import com.kotlinspring.restapi.dto.LoginResponse
import com.kotlinspring.restapi.dto.LoginUserDto
import com.kotlinspring.restapi.dto.RegisterUserDTO
import com.kotlinspring.restapi.jwt.Jwt
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/auth")
class AuthController(
    val jwt: Jwt,
    val userDAO: UserDao
) {
    @PostMapping("/signup")
    fun register(@RequestBody registerUserDto: RegisterUserDTO): ResponseEntity<User> {
        val passwordHash = jwt.hashPassword(registerUserDto.password)
        val user = User(
            null,
            firstname = registerUserDto.firstName,
            lastname = registerUserDto.lastName,
            passwordhash = passwordHash,
            email = registerUserDto.email
        )
        userDAO.insert(user)
        println("secret!!!! \${jwt.secretKey}")
        return ResponseEntity.ok(user)
    }

    @PostMapping("/login")
    fun authenticate(@RequestBody loginUserDto: LoginUserDto): ResponseEntity<LoginResponse> {
        val user = userDAO.fetchByEmail(loginUserDto.email).firstOrNull()
            ?: throw Exception("Username or password is incorrect")

        val loginPassword = loginUserDto.password
        val valid = jwt.comparePasswordWithHash(loginPassword, user.passwordhash)
        if (!valid) {
            throw Exception("Username or password is incorrect")
        }
        val username = "\${user.firstname} \${user.lastname}"
        val result = jwt.createToken(userId = user.id!!, email = loginUserDto.email, username = username)
        val token = "Bearer \${result.first}"
        val payload = result.second
        val loginResponse = LoginResponse(token = token, expiresAt = payload.expiredAt)

        return ResponseEntity.ok(loginResponse)
    }
}
\`\`\`


`;export{n as default};
