const t=`---
title: "Springboot with JOOQ and Functional Endpoints"
date: 2023-12-17
id: blog0224
tag: sql, java, springboot
intro: "We record the config for a starter project in springboot that mimics the workflow of prisma+kysely in nodejs world."
toc: true
---

### Overview

#### Prerequisite

The reader is assumed to be familiar with creating database on your own. You may do it:

- via \`prisma\` (which we do in this article) or;
- via \`flyway\` (java package) or;
- via \`gooose\` (cli application) or;
- do it manually if one wishes as long as you know how to maintain the schema across different production environments.

#### From start.springboot.io

We can bring \`web\`, \`lombok\` and \`pgsql\` into our springboot project in \`start.springboot.io\`. No \`jpa\` (hiberate) nor any additional database related jars will be needed in our project from that starter page.

Later we will add one addtional package \`jooq\` from \`pom.xml\` which serves as a **_type-safe_** sql query builder that runs sql command directly to \`pgsql\` server without any need of \`ORM\` library. We don't even need to create entity classes, \`jooq\` will create a \`StudentRecord\` class for us by reverse-engineering the table \`student\` in our database.

### Configurations with PostgreSQL

#### application.yaml

Note that by default \`application.properties\`/\`application.yaml\` will be loaded into \`env\` varariable only when we spin up our springboot server.

For code generation to work we still need to input the \`url\`, \`user\`, \`password\` manaully in our \`pom.xml\`.

\`\`\`yaml
spring:
  profiles:
    active: dev
    show-sql: true
logging:
  level:
    root: warn

---
spring:
  config:
    activate:
      on-profile: "dev"
  datasource:
    url: jdbc:postgresql://localhost:5432/pgdb
    username: pguser
    password: pguser

server:
  port: 8080

---
spring:
  config:
    activate:
      on-profile: "uat"
server:
  port: 8081

---
spring:
  config:
    activate:
      on-profile: "prod"
server:
  port: 8082
\`\`\`

#### pom.xml

\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
    ...
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>org.postgresql</groupId>
			<artifactId>postgresql</artifactId>
			<scope>runtime</scope>
		</dependency>
		<dependency>
			<groupId>org.projectlombok</groupId>
			<artifactId>lombok</artifactId>
			<optional>true</optional>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>

		<dependency>
			<groupId>org.jooq</groupId>
			<artifactId>jooq</artifactId>
			<version>3.19.0</version>
		</dependency>
		<dependency>
			<groupId>org.jooq</groupId>
			<artifactId>jooq-meta</artifactId>
			<version>3.19.0</version>
		</dependency>
		<dependency>
			<groupId>org.jooq</groupId>
			<artifactId>jooq-codegen</artifactId>
			<version>3.19.0</version>
		</dependency>
	</dependencies>
  <build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
				<configuration>
					<excludes>
						<exclude>
							<groupId>org.projectlombok</groupId>
							<artifactId>lombok</artifactId>
						</exclude>
					</excludes>
				</configuration>
			</plugin>
      <!-- ================  the jooq part ================ -->
			<plugin>
				<groupId>org.jooq</groupId>
				<artifactId>jooq-codegen-maven</artifactId>
				<version>3.14.0</version>
				<executions>
					<execution>
						<goals>
							<goal>generate</goal>
						</goals>
					</execution>
				</executions>
				<dependencies>
					<dependency>
						<groupId>mysql</groupId>
						<artifactId>mysql-connector-java</artifactId>
						<version>8.0.26</version>
					</dependency>
				</dependencies>
				<configuration>
					<jdbc>
						<driver>org.postgresql.Driver</driver>
						<url>\${spring.datasource.url}</url>
						<user>\${spring.datasource.username}</user>
						<password>\${spring.datasource.password}</password>
					</jdbc>
					<generator>
						<database>
							<name>org.jooq.meta.postgres.PostgresDatabase</name>
							<includes>.*</includes>
							<inputSchema>public</inputSchema>
						</database>
						<target>
							<packageName>com.machingclee.jooq.generated</packageName>
							<directory>src/main/java</directory>
						</target>
					</generator>
				</configuration>
			</plugin>
      <!-- ================  the jooq part ================ -->
		</plugins>
	</build>
</project>
\`\`\`

#### How to Debug if the Code-Geneation does not work?

We manually trigger the code-generation process with a flag \`-X\` for debugging

\`\`\`text
mvn generate-sources -X
\`\`\`

and analyse the root cause.

### Tables and Operations

#### prisma/schema.prisma

Note that according to \`org.postgresql.Driver\`'s definition:

- Table name starts with **_small_** letter and
- Field name is separated by an \`"_"\`, i.e,
  - \`first_name\` works but
  - \`firstName\` will **_fail_**.

\`\`\`text
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model student {
  id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  first_name String
  last_name  String
  email      String
}
\`\`\`

#### CRUD Examples --- Demonstrative DAO

\`\`\`java
package com.machingclee.jooq.dao;

import java.util.UUID;
import java.util.List;

import static com.machingclee.jooq.generated.Tables.*;
import org.jooq.DSLContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;
import com.machingclee.jooq.generated.tables.records.StudentRecord;

@Repository
public class StudentDAO {
    private DSLContext db;

    @Autowired
    StudentDAO(DSLContext ctx) {
        this.db = ctx;
    }

    public void create(StudentRecord student) {
        db.insertInto(STUDENT,
                STUDENT.FIRST_NAME, STUDENT.LAST_NAME, STUDENT.EMAIL)
                .values(student.getFirstName(), student.getLastName(), student.getEmail())
                .execute();
    };

    public StudentRecord findById(UUID uuid) {
        var result = db
                .selectFrom(STUDENT)
                .where(STUDENT.ID.equal(uuid))
                .fetchOne()
                .into(StudentRecord.class);
        return result;
    }

    public List<StudentRecord> getStudents() {
        var result = db
                .select()
                .from(STUDENT)  // if we start from .select, we can start to left-joining here
                .orderBy(STUDENT.LAST_NAME.asc())
                .fetch()
                .into(StudentRecord.class);
        return result;
    }

    public StudentRecord findByEmail(String email) {
        var result = db.selectFrom(STUDENT)
                .where(STUDENT.EMAIL.equal(email))
                .fetchOne()
                .into(StudentRecord.class);
        return result;
    }
}
\`\`\`

### Springboot3 Functional Endpoints to get JOOQ's Output

#### StudentController

As usual our controller consists of many handlers, but this time we don't annotate the controller as \`@RestController\` (which is a combination of \`@Controller\` and \`@ResponseBody\`):

\`\`\`java
package com.machingclee.experiments.controller;

import static com.machingclee.experiments.generated.Tables.STUDENT;
import org.jooq.DSLContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.function.ServerRequest;
import org.springframework.web.servlet.function.ServerResponse;
import com.machingclee.experiments.dto.StudentDTO;

@Component
public class StudentController {

    private DSLContext db;

    @Autowired
    public StudentController(DSLContext ctx) {
        this.db = ctx;
    }

    public ServerResponse getStudents(ServerRequest req) {
        var students = db.select(STUDENT.FIRST_NAME, STUDENT.LAST_NAME, STUDENT.EMAIL)
                .from(STUDENT)
                .fetch()
                .into(StudentDTO.class);
        return ServerResponse.ok().body(students);
    }
}
\`\`\`

#### Configure StudentRouter

\`\`\`java
package com.machingclee.experiments.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.function.RequestPredicates;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.RouterFunctions;
import org.springframework.web.servlet.function.ServerResponse;

import com.machingclee.experiments.controller.StudentController;

@Configuration
public class RoutingConfig {
    @Bean
    public RouterFunction<ServerResponse> studentRouter(StudentController studentController) {
        return RouterFunctions.route()
                .GET("/students", RequestPredicates.accept(MediaType.ALL), studentController::getStudents)
                .build();
    }
}
\`\`\`
`;export{t as default};
