---
title: "Application Event Publisher in Nodejs"
date: 2024-09-30
id: blog0326
tag: nodejs, express
toc: true
intro: "We have talked about monolithic DDD in the context of spring boot with the help of spring-provided ApplicationEventPublisher instance via dependency injection. This is not unique to spring and let's bring it into nodejs in the express framework."
---

<style>
  img {
    max-width: 660px;
  }
</style>

#### Building Blocks

##### ApplicationEvent and Application Event Publisher

```ts{3,16}
import EventEmitter from 'eventemitter3';

export class ApplicationEvent<S extends string, T, R = T> {
    public result: R | null = null
    constructor(
        public type: S,
        public data: T,
    ) { }
}

type InferEventType<T> = T extends ApplicationEvent<infer U, any> ? U : never;

type EventProcessor<Event = any> = (event: Event) => void | Promise<void>;
type OrderedEventHandler<Event = any> = { processor: EventProcessor<Event>, order: number }

class ApplicationEventPublisher {
    private eventEmitter: EventEmitter;
    private handlers: Map<string, OrderedEventHandler[]> = new Map<string, OrderedEventHandler[]>()

    constructor() {
        this.eventEmitter = new EventEmitter();
    }

    async publishEvent<S extends string, T>(event: ApplicationEvent<S, T>): Promise<void> {
        const handlers = this.handlers.get(event.type).sort((a, b) => a.order - b.order);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    const processor = handler.processor as EventProcessor<typeof event>
                    await processor(event)
                } catch (error) {
                    console.error(`Error in event handler for ${event.type}:`, error);
                };
            }
        }
    }

    addEventHandler = <T>(evenType: InferEventType<T>, handler: EventProcessor<T>, order: number = 1): void => {
        if (!this.handlers.has(evenType)) {
            this.handlers.set(evenType, []);
        }
        this.handlers.get(evenType)!.push({ processor: handler, order });
    }
}

export default ApplicationEventPublisher
```

##### Example: StudentCreatedEvent

```ts
export class StudentCreatedEvent extends ApplicationEvent<
  "StudentCreatedEvent",
  CreateStudentRequest
> {}
```

Note that when no constructor is defined, the parent constructor will be called automatically.

#### Middlewares to Inject ApplicationEventPublisher for Each Request

At the entry level of the application let's apply two middlewares sequentially:

```ts
app.use(eventBusMiddleware, repositoryMiddleware);
```

##### EventBus

###### studentEventHandler.ts

```ts
import { db } from "../../db/database";
import { StudentCreatedEvent } from "../repository/StudentRepository";
import ApplicationEventPublisher from "../../src/util/ApplicationEventPublisher";

export const registerStudentEvents = (
  applicationEventPublisher: ApplicationEventPublisher
) => {
  applicationEventPublisher.addEventHandler<StudentCreatedEvent>(
    "StudentCreatedEvent",
    async (event) => {
      const student = event.data;
      const student_ = await db
        .insertInto("Student")
        .values(student)
        .returningAll()
        .executeTakeFirst();
      if (!student_) {
        throw new Error("Studnet insertion fails");
      }
      event.result = student_;
    }
  );
};
```

###### eventBusMiddleware.ts

Note that everytime we create a publisher we register all the events we wish to listen:

```ts{15}
import { NextFunction, Request, Response } from "express";
import ApplicationEventPublisher from "../util/ApplicationEventPublisher"
import { registerStudentEvents } from "../../domain/eventHandlers/studentEventHandler";

declare global {
    namespace Express {
        interface Request {
            applicationEventPublisher: ApplicationEventPublisher
        }
    }
}

export default async (req: Request, res: Response, next: NextFunction) => {
    const applicationEventPublisher = new ApplicationEventPublisher()
    registerStudentEvents(applicationEventPublisher)
    req.applicationEventPublisher = applicationEventPublisher
    next()
}
```

##### repositoryMiddleware.ts

```ts
import { NextFunction, Request, Response } from "express";
import StudentRepository from "../../domain/repository/StudentRepository";

declare global {
  namespace Express {
    interface Request {
      studentRepository: StudentRepository;
    }
  }
}

export default async (req: Request, res: Response, next: NextFunction) => {
  req.studentRepository = new StudentRepository(req.applicationEventPublisher);
  next();
};
```

#### Experiment

##### Before we Design Aggregates from Table of Relations

Let's consider the following relations:

<a href="/assets/img/2024-09-30-03-42-57.png" target="_blank">![](/assets/img/2024-09-30-03-42-57.png)</a>

- A **_student_** has many **_packages_**, each **_package_** has many **_classes_**.

- Each of the three entities has very rich domain behaviours.

- Hierarchically packages and classes should be inside of the `StudentDomain` aggregate by what we learn about what consitutes an aggregate. But recall from

  > [What makes an Aggregate (DDD)? Hint: it's NOT hierarchy & relationships](https://www.youtube.com/watch?v=djq0293b2bA)

  by CodeOpinion

  - We should think about what's the actual behaviours?

  - What consistency do we need within a cluster of entities?

  - Query Performance? Do we always need all informations?

  By these considerations it makes sense to break an aggregate into smaller aggregates, when a vending machine dispatch an alarm, we let `Route` aggregate to listen on the domain event, consume it, and execute subsequent action:

  ![](/assets/img/2024-09-30-03-55-09.png)

##### Define Aggregates

###### AbstractAggregateRoot

Let's define a base class for our aggregates. We intentionally not to use abstract class because special config in `package.json` needs to be set to make it work.

```ts
export default class AbstractAggregateRoot {
  private applicationEventPublisher: ApplicationEventPublisher | null = null;
  private events: any[] = [];

  setApplicationEventPublisher(
    applicationEventPublisher: ApplicationEventPublisher
  ) {
    this.applicationEventPublisher = applicationEventPublisher;
  }

  public save = async () => {
    for (const event of this.events) {
      await this.applicationEventPublisher?.publishEvent(event);
    }
  };

  public registerEvent = <S extends string, T>(
    event: ApplicationEvent<S, T>
  ) => {
    this.events.push(event);
  };
}
```

###### StudentDomain

For now our focus is on `applicationEventPublisher`, so let's just provide a definition to represent a smaller aggregate where we get rid of `Class`'s.

```ts{5,7-8}
export default class StudentDomain extends AbstractAggregateRoot {
    constructor(
        private student: Student | null,
        private packages: Student_package[],
        applicationEventPublisher: ApplicationEventPublisher
    ) {
        super()
        super.setApplicationEventPublisher(applicationEventPublisher)
    }
}
```

The highlighted lines will be technically the only **_boilerplate_** code for all of our aggregate roots. Recall that domain behaviours need to be published for other domain object to subscribe.

##### Define StudentRepository

Recall that a **_repository_** by convention is defined to return **_aggregate root(s)_**. In our convention each aggregate will be called `something-Domain`.

```ts
class StudentRepository {
  constructor(private applicationEventPublisher: ApplicationEventPublisher) {}

  createRoot = async (
    student: CreateStudentRequest
  ): Promise<StudentDomain> => {
    const event = new StudentCreatedEvent("StudentCreatedEvent", student);
    const result = await this.applicationEventPublisher.publishEvent(event);
    return new StudentDomain(
      event.result as Student,
      [],
      this.applicationEventPublisher
    );
  };
  getStudentById = async (uuid: string): Promise<StudentDomain> => {
    const result = await studentAggQuery
      .where("Student.id", "=", uuid)
      .executeTakeFirst();
    if (!result) {
      return new StudentDomain(null, [], this.applicationEventPublisher);
    }
    const { studentPackages, ...student } = result;
    const studentDomain = new StudentDomain(
      student,
      studentPackages,
      this.applicationEventPublisher
    );
    return studentDomain;
  };
  getStudentsByParentEmail = async (
    email: string
  ): Promise<StudentDomain[]> => {
    const result = await studentAggQuery
      .where("Student.parent_email", "=", email)
      .execute();
    if (!result) {
      return [];
    }
    const studentDomains: StudentDomain[] = [];
    result.forEach((r) => {
      const { studentPackages, ...student_ } = r;
      const studentDomain = new StudentDomain(
        student_,
        studentPackages,
        this.applicationEventPublisher
      );
      studentDomains.push(studentDomain);
    });
    return studentDomains;
  };
}

const studentAggQuery = db
  .selectFrom("Student")
  .selectAll("Student")
  .select((eb) => [
    jsonArrayFrom(
      eb
        .selectFrom("Student_package")
        .selectAll("Student_package")
        .whereRef("Student_package.student_id", "=", "Student.id")
    ).as("studentPackages"),
  ]);

export default StudentRepository;
```

##### Let's Dispatch StudentCreatedEvent

Let's study the simplest case of domain event: create a `Student` aggregate. Recall that we have defined a listener to create a `Student` in `studentEventHandler.ts`.

```ts
const createStudent = async (req: Request, res: Response) => {
  const body = req.body as CreateStudentRequest;

  const result = createStudentSchema.safeParse(body);
  if (!result.success) {
    const errorObject = zodErrMsgUtil.format(result.error.errors);
    return res.json({
      success: false,
      errorObject,
    });
  }
  const studentDomain = await req.studentRepository.createRoot(body);
  res.json({
    success: true,
  });
};
```

##### Publisher Result

In the following `id` is generated when inserting the data:

![](/assets/img/2024-09-30-04-21-06.png)

The presence of `event.result` indicates the `applicationEventPublisher` functions as expected. Recall that by default we set `event.result = null` before dispatching the event.
