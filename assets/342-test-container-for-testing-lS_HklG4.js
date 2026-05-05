const e=`---
title: "Testcontainer, a Replacement of In-Memory Database in Testing"
date: 2024-11-18
id: blog0342
tag: test, springboot, docker
toc: true
intro: "In testing we usually make use of in-memory database to separate the test data with our actual working database. For a long time people use H2 in spring boot for that purpose but that database is not eventually what the production uses, now we can align both!"
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Dependencies
#### The list
\`\`\`text
testImplementation("org.springframework.boot:spring-boot-starter-test")
testImplementation("org.springframework.boot:spring-boot-testcontainers")
testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
testImplementation("org.testcontainers:junit-jupiter")
testImplementation("org.testcontainers:postgresql")
\`\`\`
#### How we get it?

A full set of dependencies needed in your case (like using *mongo*, *mysql*, etc, depending on your need) can be obtained by setting 

![](/assets/img/2024-11-18-23-20-39.png)

in spring initializr and by clicking on ***explore***:

![](/assets/img/2024-11-18-23-21-04.png)

which yields the following set of dependencies for us:

![](/assets/img/2024-11-18-23-22-04.png)

as shown above.

### Work with Existing Database
#### Clone a schema from existing database

As is aways we assume we have an already existing database, now let's clone it as if we are backing it up with additional flags:
\`\`\`sh
export TARGET_DB_HOST=
export TARGET_DB_USER=
export TARGET_DB_PASSWORD=
export TARGET_DB_NAME=

docker run --rm -v $(pwd):/backup \\
-e PGPASSWORD=$TARGET_DB_PASSWORD \\
pgvector/pgvector:pg15 pg_dump \\
-U $TARGET_DB_USER \\
-h $TARGET_DB_HOST \\
-d $TARGET_DB_NAME \\
--schema-only --no-owner -f /backup/_schema.sql

sed '/ALTER DEFAULT PRIVILEGES/ {/neon_superuser/d;}' _schema.sql > schema.sql
rm _schema.sql
\`\`\`
Here we remove the lines that involve \`neon_superuser\` (from neon-tech database) because any usual database doesn't need it.

#### Setting up in-memory database by testcontainer
Here we directly set up the container ***by code***:
\`\`\`kt{29-35}
import com.your.package.repository.RoleRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.utility.MountableFile

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@Testcontainers
class BillieApplicationTests {
    @Autowired
    private lateinit var roleRepository: RoleRepository

    companion object {
        @Container
        @ServiceConnection
        val postgres = PostgreSQLContainer("pgvector/pgvector:pg15")
            .withDatabaseName("billie-dev")
            .withUsername("pguser")
            .withPassword("pguser")
            .withCopyFileToContainer(
                MountableFile.forClasspathResource("/schema.sql"),
                "/docker-entrypoint-initdb.d/schema.sql"
            ).also {
                it.start()
                it.execInContainer("pg_restore", "-U", "pguser", "-d", "billie-dev", "/docker-entrypoint-initdb.d/schema.sql")
            }
    }

    @Test
    fun contextLoads() {}

    @Test
    @Transactional
    fun \`postgres sql should be up and running\`() {
        roleRepository.findAll().forEach {
            println(it.name)
        }
    }
}
\`\`\`
Note that ***no configuration*** on \`applicatin.yml\` needed and we are all set to go.


**Remark.** Another approach is to ***remove*** the highlighted lines above, keep \`schema.sql\` and set \`spring.sql.init.mode=always\` in application.properties. I failed in this route and therefore restored the database (schema only) via \`pg_restore\`.

#### Data seeding by command line runner

Let's create a data-seeding class here:

![](/assets/img/2024-11-18-23-32-16.png)

where \`RolePermission\` inherits from \`CommandLineRunner\`. When the application starts, the command line runner will be executed and inject all the data we want using \`repostiory.save\` method.

\`\`\`kt
import com.your.package.commons.database.entities.Permission
import com.your.package.commons.database.entities.Role
import com.your.package.repository.RoleRepository
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Configuration

@Configuration
class RolePermission(private val roleRepository: RoleRepository) : CommandLineRunner {
    override fun run(vararg args: String?) {
        if (roleRepository.count() > 0) {
            return;
        }

        val roles = listOf(
            Role(name = "OWNER", displayname = "Owner", description = ""),
            Role(name = "ADMIN", displayname = "Admin", description = ""),
            Role(name = "EDITOR", displayname = "Editor", description = ""),
            Role(name = "COMMENTER", displayname = "Commenter", description = ""),
            Role(name = "READ_ONLY", displayname = "ReadOnly", description = ""),
        )

        val permissions = listOf(
            Permission(codename = "SEE_THE_PROJECT_ICON_IN_PROJECT_LIST", displayname = "See the project icon in project list", description = ""),
            Permission(codename = "SEE_THE_PROJECT_WORKSPACE_IN_PROJECT", displayname = "See the project workspace in project", description = ""),
            Permission(codename = "EDIT_PROJECT_WORKSPACE_INFO", displayname = "Edit project workspace info", description = ""),
            Permission(codename = "DELETE_PROJECT_WORKSPACE", displayname = "Delete project workspace", description = ""),
            Permission(codename = "QUIT_PROJECT_WORKSPACE", displayname = "Quit Project workspace", description = ""),
            Permission(codename = "SEE_ALL_ISSUES_IN_PROJECT_WORKSPACE", displayname = "See all issues in Project workspace", description = ""),
            Permission(codename = "REMOVE_OTHERS_FROM_PROJECT_WORKSPACE_MEMBER", displayname = "Remove others from project workspace member", description = ""),
            Permission(codename = "ADD_PEOPLE_TO_PROJECT_WORKSPACE_MEMBER", displayname = "Add people to project workspace member", description = ""),
            Permission(codename = "CHANGE_PEOPLE_ROLE_IN_PROJECT", displayname = "Change people's role in project", description = ""),
            Permission(codename = "CREATE_VIEW_IN_PROJECT_WORKSPACE", displayname = "Create View in project workspace", description = ""),
            Permission(codename = "SEE_ALL_VIEWS", displayname = "See all Views", description = ""),
            Permission(codename = "DELETE_VIEW", displayname = "Delete View", description = ""),
            Permission(codename = "SYNC_ISSUE_FROM_WALK_TO_PROJECT_WORKSPACE", displayname = "Sync issue from Walk to project workspace", description = ""),
            Permission(codename = "GENERATE_SHARE_LINK_FOR_VIEW_TO_SHARE_EXTERNALLY", displayname = "Generate share link for view to share externally", description = ""),
            Permission(codename = "CREATE_ISSUE_IN_PROJECT_WORKSPACE", displayname = "Create issue in project workspace", description = ""),
            Permission(codename = "CREATE_ISSUE_IN_VIEW", displayname = "Create issue in view", description = ""),
            Permission(codename = "EDIT_ISSUE_DETAIL", displayname = "Edit issue detail", description = ""),
            Permission(codename = "GENERATE_ISSUE_LINK_TO_SHARE_EXTERNALLY", displayname = "Generate issue link to share externally", description = ""),
            Permission(codename = "REPLY_ISSUE", displayname = "Reply issue", description = ""),
            Permission(codename = "CLOSE_ISSUE", displayname = "Close issue", description = ""),
            Permission(codename = "ARCHIVE_ISSUE", displayname = "Archive issue", description = ""),
            Permission(codename = "MENTION_SOMEONE_IN_ISSUE_REPLY", displayname = "@ someone in issue/reply", description = ""),
            Permission(codename = "DELETE_ISSUE", displayname = "Delete Issue", description = ""),
            Permission(codename = "MOVE_ISSUE_TO_OTHER_PROJECT", displayname = "Move issue to other project", description = ""),
            Permission(codename = "DUPLICATE_ISSUE_TO_OTHER_PROJECT", displayname = "Duplicate issue to other project", description = ""),
            Permission(codename = "MANAGE_ISSUE_VIEW", displayname = "Manage issues' view", description = "")
        )

        roles[0].permissions.addAll(permissions.slice(listOf(0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 25)))
        roles[1].permissions.addAll(permissions.slice(listOf(0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 25)))
        roles[2].permissions.addAll(permissions.slice(listOf(0, 1, 3, 4, 5, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 25)))
        roles[3].permissions.addAll(permissions.slice(listOf(0, 1, 4, 5, 10, 17, 18)))
        roles[4].permissions.addAll(permissions.slice(listOf(0, 1, 4, 5, 10, 17)))

        roleRepository.saveAll(roles)
    }
}
\`\`\``;export{e as default};
