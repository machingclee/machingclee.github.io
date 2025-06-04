---
title: Fundamentals of Nestjs
date: 2025-06-05
id: blog0398
tag: nestjs
toc: true
intro: "Record the study of standard concepts from nestjs while working in the current company."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px
  }
</style>

#### Life Cycle of Filters, Guards, Interceptors, Pipes



[![](/assets/img/2025-06-05-04-01-39.png)](/assets/img/2025-06-05-04-01-39.png)

#### Loading Environment Variables

At the app module we import the `ConfigModule`:

```ts
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  ...,
  imports: [
      ...,
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => {
            const dotenv = require('dotenv');
            const fs = require('fs');

            const localEnv: DotenvResult = dotenv.config({ path: '.env.local' });
            if (localEnv.error) {
              console.error('Error loading .env.local:', localEnv.error);
            }

            const internalEnvPath = '.env.local.internal';
            let internalEnv: DotenvResult = { parsed: {} };

            if (fs.existsSync(internalEnvPath)) {
              internalEnv = dotenv.config({ path: internalEnvPath });
              if (internalEnv.error) {
                console.error(
                  'Error loading .env.local.internal:',
                  internalEnv.error,
                );
              }
            } else {
              console.warn('.env.local.internal file not found');
            }

            return {
              ...localEnv.parsed,
              ...internalEnv.parsed,
            };
          },
        ],
      })
      ...
  ]
})
```

#### Dependency Injection

##### Mimicing @Bean which injects return value of a method

```ts
@Module({
  providers: [OtherService],
  exports: [OtherService]
})
export class OtherModule {}

// some.module.ts
@Module({
  imports: [OtherModule],  // Import for non-global dependency
  providers: [
    {
      provide: 'SOME_SERVICE',
      useFactory: (
        configService: ConfigService,  // Global dependency
        otherService: OtherService     // Non-global dependency
      ) => {
        return new SomeService(
          configService.get('SOME_KEY'),
          otherService
        );
      },
      inject: [ConfigService, OtherService]
    }
  ]
})
```

Now we can access the return value by using `@Inject("SOME_SERVICE")` in the constructor.

#### Standard Commands to Memorize

#### Swagger

#### Pipe

#### Guards and Middleware 


Guards and Middlewares are very similar, but they do have distinctive difference:

##### Key differences

```ts
// Guard - Authentication/Authorization
@Injectable()
export class AuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        // Good for:
        // - Authentication
        // - Authorization
        // - Role checking
        // - Permission validation
        return true;
    }
}

// Middleware - Request Processing
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: Function) {
        // Good for:
        // - Logging
        // - Request parsing
        // - Adding headers
        // - CORS
        console.log(`${req.method} ${req.url}`);
        next();
    }
}
```
Key Differences:

**1. Purpose.**
- Middleware: Request processing and modification

- Guards: Authentication and authorization

**2. Capabilities.**
- Middleware: Can modify request/response

- Guards: Can stop request flow, throw exceptions

**3. Context.**
- Middleware: Limited to request/response

- Guards: Full access to ExecutionContext

**4. Dependency Injection.**
- Middleware: ***Limited*** (unless class-based)

- Guards: ***Full support***

**5. Exception Handling.**
- Middleware: ***Manual handling***

- Guards: Integrated ***with exception filters***

##### Guard
###### Create a guard boilerplate

To create a guard, let's execute 

```bash
nest g guard <module-name>/guards/some --no-spec
```
Here it is intended not to pass `--flat` as we are going to create `some` directory and create a `some.guard.ts` file in it. Now this will create a boilerplate for us:

```ts{8}
import { Request } from 'express';

export class SomeGuard implements CanActivate {
  canActive(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean>
} {
  // const request = context.switchToHttp().getRequest<Request>();
  return true;
}
```

The highlighted provides us a standard `express.Request` object to which w can do almost anything such as injecting the user object (after token-verification) as if it is an middleware:

###### Use the guard

```ts
@Controller('admin')
@UseGuards(JwtGuard)      // Will have access to ConfigService and UserService
export class AdminController {
    // ...
    @UseGuards(JwtGuard)  // Method level
    async createUser(...) {
      ...
    }
}
```


###### Practical example: `JwtGuard` and `@RequestUser` for controller

- `JwtGuard`
  ```ts
  import {
      Injectable,
      CanActivate,
      ExecutionContext,
      UnauthorizedException,
  } from '@nestjs/common';
  import { verify } from 'jsonwebtoken';
  import { Request } from 'express';
  import { ConfigService } from '@nestjs/config';
  import { JwtTokenPayload } from '../types/JwtTokenPayload';

  @Injectable()
  export class JWTGuard implements CanActivate {
      constructor(private readonly configService: ConfigService) {}

      canActivate(context: ExecutionContext): boolean {
          const request = context.switchToHttp().getRequest<Request>();
          const token = this.extractTokenFromHeader(request);

          if (!token) {
              throw new UnauthorizedException();
          }

          try {
              const decoded = verify(
                  token,
                  this.configService.get('JWT_SECRET') || '',
              ) as JwtTokenPayload;
              decoded.accessToken = token;
              request.user = decoded;
              return true;
          } catch (error) {
              console.error('JWT decode error:', JSON.stringify(error));
              throw new UnauthorizedException('Invalid token');
          }
      }

      private extractTokenFromHeader(request: Request): string | undefined {
          const authHeader = request.headers.authorization;
          if (!authHeader) return undefined;

          const [type, token] = authHeader?.split(' ') || [];
          return type === 'Bearer' ? token : undefined;
      }
  }
  ```

- `@RequestUser`
  ```ts
  import { createParamDecorator, ExecutionContext } from '@nestjs/common';

  export const RequestUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
      const request = ctx.switchToHttp().getRequest();

      if (!request.user) {
          return null;
      }

      if (data) {
          return request.user[data];
      }

      return request.user;
  });
  ```


##### Middleware


###### Create a middleware boilerplate

We execute

```bash
nest g middleware logger common/middleware
```

to create a middleware, which is of the form

```bash
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: Function) {
        console.log('Request...');
        next();
    }
}
```

###### Use the middlewasre

The middleware can be applied at both controller level or method level:

```bash 
@Controller('users')
@UseMiddleware(LoggerMiddleware)  // Applied to all routes in this controller
export class UsersController {
    @Get()
    @UseMiddleware(LoggerMiddleware)  // Applied to specific route
    getUsers() {
        return 'users';
    }
}
```


#### Filter that acts as `ControllerAdvice`


#### LoggingInterceptor

```ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, headers } = request;
        const now = Date.now();

        // Log request details
        this.logger.log(
            `Incoming Request: ${method} ${url}`,
            {
                headers: this.sanitizeHeaders(headers),
                body: this.sanitizeBody(body),
            },
        );

        return next.handle().pipe(
            tap((responseBody) => {
                const response = context.switchToHttp().getResponse();
                const delay = Date.now() - now;
                this.logger.log(
                    `Outgoing Response: ${method} ${url} ${response.statusCode} - ${delay}ms`,
                    {
                        response: this.sanitizeBody(responseBody),
                    },
                );
            }),
        );
    }

    private sanitizeHeaders(headers: any): any {
        const sanitized = { ...headers };
        // Remove sensitive information
        delete sanitized.authorization;
        delete sanitized.cookie;
        return sanitized;
    }

    private sanitizeBody(body: any): any {
        if (!body) return body;

        const sanitized = { ...body };
        // Remove sensitive fields if they exist
        if (sanitized.password) delete sanitized.password;
        if (sanitized.token) delete sanitized.token;
        if (sanitized.accessToken) delete sanitized.accessToken;
        if (sanitized.refreshToken) delete sanitized.refreshToken;

        return sanitized;
    }
} 
```

Now we register this global interceptor at the application root level:

```ts{6}
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });
  ...
  app.useGlobalInterceptors(new LoggingInterceptor());
  ...
  await app.listen(process.env.PORT ?? 5090).then(() => {
    console.log('Listening on: http://localhost:5090');
  });
}

bootstrap();
```

#### Customer Tag that Works with Guards
##### Define custom tag
```ts
import { SetMetadata } from "@nestjs/common"

export const Auth = (...authTypes: string[]) => {
  SetMetadata("SOME_KEY", authTypes)
}
```

- Now by using `@Auth` to annotate a method, the `SetMetadata` will be executed first, injecting a value(s) that can be processed by the guard via `ExecutionContext`. 

- Based on this value our guard can behave differently.

##### Extract value provided by custom tag in guards

```ts{7-10}
export class SomeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector
  )

  canActive(context: ExecutionContext): boolean {
    const authType = this.reflector.getAllAndOverride("SOME_KEY", [
      context.getHandler(),
      context.getClass()
    ]) || []
  }
}
```
Now we can create an annotation to *unprotect* a route within a `@UseGuards(JwtGuard)` protected controller easily.


#### Interceptors

##### Create @Transactional Dectorator
###### Decorator to set metadata

```ts
// transaction.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const TRANSACTION_KEY = 'transaction';
export const Transactional = () => SetMetadata(TRANSACTION_KEY, true);

// transaction-manager.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TransactionManager = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.transactionManager;
    },
);
```

###### Interceptor to handle the "before" and "after" behaviour of a function

```ts
// transaction.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { TRANSACTION_KEY } from './transaction.decorator';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
    constructor(private readonly dataSource: DataSource) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();
        const handler = context.getHandler();
        const isTransaction = Reflect.getMetadata(TRANSACTION_KEY, handler);

        if (!isTransaction) {
            return next.handle();
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        request.transactionManager = queryRunner.manager;

        try {
            const result = await next.handle().toPromise();
            await queryRunner.commitTransaction();
            return result;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}
```

###### Register the interceptor globally

Within `boostrap` let's add

```ts
app.useGlobalInterceptors(new TransactionInterceptor(app.get(DataSource)));
```

##### Create Interceptor for data transformation

Assume that we have defined an `API_VERSION` in environment variable, now we wish to attach this data in every response:

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map, tap } from 'rxjs';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class DataResponseInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        apiVersion: this.configService.get('API_VERSION'),
        success: true,
        result: data
      })),
    );
  }
}
```
and we register this globally in `boostrap`:
```ts
app.useGlobalInterceptors(new DataResponseInterceptor(app.get(ConfigService)));
```