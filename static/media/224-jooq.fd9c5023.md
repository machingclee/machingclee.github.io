---
title: "Springboot with JOOQ"
date: 2023-12-17
id: blog0224
tag: sql, java, springboot
intro: "We record the config for a starter project in springboot that mimics the workflow of prisma+kysely in nodejs world."
toc: true
---

#### The Entire pom.xml

```xml
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
						<url>jdbc:postgresql://localhost:5432/pgdb</url>
						<user>pguser</user>
						<password>pguser</password>
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
```

#### CRUD Examples

```java
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
```
