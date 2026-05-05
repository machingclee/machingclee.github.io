const n=`---
title: "Domain Driven Design (DDD) Implementation via Kotlin, Spring Boot and Axon Framework"
date: 2024-07-19
id: blog0279
tag: springboot, kotlin
wip: true
toc: true
intro: "We record a standard project sturcture using DDD and axon framework."
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Warning
The content of this post is ***tentative*** and ***subject to change***. This post will be finalized after my recent project is done.

### Continuation of Modularized Application, and Why?

> We have studied modularization in [***this article***](/blog/article/Gradle-Fundamentals-Modularization-of-Spring-Boot-Project-and-Dependencies-Control).

- Without \`modularization\` any package can ***abuse*** imports from each another and there is no way to enjoy good maintainability of DDD.

- Especially when your team has junior/senior developers who cannot grasp the concept of DDD. The project will become a complete mess with their contribution that ***just and only just*** reaches the PM requirements. 

- The culprit:  ***No restriction on what to import within a package***. An illustrative example that is pervasive anywhere:
  
  - Writing queries directly in controller.
  - Executing SQLs to change the state of database directly in controller.

  How could we even write a unit test to such a controller?

- With modularization you have complete control on dependencies (code accessibility) within modules.

### Concrete References for DDD architecture

Let's refer to this diagram of layers in our DDD model:

![](/assets/img/2024-07-21-02-18-58.png)

For concrete example of each layer we can refer to the following repository:

- > [Leave-Application](https://github.com/xlorne/springboot-ddd-examples/tree/master/12-leave-parent)

  This is partially DDD, it illustrates the idea but is not complete (without any commands and event handlers)

For a more complete example using domain events, see:

- > [KOTLIN-DDD-SAMPLE with Axon Framework](https://github.dev/Creditas/kotlin-ddd-sample)

### Axon Framework
#### Including Axon Framework in Gradle Project

Create a gradle plugin \`gradle/plugins/java-plugins/src/main/kotlin/axon.gradle.kts\`:
\`\`\`kotlin
plugins {
    id("java-library")
}

val axonVersion = "4.9.3"

dependencies {
    implementation("org.axonframework:axon-spring:$axonVersion")
    implementation("org.axonframework:axon-spring-boot-autoconfigure:$axonVersion")
}
\`\`\`

and then include this plugin inside any \`build.gradel.kts\` of any module that you want to use axon framework:

\`\`\`kotlin 
plugins {
    kotlin("jvm") version "1.9.23"
    id("axon")
}
\`\`\`

#### Annotations from Axon Framework: @Aggregate, @CommandHandler, @EventSourcingHandler and @EventHandler


##### domain.aggregates (Involved: @CommandHandler, @CreationPolicy, @EventSourcingHandler)

\`\`\`kotlin 
package com.machingclee.payment.domain

import com.machingclee.application.events.DummyEvent
import com.machingclee.payment.application.commands.DummyCommand
import org.axonframework.commandhandling.CommandHandler
import org.axonframework.eventsourcing.EventSourcingHandler
import org.axonframework.modelling.command.AggregateCreationPolicy
import org.axonframework.modelling.command.AggregateIdentifier
import org.axonframework.modelling.command.AggregateLifecycle
import org.axonframework.modelling.command.CreationPolicy
import org.axonframework.spring.stereotype.Aggregate
import java.util.UUID

@Aggregate
class DummyAggregate() {
    @AggregateIdentifier
    private var uuid: UUID? = null
    private var dummyValue: Int = 0
    private var context: String = ""

    @CommandHandler
    @CreationPolicy(AggregateCreationPolicy.CREATE_IF_MISSING)
    fun handle(dummyCommand: DummyCommand): String {
        println("Handling this command")
        println(dummyCommand)
        val event = DummyEvent(
            uuid = dummyCommand.uuid,
            dummyValue = dummyCommand.dummyValue,
            context = dummyCommand.context
        )
        AggregateLifecycle.apply(event)
        return dummyCommand.context
    }

    @EventSourcingHandler
    fun on(dummyEvent: DummyEvent) {
        println("Event sourcing handler")
        uuid = dummyEvent.uuid
        dummyValue = dummyEvent.dummyValue
        context = dummyEvent.context
    }
}
\`\`\`


##### application.commands

\`\`\`kotlin
package com.machingclee.payment.application.commands

import org.axonframework.modelling.command.TargetAggregateIdentifier
import java.util.UUID

data class DummyCommand(
    @TargetAggregateIdentifier
    val uuid: UUID,
    val dummyValue: Int,
    val context: String
)
\`\`\`


##### application.events (Involved: @Component, @EventHandler)

\`\`\`kotlin
package com.machingclee.application.events

import java.util.UUID

data class DummyEvent(
    val uuid: UUID,
    val dummyValue: Int,
    val context: String
)
\`\`\`

\`\`\`kotlin
package com.machingclee.payment.application.event

import com.machingclee.application.events.DummyEvent
import org.axonframework.eventhandling.EventHandler
import org.springframework.stereotype.Component

@Component
class EventHandlers {
    @EventHandler
    fun handle(dummyEvent: DummyEvent) {
        println("End of this event $dummyEvent")
    }
}
\`\`\`

- \`@EventHandler\` cannot be defined inside of \`@Aggregate\`, this is to ensure \`@EventSourcingHandler\` must run before \`@EventHandler\` (otherwise we get an error.)



#### Event Sourcing and Post Request for Testing

##### Controller and Result

Let's define a controller to test our dummy command


\`\`\`kotlin
package com.machingcleepayment.restapi.controller


import com.machingcleepayment.application.commands.DummyCommand
import com.machingcleepayment.restapi.dto.DummyDTO
import org.axonframework.commandhandling.gateway.CommandGateway
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.*


@RestController
@RequestMapping("/dummy")
class DummyController(
    private val commandGateway: CommandGateway
) {
    @PostMapping("")
    @ResponseStatus(HttpStatus.CREATED)
    fun dummyMethod(@RequestBody dummyDTO: DummyDTO): Any? {
        val command = DummyCommand(
            uuid = UUID.randomUUID(),
            dummyValue = dummyDTO.dummyValue,
            context = dummyDTO.context
        )
        val result = commandGateway.sendAndWait<Any>(command)
        return result
    }
}
\`\`\`
with the following post request:

![](/assets/img/2024-07-20-15-08-33.png)

We get the following result:

\`\`\`text
Handling this command
DummyCommand(uuid=da63edcf-ad48-42d1-ac0d-1c17b52782dc, dummyValue=123, context=this is a test context)
Event source handler
End of this event DummyEvent(uuid=da63edcf-ad48-42d1-ac0d-1c17b52782dc, dummyValue=123, context=this is a test context)
\`\`\`

Not only that, if we have proper configuration for PGSQL ***introduced in the next section*** right below, we get an event sourcing record in our database:

\`\`\`sql
select encode(payload, 'escape')::jsonb
from domain_event_entry
\`\`\`

![](/assets/img/2024-07-20-15-29-52.png)

sql syntax that supports json is also feasible:

![](/assets/img/2024-07-20-15-16-27.png)


##### Configuration to Change PostgreSQLDialect for Altering Column of domain_event_entry

By default the payload of \`domain_event_entry\` in PostgreSQL is a 5-digit number:

\`\`\`text
SELECT payload FROM domain_event_entry;
| payload |
| 24153   |
\`\`\`
Special configuration has to made in order to display the payload at least in \`bytea\` format:
\`\`\`kotlin
package com.machingclee.restapi.config

import org.hibernate.boot.model.TypeContributions
import org.hibernate.dialect.DatabaseVersion
import org.hibernate.dialect.PostgreSQLDialect
import org.hibernate.service.ServiceRegistry
import org.hibernate.type.SqlTypes
import org.hibernate.type.descriptor.jdbc.BinaryJdbcType
import org.springframework.context.annotation.Configuration
import java.sql.Types

@Configuration
class NoToastPostgresSQLDialect : PostgreSQLDialect(DatabaseVersion.make(9, 5)) {
    override fun columnType(sqlTypeCode: Int): String {
        return if (sqlTypeCode == SqlTypes.BLOB) {
            "bytea"
        } else super.columnType(sqlTypeCode)
    }

    override fun castType(sqlTypeCode: Int): String {
        return if (sqlTypeCode == SqlTypes.BLOB) {
            "bytea"
        } else super.castType(sqlTypeCode)
    }

    override fun contributeTypes(typeContributions: TypeContributions, serviceRegistry: ServiceRegistry?) {
        super.contributeTypes(typeContributions, serviceRegistry)
        val jdbcTypeRegistry = typeContributions.typeConfiguration.jdbcTypeRegistry
        jdbcTypeRegistry.addDescriptor(Types.BLOB, BinaryJdbcType.INSTANCE)
    }
}
\`\`\`

And inside \`application.yml\` we adjust:

\`\`\`yml{11,14}
spring:
  application:
    name: course-catalog-service
  datasource:
    driver-class-name: org.postgresql.Driver
    url: jdbc:postgresql://<host>/<table-name>
    username: <username>
    password: <password>
  jpa:
    hibernate:
      ddl-auto: update
    properties:
      hibernate:
        dialect: com.machingcleepayment.restapi.config.NoToastPostgresSQLDialect
\`\`\`
- Make sure the corresponding schema changes is trackable in Prisma/Flyway.

- If needed, please delete the tables just made and created new ones using the corresponding schema-versioning framework.
- For example, if we are using \`Prisma\`, we may 
  1. \`npx prisma db pull\` to get the latest scehma definition.

  2. Delete the tables made by jpa.
  3. \`npx prisma migrate dev\` to generate \`CREATE TABLE\` script.





### Description of Each Module/Layer

Let's refer to this diagram again:


![](/assets/img/2024-07-21-02-18-58.png)

#### User Interface (RestAPI) Module

This is like our controllers in MVC. The entrypoint of our spring boot application is also here.

#### Application Module

This is like our services in MVC. Service layer in the past will be replaced by domain object's behaviour in this module.

- Note that we create \`IRepostories\` in \`domain\` layer, therefore \`application\` layer has access to repositories (via **interfaces** and spring's **dependencies injection**). 

- In this moduole we also create:
  - \`Command\`
  - \`Event\`
  - \`EventHandler\`

- \`CommandHandler\` will be defined in \`domain.aggregates\` (domain module) in axon-framework

- Business logic occurs here, for example:
  \`\`\`kotlin
  open class OrderCommandHandlers(private val repository: OrderRepository,
                                  private val paymentService: PaymentService,
                                  private val eventBus: EventBus) {
      @CommandHandler
      fun createOrder(command: CreateOrderCommand): UUID {
          val orderId = UUID.randomUUID()
          // with JOOQ we will create many methods in repository via DAO's
          val customer = repository.findCustomerById(command.customerId)
          val order = Order(orderId, customer)
          repository.save(order)

          return orderId
      }
  }
  \`\`\`
- We create domain object via repositories, and domain object has behaviour:

  \`\`\`kotlin
  @CommandHandler
  fun OrderCommandHandlers.changeProductQuantity(command: ChangeProductQuantityCommand) {
      val order = repository.findById(command.orderId)
      val product = repository.findProductById(command.productId)

      order.changeProductQuantity(product, command.quantity)

      repository.save(order)
  } 
  \`\`\`

Since \`domain\` layer has no access to \`infrastructure\`, all ***database state changes*** are executed by \`application\` layer via \`Repository.save()\`.


#### Domain Module

This module provides domain-specific logic such as 

- Domain objects (Note that domain object only describes behaviour, it does not interact with database)
  \`\`\`kotlin
  class Order(val id: UUID, val customer: Customer) {
      private val items = mutableListOf<Item>()
      var paid: Boolean = false
          private set

      fun addProduct(product: Product, quantity: Int) {
          if (items.any { it.product == product })
              throw BusinessException("Product already exists!")

          var item = Item(product, quantity)
          items.add(item)
      }

      fun changeProductQuantity(product: Product, quantity: Int) {
          validateIfProductIsOnList(product)

          var item = items.first { it.product == product }
          item.changeQuantity(quantity)
      }

      fun removeProduct(product: Product) {
          validateIfProductIsOnList(product)

          items.removeAll { it.product == product }
      }

      fun pay(creditCard: CreditCard, paymentService: PaymentService, eventBus: EventBus) {
          if (this.paid)
              throw BusinessException("Order already paid!")

          val debitedWithSuccess = paymentService.debitValueByCreditCard(creditCard)
          if (debitedWithSuccess) {
              this.paid = true
              eventBus.publish(GenericEventMessage.asEventMessage<OrderPaid>(OrderPaid(this.id))) //TODO improve this by putting some helpers in a aggregate base class and may creating an DomainEvent base class
          } else {
              throw BusinessException("The amount could not be debited from this credit card")
          }
      }

      fun items() = items.toList()

      private fun validateIfProductIsOnList(product: Product) {
          var isOnList = items.any { it.product == product }
          if (!isOnList)
              throw BusinessException("The product isn't included in this order")
      }
  }
  \`\`\`
- Domain services (that contains logic that cannot be part of the aggregate root), and
- The interfaces of repositories for \`infrastructure\` module.

#### Infrastructure Module

Our domain objects will be created here (while the class definitions come from domain layer). 

- Each domain object will be integrated into an aggregate and equipped with behavious that change the internal state of aggregates.

- Each state of aggregates is saved by \`Repository.save(aggregate)\` function.



- In this layer we implement both \`DAO\`'s and \`Respository\`'s. Most of the time we would see that \`Repository\` $\\to$ \`DAO\`'s and we call the objects obtained from \`DAO\` as \`POJO\`. 

- The \`User Interface\` (restapi) layer also directly return \`POJO\`'s to the frontend via \`DAO\`'s. 

- In case more complex (read) query is needed, we extent \`JOOQ\`'s auto-generated \`DAO\` and add extra query method.


- An ordinary repository implmenetation looks as follows (recall that \`Order\` is an aggregate):

  \`\`\`kotlin
  class OrderRepositoryImpl : OrderRepository {
      private val fakeCustomer = Customer(UUID.randomUUID(), "John Doe", Address("a",1, "c", "d"))

      override fun findById(id: UUID): Order {
          return Order(id = id,
                      customer = fakeCustomer)
      }

      override fun findProductById(productId: UUID): Product {
          return Product(productId,
                        "Keyboard",
                        Money.of(19.90, Monetary.getCurrency("USD")))
      }

      override fun findCustomerById(customerId: UUID): Customer {
          return fakeCustomer
      }

      override fun save(order: Order) {
          //TODO
      }
  }
  \`\`\`



### References

- [领域驱动设计--系列 (youtube)](https://www.youtube.com/watch?v=09uP_sMvhY8)

- [Implement CQRS Design Pattern with SpringBoot (Using Axon Framework)](https://www.youtube.com/watch?v=sthMcMrspCM)

- [Axion Reference Guide (Quick Start)](https://docs.axoniq.io/reference-guide/getting-started/quick-start)

- [产品代码都给你看了，可别再说不会DDD](https://www.cnblogs.com/davenkin/tag/DDD/)

- [Project-demo: Axon-trader](https://github.dev/AxonFramework/Axon-trader)`;export{n as default};
