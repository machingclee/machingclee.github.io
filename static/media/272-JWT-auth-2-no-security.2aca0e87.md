---
title: "JWT in Spring boot II: Get rid of Spring-Security"
date: 2024-06-24
id: blog0272
tag: kotlin, gradle, springboot
intro: "A JWT authentication should be simple and straight-forward. Let's forget about spring-security and starts with the intrinsic idea."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Interceptor

JWT authentication is usually handled by ***middlewares***. The closest possible analog in the world of spring boot is ***interceptors***.

Let's add an interceptor to the route `/course/**`:
```kotlin
package com.kotlinspring.restapi.config


import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

import com.kotlinspring.restapi.interceptor.JwtHandlerInterceptor
import com.kotlinspring.restapi.jwt.Jwt

@Configuration
class JwtWebMvcConfigurer(
    private val jwt: Jwt
) : WebMvcConfigurer {

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(JwtHandlerInterceptor(jwt)).addPathPatterns("/course/**")
    }
}
```

Let's define the remaining missing pieces, 
- the `Jwt` class and 
- the `JwtHandlerInterceptor` class

#### 3 Major Components

##### Jwt

```kotlin
package com.kotlinspring.restapi.jwt

import at.favre.lib.crypto.bcrypt.BCrypt
import com.alibaba.fastjson.JSONObject
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jws
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.util.*
import javax.crypto.SecretKey

data class TokenPayload(
    val id: UUID,
    val username: String,
    val email: String,
    val expiredAt: Long
)

@Service
class Jwt private constructor() {
    @Value("\${jwt.secretKey}")
    var secretKey: String? = null

    @Value("\${jwt.expirationTime}")
    var expirationTime: Long = 0L

    private val saltLength = 10
    var secret: SecretKey? = null

    fun hashPassword(password: String): String {
        return BCrypt.withDefaults().hashToString(saltLength, password.toCharArray())
    }

    fun comparePasswordWithHash(password: String, bcryptHash: String): Boolean {
        return BCrypt.verifyer().verify(password.toCharArray(), bcryptHash).verified
    }

    private fun initSecret() {
        if (secret == null) {
            secretKey?.let {
                secret = Keys.hmacShaKeyFor(it.toByteArray(Charsets.UTF_8))
                println("inited! $it")
            }
        }
    }

    fun createToken(userId: UUID, username: String, email: String): Pair<String, TokenPayload> {
        val expiredAt = expirationTime + System.currentTimeMillis()
        val payload = TokenPayload(
            userId,
            username,
            email,
            expiredAt,
        )
        val json = JSONObject.toJSON(payload).toString()
        initSecret()
        return Pair<String, TokenPayload>(
            Jwts.builder().setSubject(json).signWith(secret).compact(),
            payload
        )
    }

    fun parseAndVerifyToken(token: String?): TokenPayload {
        initSecret()
        val jws: Jws<Claims> = Jwts.parserBuilder().setSigningKey(secret).build().parseClaimsJws(token)
        val subject = jws.body.subject
        val tokenPayload = JSONObject.parseObject(subject, TokenPayload::class.java)
        if (System.currentTimeMillis() > tokenPayload.expiredAt) {
            throw Exception("token expired")
        }
        return tokenPayload
    }
}
```

##### UserContext

On each request we should be able to acquire the user information from `accessToken` rather than accessing it over and over again from the database. 

###### In our Strategy

```kotlin
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
```

###### In Spring Security

We save those data using `TheadLocal`, which is used in one of the implementations of `SecurityContextHolder` with which in `spring-security` we assign and get user data by:

```kotlin 
// assign
SecurityContextHolder.getContext().authentication = authToken
// get
SecurityContextHolder.getContext().authentication
```



##### JwtHandlerInterceptor 
```kotlin 
package com.kotlinspring.restapi.interceptor

import com.kotlinspring.restapi.jwt.Jwt
import com.kotlinspring.restapi.jwt.TokenPayload
import com.kotlinspring.restapi.jwt.UserContext
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.web.servlet.HandlerInterceptor


class JwtHandlerInterceptor(
    private val jwt: Jwt
) : HandlerInterceptor {
    private val authHeader: String = "Authorization"
    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        UserContext.instance.clear()
        val accessToken = request.getHeader(authHeader).replace("Bearer ", "")
        if (accessToken.isEmpty()) {
            throw Exception("AccessToken cannot be empty")
        }
        val payload: TokenPayload = jwt.parseAndVerifyToken(accessToken)
        UserContext.instance.setUser(payload)
        return true
    }
}
```



#### We are done! Let's make a Request with Header

How simple it is? Now when I make a request with `Authorization: Bearer <token>` I immediately get the user info:


![](/assets/img/2024-06-25-14-21-39.png)


#### Back to `authController/{signup, login}`

No need to explain and straight-forward ;).

```kotlin
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
        println("secret!!!! ${jwt.secretKey}")
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
        val username = "${user.firstname} ${user.lastname}"
        val result = jwt.createToken(userId = user.id!!, email = loginUserDto.email, username = username)
        val token = "Bearer ${result.first}"
        val payload = result.second
        val loginResponse = LoginResponse(token = token, expiresAt = payload.expiredAt)

        return ResponseEntity.ok(loginResponse)
    }
}
```


