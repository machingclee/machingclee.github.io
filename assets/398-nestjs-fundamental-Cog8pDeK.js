const n=`---
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

### Life Cycle of Filters, Guards, Interceptors, Pipes

[![](/assets/img/2025-06-06-04-02-07.png)](/assets/img/2025-06-06-04-02-07.png)

### Loading Environment Variables

At the app module we import the \`ConfigModule\`:

\`\`\`ts
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
\`\`\`

### Dependency Injection

#### Mimicing @Bean which injects return value of a method

\`\`\`ts
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
\`\`\`

Now we can access the return value by using \`@Inject("SOME_SERVICE")\` in the constructor.

### Standard Commands to Memorize

\`\`\`bash
nest g mo <path>          # module
nest g co <path> --flat   # controller
nest g s <path> --flat    # service
\`\`\`


### Swagger


#### configSwagger(app: INestApplication)

The following config a basic swagger doucmentation at \`localhost:<port>/api\`:

\`\`\`ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function configSwagger(app: INestApplication<any>) {
    const config = new DocumentBuilder()
        .setVersion('1.0')
        .setTitle('File Generation API')
        .setDescription('File generation API with base URL at http://localhost:5090')
        .addServer('http://localhost:5090')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api', app, document);
}
\`\`\`

#### injectAuthLogicIntoSwagger(app: NestExpressApplication<any>)

Now the following inject custom logic to \`swagger-ui-init.js\` which intercepts all the request to the swagger documment page. 

\`\`\`js
import { NestExpressApplication } from '@nestjs/platform-express';

export function injectAuthLogicIntoSwagger(app: NestExpressApplication<any>) {
    app.use('/api', (req, res, next) => {
        if (
            req.url.includes('swagger-ui-init.js') ||
            req.url.includes('swagger-initializer.js')
        ) {
            const originalSend = res.send;
            res.send = function (data) {
                const modifiedData = data.replace(
                    'window.ui = ui',
                    \`window.ui = ui
          
  // Custom request interceptor
  ui.getConfigs().requestInterceptor = (request) => {
    const token = localStorage.getItem('bearer_token');
    if (token) {
      request.headers['Authorization'] = \\\`Bearer \\\${token}\\\`;
    }
    return request;
  };

  // Custom response interceptor  
  ui.getConfigs().responseInterceptor = (response) => {
    if (response.url.includes('/auth/login')) {
      try {
        const responseBody = JSON.parse(response.text);
        console.log("responseBodyresponseBody", responseBody)
        if (responseBody.success && responseBody.result && responseBody.result.accessToken) {
          const token = responseBody.result.accessToken;
          localStorage.setItem('bearer_token', token);
          
          const bearerAuth = {
            bearerAuth: {
              name: "Authorization",
              schema: { type: "http", scheme: "bearer" },
              value: token
            }
          };
          
          setTimeout(() => {
            ui.authActions.authorize(bearerAuth);
          }, 100);
        }
      } catch (e) {
        console.error('Error processing login response:', e);
      }
    }
    return response;
  };

  // Auto-authorize on page load if token exists
  const storedToken = localStorage.getItem('bearer_token');
  if (storedToken) {
    const bearerAuth = {
      bearerAuth: {
        name: "Authorization",
        schema: { type: "http", scheme: "bearer" },
        value: storedToken
      }
    };
    
    setTimeout(() => {
      ui.authActions.authorize(bearerAuth);
    }, 500);
  }\`,
                );
                originalSend.call(this, modifiedData);
            };
        }
        next();
    });
}
\`\`\`

What it does:

- When \`auth/login\` was requested, then a response of the type
  \`\`\`ts
  {
    result: {
      accessToken: string
    }
  }
  \`\`\`
  will be returned from our \`login\` endpoint, and we save \`response.result.accessToken\` into local storage.
  
- For any other request, we check to see if \`bearer_token\` was found, we attach our request with authorization header with value \`Bearer <token>\` once it exists.

- In this way we can test JWT authenticated endpoints easily.

#### Apply these to nextjs app

Now in \`main.ts\` we write 
\`\`\`ts{14,15}
async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        cors: true,
    });
    app.enableCors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
        allowedHeaders: '*',
        credentials: false, // Set to false when using origin: "*"
        optionsSuccessStatus: 200,
        preflightContinue: false,
    });
    ...
    injectAuthLogicIntoSwagger(app);
    configSwagger(app);
    ...
    await app.listen(process.env.PORT ?? 5090).then(() => {
        console.log('Listening on: http://localhost:5090');
    });
}
\`\`\`


### Guards and Middleware 


Guards and Middlewares are very similar, but they do have distinctive difference:

#### Key differences

\`\`\`ts
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
        console.log(\`\${req.method} \${req.url}\`);
        next();
    }
}
\`\`\`

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

#### Guard
##### Create a guard boilerplate

To create a guard, let's execute 

\`\`\`bash
nest g guard <module-name>/guards/some --no-spec
\`\`\`
Here it is intended not to pass \`--flat\` as we are going to create \`some\` directory and create a \`some.guard.ts\` file in it. Now this will create a boilerplate for us:

\`\`\`ts{8}
import { Request } from 'express';

export class SomeGuard implements CanActivate {
  canActive(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean>
} {
  // const request = context.switchToHttp().getRequest<Request>();
  return true;
}
\`\`\`

The highlighted provides us a standard \`express.Request\` object to which w can do almost anything such as injecting the user object (after token-verification) as if it is an middleware:

##### Use the guard

\`\`\`ts
@Controller('admin')
@UseGuards(JwtGuard)      // Will have access to ConfigService and UserService
export class AdminController {
    // ...
    @UseGuards(JwtGuard)  // Method level
    async createUser(...) {
      ...
    }
}
\`\`\`


##### Practical example: \`JwtGuard\` and \`@RequestUser\` for controller

- \`JwtGuard\`
  \`\`\`ts
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
  \`\`\`

- \`@RequestUser\`
  \`\`\`ts
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
  \`\`\`


#### Middleware


##### Create a middleware boilerplate

We execute

\`\`\`bash
nest g middleware logger common/middleware
\`\`\`

to create a middleware, which is of the form

\`\`\`bash
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: Function) {
        console.log('Request...');
        next();
    }
}
\`\`\`

##### Use the middlewasre

The middleware can be applied at both controller level or method level:

\`\`\`bash 
@Controller('users')
@UseMiddleware(LoggerMiddleware)  // Applied to all routes in this controller
export class UsersController {
    @Get()
    @UseMiddleware(LoggerMiddleware)  // Applied to specific route
    getUsers() {
        return 'users';
    }
}
\`\`\`


### Filter that acts as \`ControllerAdvice\`


#### GlobalExceptionFilter

\`\`\`ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpStatus,
    HttpException,
} from '@nestjs/common';
import { Response } from 'express';

export class BaseException extends HttpException {
    constructor(
        params: {
            message: string,
            status: HttpStatus
        }
    ) {
        const { message, status = HttpStatus.BAD_REQUEST } = params;
        const response: ErrorResponse = {
            statusCode: status,
            message,
        };
        super(response, status);
    }
} 

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let errorMessage = 'An error occurred';
        let httpStatus: HttpStatus = HttpStatus.BAD_REQUEST;

        if (exception instanceof BaseException) {
            errorMessage = exception.message;
            httpStatus = exception.getStatus();
        }

        // Extract error message from different exception types
        else if (exception instanceof HttpException) {
            const exceptionResponse = exception.getResponse();
            errorMessage =
                typeof exceptionResponse === 'string'
                    ? exceptionResponse
                    : (exceptionResponse as any).message || exception.message;
        }
        // normal error
        else if (exception instanceof Error) {
            errorMessage = exception.message;
        }

        this.logger.error(errorMessage);

        response.status(httpStatus).json({
            success: false,
            errorMessage: errorMessage,
        });
    }
}
\`\`\`
#### Register the \`GlobalExceptionFilter\`

Now in \`main.ts\` let's write

\`\`\`ts
app.useGlobalFilters(new GlobalExceptionFilter());
\`\`\`

### Customer Tag that Works with Guards
#### Define custom tag
\`\`\`ts
import { SetMetadata } from "@nestjs/common"

export const Auth = (...authTypes: string[]) => {
  SetMetadata("SOME_KEY", authTypes)
}
\`\`\`

- Now by using \`@Auth\` to annotate a method, the \`SetMetadata\` will be executed first, injecting a value(s) that can be processed by the guard via \`ExecutionContext\`. 

- Based on this value our guard can behave differently.

#### Extract value provided by custom tag in guards

\`\`\`ts{7-10}
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
\`\`\`
Now we can create an annotation to *unprotect* a route within a \`@UseGuards(JwtGuard)\` protected controller easily.


### Interceptors

#### For Transactions

##### Decorator to set metadata

\`\`\`ts
// transaction.decorator.ts
import { SetMetadata } from '@nestjs/common';
import MetaDataKey from './MetaDataKey';

export const Transactional = () => {
    return SetMetadata(MetaDataKey.TRANSACTION_KEY, true);
};
\`\`\`


##### Interceptor to handle the "before" (to inject entity manager) and "after" (to rollback changes) behaviour of a function



\`\`\`ts{35-38}
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { DataSource } from 'typeorm';
import MetaDataKey from '../decorators/MetaDataKey';
import { firstValueFrom } from 'rxjs';
import { Reflector } from '@nestjs/core';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
    private readonly logger = new Logger(TransactionInterceptor.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly reflector: Reflector,
    ) { }

    async intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();
        const handler = context.getHandler();
        const classRef = context.getClass();

        this.logger.debug(
            \`Checking transaction metadata for \${classRef.name}.\${handler.name}\`,
        );

        const isTransactional = this.reflector.get<boolean>(
            MetaDataKey.TRANSACTION_KEY,
            handler,
        );
\`\`\`
- Since decorator \`@Transactional\` at the controller method level will be executed ***before*** interceptor, we can determine if a controller method requires an entity manager for a transaction at the lighted lines. 

- These lines get the variable we set at \`@Transactional\`.

\`\`\`ts{10}
        if (!isTransactional) {
            return next.handle();
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        // Store the transaction manager in the request
        request.transactionManager = queryRunner.manager;

        try {
            const result = await firstValueFrom(next.handle());
            await queryRunner.commitTransaction();
            return of(result);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}
\`\`\`

Note that once \`@Transactional()\` was annotated to a method, the global interceptor above will set an entity manager into the request object, which can be resolved by annotation the following annotation at the argument:


##### ParamDecorator to get EntityManager from Request Object

\`\`\`ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export const TransactionManager = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): EntityManager | undefined => {
        const request = ctx.switchToHttp().getRequest();
        return request.transactionManager;
    },
); 
\`\`\`

##### Exmaple of using \`@Transactional\` annotation

\`\`\`ts
@Transactional()
@Post('/some-object')
async createObj(
    @RequestUser() user: JwtTokenPayload,
    @TransactionManager() em: EntityManager, 
    // Since we have @Transactional, 
    // EntityManager becomes available
) {
    await this.exportTempalteAppService.createObject(user, em);
    return new SuccessDto(null);
}
\`\`\`

Now for transaction to function normally:
- We replace all \`SomeTableRepository.someMethod(...args)\` by \`em.someMethod(SomeTable, ...args)\` within our application service.



##### Register the interceptor globally

Within \`boostrap\` let's add

\`\`\`ts
import { INestApplication } from '@nestjs/common';
import { TransactionInterceptor } from '../../../common/interceptors/transaction.interceptor';
import { DataSource } from 'typeorm';
import { Reflector } from '@nestjs/core';

const boostrap = (app: INestApplication) => {
    ...
    app.useGlobalInterceptors(
        new TransactionInterceptor(app.get(DataSource), app.get(Reflector)),
    );
}
\`\`\`


#### For Request Logging (especially failed ones)

\`\`\`ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, headers } = request;
        const now = Date.now();

        // Log request details with more information
        this.logger.log(
            \`Incoming Request: \${method} \${url}\`,
            {
                headers: this.sanitizeHeaders(headers),
                body: this.sanitizeBody(body),
                contentType: headers['content-type'],
                debug: {
                    hasBody: !!body,
                    bodyType: body ? typeof body : 'undefined',
                    bodyKeys: body ? Object.keys(body) : []
                }
            },
        );

        return next.handle().pipe(
            tap({
                next: (responseBody) => {
                    const response = context.switchToHttp().getResponse();
                    const delay = Date.now() - now;

                    // Log both successful and unsuccessful responses
                    if (responseBody && responseBody.success === false) {
                        this.logger.warn(
                            \`Unsuccessful Response: \${method} \${url} \${response.statusCode} - \${delay}ms\`,
                            {
                                response: responseBody,
                                request: {
                                    body: this.sanitizeBody(body),
                                    method,
                                    url
                                }
                            },
                        );
                    } else {
                        this.logger.log(
                            \`Outgoing Response: \${method} \${url} \${response.statusCode} - \${delay}ms\`,
                            {
                                response: responseBody,
                                request: {
                                    body: this.sanitizeBody(body),
                                    method,
                                    url
                                }
                            },
                        );
                    }
                },
                error: (error) => {
                    const response = context.switchToHttp().getResponse();
                    const delay = Date.now() - now;
                    this.logger.error(
                        \`Error Response: \${method} \${url} \${response.statusCode} - \${delay}ms\`,
                        {
                            error: error.message,
                            stack: error.stack,
                            request: {
                                body: this.sanitizeBody(body),
                                method,
                                url
                            }
                        },
                    );
                }
            })
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
        if (!body) return 'No body';

        const sanitized = { ...body };
        // Remove sensitive fields if they exist
        if (sanitized.password) delete sanitized.password;
        if (sanitized.token) delete sanitized.token;
        if (sanitized.accessToken) delete sanitized.accessToken;
        if (sanitized.refreshToken) delete sanitized.refreshToken;

        return sanitized;
    }
} 
\`\`\`

Now we register the logger at boostrap:
\`\`\`ts
    app.useGlobalInterceptors(new LoggingInterceptor());
\`\`\`

### More Error Logging for Debug Purpose

By default when an error reach our \`LoggingInterceptor\` the error stackTrace is lost. To get more detail on which file and which line the exception occurs at which file, we need the following:

\`\`\`ts
export class AppModule {
    onModuleInit() {
        process.on('uncaughtException', err => {
            console.error('Uncaught Exception:', err.stack);
            console.info('Node NOT Exiting...');
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }
}

\`\`\``;export{n as default};
