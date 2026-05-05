const e=`---
title: "Command-Query Based System Part 2: Event based Testing in Spring Boot with Testcontainer Running PGSQL"
date: 2025-12-31
id: blog0449
tag: test, springboot, DDD
toc: true
intro: "Instead of using in-memory mocks for event storage in tests, we use Testcontainers to spin up a real PostgreSQL database. This allows us to test with our actual \`commandInvoker\` and \`eventQueue\` implementations and inspect the database after tests complete."
---



### Configuration

#### \`test/resources/\`

![](/assets/img/2026-01-01-21-37-54.png)


##### application-test.yml

\`\`\`yml
spring:
  jpa:
    hibernate:
      ddl-auto: none # Let the generated schema.sql do this (from prisma)
    show-sql: true
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.PostgreSQLDialect
        jdbc:
          batch_size: 20
        use_sql_comments: false  # Don't add comments to show what Hibernate is doing

  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 2
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      auto-commit: false  # Ensure auto-commit is enabled

logging:
  level:
    org.hibernate.SQL: DEBUG
    org.hibernate.type.descriptor.sql.BasicBinder: TRACE
    org.hibernate.engine.transaction: DEBUG  # Log transaction details
    org.springframework.transaction: DEBUG  # Log Spring transaction management
    org.springframework.orm.jpa: DEBUG  # Log JPA operations
    org.testcontainers: INFO
    com.scriptmanager: DEBUG
    com.zaxxer.hikari: DEBUG  # Log connection pool issues
\`\`\`

\`datasource.hikari.auto-commit\` is set to \`false\` ***on purpose*** because our \`commandInvoker\` is already executed within transactionals managed by \`TransactionTemplate\` (which we haved defined in Part 1). 


##### junit-platform.properties

\`\`\`text
spring.test.constructor.autowire.mode=all
\`\`\`
This is to enable constructor injection in tests, otherwise only \`@Autowired\` can achieve dependency injection in \`SpringBootTest\`.

##### schema.sql

\`schema.sql\` is used to instantiate all the tables when our testcontainer is launched. This is basically a \`sql\` script consisting of \`CREATE IF NOT EXISTS\` statements 

Since I have been using Prisma, we will introduce how to produce such a \`sql\` script from Prisma in [#schema_prisma].

#### Gradle Dependencies

\`\`\`kotlin
dependencies {
    // Testcontainers
    testImplementation("org.testcontainers:testcontainers:1.19.3")
    testImplementation("org.testcontainers:postgresql:1.19.3")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    
    // Jackson for JSON
    testImplementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    
    // JUnit 5
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
\`\`\`


#### \`~/.testcontainers.properties\`

This config file is positioned at the ***User Level*** instead of the project level, as it directly  influences how mac interact with the docker engine.


\`\`\`text
testcontainers.reuse.enable=true
docker.client.strategy=org.testcontainers.dockerclient.UnixSocketClientProviderStrategy
\`\`\`

##### testcontainers.reuse.enable=true

- Technically this is an hard-requirement for docker to ***prevent*** accidental container accumulation.
- Without this docker will ignore the \`withReuse(true)\` in our \`TestContainerConfiguration\`.



##### docker.client.strategyy=org.testcontainers.dockerclient.UnixSocketClientProviderStrategy
###### Problem

Testcontainers needs to communicate with Docker, but there are multiple ways:
- Unix socket (macOS/Linux): docker.sock
- Named pipes (Windows)
- TCP connection (remote Docker)
- Docker Desktop on macOS with specific socket locations


\`docker.client.strategy\` tells Testcontainers which method to use. Without this setting, Testcontainers tries multiple strategies in order, which can:

- Add 5-10 seconds of delay on startup
- Fail if auto-detection picks the wrong strategy

###### Solution


- Setting \`docker.client.strategy\` as above forces Testcontainers to use the Unix socket strategy, which:

  - Connects directly to docker.sock (or Docker Desktop's socket)
  - Most reliable on macOS with Docker Desktop
  - Avoids auto-detection issues that can cause delays or failures



- Other Common Strategies:

  - \`UnixSocketClientProviderStrategy\` - Unix socket (macOS/Linux)
  - \`DockerMachineClientProviderStrategy\` - Docker Machine (legacy)
  - \`EnvironmentAndSystemPropertyClientProviderStrategy\` - Use \`DOCKER_HOST\` env var
  - \`NpipeSocketClientProviderStrategy\` - Named pipes (Windows)


**Conclusion.** It speeds up test startup and ensures reliable Docker connection by skipping auto-detection.




### Convert \`schema.prisma\` into a \`schema.sql\` to Init all Tables {#schema_prisma}

This script will:

- Read our prisma file, execute \`npx prisma migrate diff\` to produce a \`.sql\` file;

- Translate SQLite specific stored procedures into PostgreSQL specific stored procedures (see \`convert_to_postgresql\`), this step ***can be ignored*** when we have already used PostgreSQL (as the conversion script will \`str\`-substitute nothing);
- Rearrange the order of the table creations to prevent incorrect sequence to create resources   (like an index is created before the table exists).

\`\`\`bash-1}
#!/bin/bash

# Prisma Schema Converter: SQLite to PostgreSQL
# Converts and reorders models based on dependencies

# Project root that contains \`prisma/\` directory
PRISMA_PROJECT_ROOT="/Users/chingcheonglee/Repos/rust/2025-10-27-shell-script-manager-tauri/src-tauri"
# Sql file to be copied into t\`est resource directory for spring boot project
SQL_FILE_DESTINATION="/Users/chingcheonglee/Repos/rust/2025-10-27-shell-script-manager-tauri/backend-spring/src/test/resources/schema.sql"

INPUT_FILE="$PRISMA_PROJECT_ROOT/prisma/schema.prisma"
OUTPUT_FILE="$PRISMA_PROJECT_ROOT/prisma/schema_postgresql.prisma"

echo "Converting Prisma schema from SQLite to PostgreSQL..."
echo "Input: $INPUT_FILE"
echo "Output: $OUTPUT_FILE"
echo ""

python3 - "$INPUT_FILE" "$OUTPUT_FILE" << 'END_PYTHON'
import re
import sys
from collections import defaultdict, deque
from typing import Dict, List, Set, Tuple

def parse_prisma_schema(content: str) -> Tuple[str, List[Dict]]:
    """Parse Prisma schema and extract models"""
    
    # Extract header (generator, datasource)
    header_match = re.search(r'^(.*?)(?=model\\s+\\w+)', content, re.DOTALL)
    header = header_match.group(1) if header_match else ""
    
    # Find all models
    model_pattern = r'(model\\s+(\\w+)\\s*\\{[^}]*\\})'
    models = []
    
    for match in re.finditer(model_pattern, content, re.DOTALL):
        model_text = match.group(1)
        model_name = match.group(2)
        models.append({
            'name': model_name,
            'text': model_text,
            'dependencies': set()
        })
    
    return header, models

def extract_dependencies(model: Dict) -> Set[str]:
    """Extract foreign key dependencies from a model"""
    dependencies = set()
    
    # Find all relation lines
    for line in model['text'].split('\\n'):
        if '@relation' in line:
            # Extract the referenced model type
            # Pattern: model_name @relation(...)
            type_match = re.search(r'(\\w+)\\s+@relation', line)
            if type_match:
                ref_model = type_match.group(1)
                dependencies.add(ref_model)
    
    return dependencies

def topological_sort(models: List[Dict]) -> List[Dict]:
    """Sort models based on their dependencies using topological sort"""
    
    # Build dependency graph
    for model in models:
        model['dependencies'] = extract_dependencies(model)
    
    # Create a mapping of model names to model objects
    model_map = {m['name']: m for m in models}
    
    # Calculate in-degrees
    in_degree = {m['name']: 0 for m in models}
    for model in models:
        for dep in model['dependencies']:
            if dep in in_degree:
                in_degree[model['name']] += 1
    
    # Find all nodes with no incoming edges
    queue = deque([name for name, degree in in_degree.items() if degree == 0])
    sorted_models = []
    
    while queue:
        model_name = queue.popleft()
        sorted_models.append(model_map[model_name])
        
        # Reduce in-degree for dependent models
        for other_model in models:
            if model_name in other_model['dependencies']:
                in_degree[other_model['name']] -= 1
                if in_degree[other_model['name']] == 0:
                    queue.append(other_model['name'])
    
    # Check for cycles
    if len(sorted_models) != len(models):
        print("⚠️  Warning: Circular dependencies detected!")
        sorted_names = {m['name'] for m in sorted_models}
        for model in models:
            if model['name'] not in sorted_names:
                sorted_models.append(model)
    
    return sorted_models

def convert_to_postgresql(model_text: str) -> str:
    """Convert SQLite-specific syntax to PostgreSQL"""
    
    # Replace SQLite julianday with PostgreSQL epoch
    model_text = re.sub(
        r'@default\\(dbgenerated\\("?\\(CAST\\(\\(julianday\\(\\'now\\'\\)\\s*-\\s*2440587\\.5\\)\\s*\\*\\s*86400000\\.0\\s+AS\\s+REAL\\)\\)"?\\)\\)',
        '@default(dbgenerated("ROUND(extract(epoch from NOW()::TIMESTAMPTZ) * 1000, 0)::float"))',
        model_text
    )
    
    # Replace SQLite strftime with PostgreSQL TO_CHAR
    model_text = re.sub(
        r'@default\\(dbgenerated\\("?\\(strftime\\(\\'%Y-%m-%d %H:%M:%S\\',\\s*datetime\\(\\'now\\',\\s*\\'\\+8 hours\\'\\)\\)\\)"?\\)\\)',
        '@default(dbgenerated("TO_CHAR((NOW()::TIMESTAMPTZ AT TIME ZONE \\'UTC\\' AT TIME ZONE \\'GMT+8\\'), \\'YYYY-MM-DD HH24:MI:SS\\')"))',
        model_text
    )
    
    return model_text

def convert_datasource(header: str) -> str:
    """Convert datasource from SQLite to PostgreSQL"""
    
    datasource_pattern = r'datasource\\s+db\\s*\\{[^}]*\\}'
    
    new_datasource = '''datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
}'''
    
    header = re.sub(datasource_pattern, new_datasource, header, flags=re.DOTALL)
    
    return header

def main():
    if len(sys.argv) < 3:
        print("Usage: script.sh <input_file> <output_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    print(f"Reading Prisma schema from: {input_file}")
    
    try:
        with open(input_file, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: File '{input_file}' not found!")
        sys.exit(1)
    
    # Parse schema
    print("Parsing Prisma schema...")
    header, models = parse_prisma_schema(content)
    print(f"Found {len(models)} models")
    
    # Convert datasource
    print("Converting datasource to PostgreSQL...")
    header = convert_datasource(header)
    
    # Convert each model to PostgreSQL
    print("Converting SQLite syntax to PostgreSQL...")
    for model in models:
        model['text'] = convert_to_postgresql(model['text'])
    
    # Sort models by dependencies
    print("Reordering models based on dependencies...")
    sorted_models = topological_sort(models)
    
    # Print dependency order
    print("\\nModel creation order:")
    for i, model in enumerate(sorted_models, 1):
        deps = model['dependencies']
        deps_str = f" → depends on: {', '.join(sorted(deps))}" if deps else ""
        print(f"  {i:2d}. {model['name']}{deps_str}")
    
    # Build output
    output_lines = [header.rstrip()]
    output_lines.append("")
    output_lines.append("// " + "=" * 76)
    output_lines.append("// Models ordered by dependencies (base models first)")
    output_lines.append("// " + "=" * 76)
    output_lines.append("")
    
    for model in sorted_models:
        output_lines.append(model['text'])
        output_lines.append("")
    
    output_content = '\\n'.join(output_lines)
    
    # Write output file
    print(f"\\nWriting converted schema to: {output_file}")
    with open(output_file, 'w') as f:
        f.write(output_content)
    
    print("✅ Conversion complete!")

if __name__ == "__main__":
    main()

END_PYTHON

echo ""
echo "Generating SQL migration from PostgreSQL schema..."
cd "$PRISMA_PROJECT_ROOT"

# Generate SQL from the PostgreSQL schema
npx prisma migrate diff \\
  --from-empty \\
  --to-schema-datamodel prisma/schema_postgresql.prisma \\
  --script > temp_schema.sql

echo "Converting to final SQL format..."

# Do final SQL conversions
python3 << 'PYTHON_SCRIPT'
import re

with open('temp_schema.sql', 'r') as f:
    sql_content = f.read()

# SQLite to PostgreSQL conversions
sql_content = re.sub(
    r'INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT',
    'SERIAL PRIMARY KEY',
    sql_content
)

sql_content = re.sub(
    r'BIGINT NOT NULL PRIMARY KEY AUTOINCREMENT',
    'BIGSERIAL PRIMARY KEY',
    sql_content
)

sql_content = re.sub(r'\\bREAL\\b', 'DOUBLE PRECISION', sql_content)

sql_content = re.sub(
    r"\\(CAST\\(\\(julianday\\('now'\\) - 2440587\\.5\\) \\* 86400000\\.0 AS REAL\\)\\)",
    "ROUND(extract(epoch from NOW()::TIMESTAMPTZ) * 1000, 0)::float",
    sql_content
)

sql_content = re.sub(
    r"\\(CAST\\(\\(julianday\\('now'\\) - 2440587\\.5\\) \\* 86400000\\.0 AS DOUBLE PRECISION\\)\\)",
    "ROUND(extract(epoch from NOW()::TIMESTAMPTZ) * 1000, 0)::float",
    sql_content
)

sql_content = re.sub(
    r"\\(strftime\\('%Y-%m-%d %H:%M:%S', datetime\\('now', '\\+8 hours'\\)\\)\\)",
    "TO_CHAR((NOW()::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'GMT+8'), 'YYYY-MM-DD HH24:MI:SS')",
    sql_content
)

with open('temp_schema.sql', 'w') as f:
    f.write(sql_content)

PYTHON_SCRIPT

echo ""
echo "Moving SQL file to Spring test resources..."
mv temp_schema.sql "$SQL_FILE_DESTINATION"

echo ""
echo "✅ Complete!"
echo "   - PostgreSQL Prisma schema: $OUTPUT_FILE"
echo "   - SQL migration file: $SQL_FILE_DESTINATION"
echo ""
echo "Next steps:"
echo "  1. Review the PostgreSQL schema at $OUTPUT_FILE"
echo "  2. Review the SQL migration at $SQL_FILE_DESTINATION"
echo "  3. Set DATABASE_URL environment variable"
echo "  4. Run: cd $PRISMA_PROJECT_ROOT && npx prisma migrate dev --name init"
\`\`\`

### The \`TestcontainersConfiguration\` Class
#### Implementation

From line 39-50 we will check that if a test-container is being reused.

1. If a schema exists (testcontainer being reused), we simply truncate all tables to empty all existing data to restore our database into a fresh state.

2. Otherwise we apply the \`schema.sql\` file to generate all tables.


\`\`\`kotlin-1{39-50}
// src/test/kotlin/com/scriptmanager/config/TestcontainersConfiguration.kt
package com.scriptmanager.config

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
import org.springframework.context.annotation.Bean
import org.springframework.core.io.ClassPathResource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName
import java.sql.DriverManager
import java.time.Duration


@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    /**
     * PostgreSQL container that will be shared across all tests.
     * Using singleton pattern to avoid spinning up multiple containers.
     *
     * Applies Prisma schema from src-tauri/prisma/schema.prisma if available.
     */
    @Bean
    @ServiceConnection
    fun postgresContainer(): PostgreSQLContainer<*> {
        val container = PostgreSQLContainer(DockerImageName.parse("postgres:15-alpine"))
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test")
            .withStartupTimeout(Duration.ofMinutes(2))
            .withReuse(true) // Reuse container across test runs for faster execution

        container.start()
        printConnectionInfo(container)

        println()

        // Check if schema already exists (for container reuse)
        if (schemaExists(container)) {
            println("✓ Schema already exists - skipping migration (container reuse)")
            println("  Truncating all tables to clear test data...")
            truncateAllTables(container)
            verifySchema(container)
        } else {
            println("  Applying schema from schema.sql file (first time)...")
            applySchemaFromFile(container)
            println("✓ Schema applied successfully!")
            println()
            verifySchema(container)
        }

        println()

        return container
    }

    /**
     * Truncates all tables to clear data while preserving schema.
     * This is called before each Spring context creation to ensure test isolation.
     */
    private fun truncateAllTables(container: PostgreSQLContainer<*>) {
        try {
            DriverManager.getConnection(
                container.jdbcUrl,
                container.username,
                container.password
            ).use { connection ->
                connection.autoCommit = false
                try {
                    connection.createStatement().use { statement ->
                        // Get all table names
                        val tables = mutableListOf<String>()
                        val rs = statement.executeQuery(
                            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
                        )
                        while (rs.next()) {
                            tables.add(rs.getString("tablename"))
                        }
                        rs.close()

                        if (tables.isNotEmpty()) {
                            // Disable foreign key checks temporarily, truncate all tables, then re-enable
                            val tableList = tables.joinToString(", ") { "\\"$it\\"" }
                            statement.execute("TRUNCATE TABLE $tableList RESTART IDENTITY CASCADE")
                            connection.commit()
                            println("   ✓ Truncated \${tables.size} table(s): \${tables.joinToString(", ")}")
                        } else {
                            println("   ℹ️  No tables to truncate")
                        }
                    }
                } catch (e: Exception) {
                    connection.rollback()
                    throw e
                }
            }
        } catch (e: Exception) {
            println("   [!!] Could not truncate tables: \${e.message}")
            e.printStackTrace()
            throw RuntimeException("Failed to truncate tables", e)
        }
    }

    /**
     * Checks if the schema has already been applied by looking for key tables.
     * Returns true if tables exist, false otherwise.
     */
    private fun schemaExists(container: PostgreSQLContainer<*>): Boolean {
        try {
            DriverManager.getConnection(
                container.jdbcUrl,
                container.username,
                container.password
            ).use { connection ->
                val statement = connection.createStatement()
                val resultSet = statement.executeQuery(
                    "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
                )

                if (resultSet.next()) {
                    val tableCount = resultSet.getInt("count")
                    if (tableCount > 0) {
                        println("   ℹ️  Found $tableCount existing table(s) in database")
                        return true
                    }
                }
                return false
            }
        } catch (e: Exception) {
            println("   ⚠️  Could not check if schema exists: \${e.message}")
            return false
        }
    }


    /**
     * Applies the schema.sql file to the PostgreSQL container.
     * This reads the schema file from test resources and executes it.
     * SQL statements are split and executed individually.
     */
    private fun applySchemaFromFile(container: PostgreSQLContainer<*>) {
        try {
            val schemaResource = ClassPathResource("schema.sql")
            if (!schemaResource.exists()) {
                println("   ⚠️  WARNING: schema.sql file not found in test resources!")
                return
            }

            val schemaContent = schemaResource.inputStream.bufferedReader().use { it.readText() }
            println("   📖 Schema file size: \${schemaContent.length} bytes")

            // More robust SQL statement splitting
            val sqlStatements = splitSqlStatements(schemaContent)
            println("   📝 Found \${sqlStatements.size} SQL statements to execute")

            // Connect to the database
            DriverManager.getConnection(
                container.jdbcUrl,
                container.username,
                container.password
            ).use { connection ->
                connection.autoCommit = false

                try {
                    connection.createStatement().use { statement ->
                        var successCount = 0
                        sqlStatements.forEachIndexed { index, sql ->
                            try {
                                val trimmedSql = sql.trim()
                                if (trimmedSql.isNotEmpty()) {
                                    println("   [\${index + 1}/\${sqlStatements.size}] Executing: \${trimmedSql.take(60)}...")
                                    statement.execute(trimmedSql)
                                    successCount++
                                }
                            } catch (e: Exception) {
                                println("   ✗ Failed to execute statement \${index + 1}:")
                                println("   \${sql.take(200)}...")
                                println("   Error: \${e.message}")
                                connection.rollback()
                                throw e
                            }
                        }
                        connection.commit()
                        println("   ✓ Successfully executed $successCount SQL statements")
                    }
                } catch (e: Exception) {
                    connection.rollback()
                    throw e
                }
            }
        } catch (e: Exception) {
            println("   ✗ Error applying schema: \${e.message}")
            e.printStackTrace()
            throw RuntimeException("Failed to apply schema.sql", e)
        }
    }

    /**
     * More robust SQL statement splitting that handles:
     * - Multi-line statements
     * - Comments (-- and /* */)
     * - Semicolons within strings
     */
    private fun splitSqlStatements(sql: String): List<String> {
        val statements = mutableListOf<String>()
        val currentStatement = StringBuilder()
        var inSingleLineComment = false
        var inMultiLineComment = false
        var inString = false
        var stringChar = '\\u0000'

        val lines = sql.lines()
        for (line in lines) {
            var i = 0
            while (i < line.length) {
                val char = line[i]
                val nextChar = if (i + 1 < line.length) line[i + 1] else '\\u0000'

                // Handle single-line comments
                if (!inString && !inMultiLineComment && char == '-' && nextChar == '-') {
                    inSingleLineComment = true
                    i++
                    continue
                }

                // Handle multi-line comments
                if (!inString && !inSingleLineComment && char == '/' && nextChar == '*') {
                    inMultiLineComment = true
                    i += 2
                    continue
                }

                if (inMultiLineComment && char == '*' && nextChar == '/') {
                    inMultiLineComment = false
                    i += 2
                    continue
                }

                // Skip if in comment
                if (inSingleLineComment || inMultiLineComment) {
                    i++
                    continue
                }

                // Handle strings
                if ((char == '\\'' || char == '"') && !inString) {
                    inString = true
                    stringChar = char
                    currentStatement.append(char)
                } else if (inString && char == stringChar) {
                    // Check for escaped quotes
                    if (nextChar == stringChar) {
                        currentStatement.append(char).append(nextChar)
                        i += 2
                        continue
                    } else {
                        inString = false
                        currentStatement.append(char)
                    }
                } else if (!inString && char == ';') {
                    // Statement terminator found
                    val statement = currentStatement.toString().trim()
                    if (statement.isNotEmpty()) {
                        statements.add(statement)
                    }
                    currentStatement.clear()
                } else {
                    currentStatement.append(char)
                }

                i++
            }

            // Reset single-line comment flag at end of line
            inSingleLineComment = false
            currentStatement.append('\\n')
        }

        // Add any remaining statement
        val lastStatement = currentStatement.toString().trim()
        if (lastStatement.isNotEmpty()) {
            statements.add(lastStatement)
        }

        return statements
    }

    /**
     * Verifies that the schema was applied by listing all tables
     */
    private fun verifySchema(container: PostgreSQLContainer<*>) {
        try {
            DriverManager.getConnection(
                container.jdbcUrl,
                container.username,
                container.password
            ).use { connection ->
                val statement = connection.createStatement()
                val resultSet = statement.executeQuery(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                )

                val tables = mutableListOf<String>()
                while (resultSet.next()) {
                    tables.add(resultSet.getString("table_name"))
                }

                if (tables.isEmpty()) {
                    println("   ⚠️  WARNING: No tables found in the database!")
                } else {
                    println("   ✓ Verified \${tables.size} table(s) created:")
                    tables.sorted().forEach { tableName ->
                        println("      • $tableName")
                    }
                }
            }
        } catch (e: Exception) {
            println("   ⚠️  Could not verify schema: \${e.message}")
        }
    }

    /**
     * Prints connection information for connecting with GUI tools (DataGrip, DBeaver, etc.)
     */
    private fun printConnectionInfo(container: PostgreSQLContainer<*>) {
        val host = container.host
        val port = container.getMappedPort(5432)
        val database = container.databaseName
        val username = container.username
        val password = container.password
        val jdbcUrl = container.jdbcUrl

        println("=".repeat(80))
        println("🔗 TESTCONTAINERS DATABASE CONNECTION INFO")
        println("=".repeat(80))
        println("Host:     $host")
        println("Port:     $port")
        println("Database: $database")
        println("Username: $username")
        println("Password: $password")
        println("JDBC URL: $jdbcUrl")
        println()
        println("   GUI Tool Connection (DataGrip, DBeaver, TablePlus, etc.):")
        println("   Host: $host")
        println("   Port: $port")
        println("   Database: $database")
        println("   User: $username")
        println("   Password: $password")
        println()
        println("   Container will stay alive with reuse=true")
        println("   To find it: docker ps | grep postgres")
        println("=".repeat(80))
    }
}
\`\`\`

#### What Happens on Startup

\`\`\`text
🔧 PostgreSQL Test Container Configuration
Container: postgres:15-alpine
Database: testdb (port: 52106) <-- this is random, but persistent until we stop/restart our docker process.
Username: test
Password: test
JDBC URL: jdbc:postgresql://localhost:52106/testdb

✔  Schema already exists - skipping migration (container reuse)
   Truncating all tables to clear test data...
   ✔  Truncated 18 table(s)
   ✔  Verified 18 table(s) created
\`\`\`


### Testing


#### Test Files Structure

![](/assets/img/2026-01-04-14-37-21.png)

- We separated our commands by resources (a natural separations, as is controller).

  **Remark.** If we only separate commands by aggregate level, that separation is usually too bulky (a god test file).

- We test our commands one by one based on resource level naturally.

- Since each endpoint in a controller will call exactly one command, the tests will cover all basic functionalities, ***but it is not enough***.



- Some method will have ***authentication and authroization***, for those methods we should also add a ***controller test***. 

  But concerns are clearly separated, we are concerned only about if the \`AuthroizationException\` was thrown, then that's enough.

#### Which kind of Tests we are Doing?

| Test Type | What It Tests | Our Current Test |
|-----------|---------------|-------------------|
| Unit Test | Single class in isolation (mocked dependencies) | ❌ No external dependencies are mocked |
| Integration Test | Multiple layers working together | ✅ We are here |
| Controller Test | HTTP layer (MockMvc) | ❌ We have no Authentication |
| E2E Test | Full system via UI/API | ❌ We don't have software to test Tauri App UI-wise |


#### The \`BaseTest\` Class and \`@BeforeEach\`



**Purpose of the Class.** This defines the basic operations that all test would execute.

In our case, we truncates/clean-up the \`event\` table ***before each test*** to keep a clean event table so that the events dispatched from our commands are easily testable.




\`\`\`kotlin
// src/test/kotlin/com/scriptmanager/integration/BaseTest.kt
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration::class)
abstract class BaseTest (
    private val eventRepository: EventRepository
){
    @BeforeEach
    fun truncateEventsBeforeEachTest() {
        println("[BaseTest] Truncating events table...")
        eventRepository.deleteAll()
        println("   ✔  Events table cleared")
    }
}
\`\`\`


Based on the natural of the tests we may add further clearnup process for each using \`@BeforeEach\` to ensure all tests are completely isolatd.

#### Two Levels of Cleanup

##### Context Level (in \`TestcontainersConfiguration\`)

- **When**: Spring context is created
- **What**: All tables are truncated
- **How**: \`TRUNCATE TABLE ... RESTART IDENTITY CASCADE\`

\`\`\`kotlin
private fun truncateAllTables(container: PostgreSQLContainer<*>) {
    val tables = getAllTableNames()
    statement.execute("TRUNCATE TABLE \${tables.joinToString(", ")} RESTART IDENTITY CASCADE")
}
\`\`\`

##### Test Level (BaseTest)

- **When**: Before each test method
- **What**: Only \`event\` table will be cleared
- **How**: \`eventRepository.deleteAll()\`

\`\`\`kotlin
@BeforeEach
fun truncateEventsBeforeEachTest() {
    eventRepository.deleteAll()
}
\`\`\`

##### Why Two Levels?

| Level   | Frequency        | Scope       | Use Case                   |
| ------- | ---------------- | ----------- | -------------------------- |
| Context | Once per context | All tables  | Fresh start for test class |
| Test    | Before each test | Events only | Isolate event assertions   |


#### Test Suite

We can group a list of test classes and launch all the testing at the same time. 

Since we can control the execution order in \`@SelectClasseds\`, it is possible to launch a "resource initialization step" and let the remaining tests reuse the resources.




\`\`\`kotlin
import org.junit.platform.suite.api.SelectClasses
import org.junit.platform.suite.api.Suite
import org.junit.platform.suite.api.SuiteDisplayName

@Suite
@SuiteDisplayName("All Tests Suite")
@SelectClasses(
    InitializeResourcesTest::class,   // order 0
    DataBaseTest::class,              // order 1 
    EventPersistenceTest::class,      // order 2
    CommandInvokerTest::class         // order 3
)
class AllTestsSuite
\`\`\`



#### Assetions that we can use

With \`import org.junit.jupiter.api.Assertions.*\` we have:


- ID Validation: \`assertNotNull(entity.id!!)\`
- Property Matching: \`assertEquals(expected, actual.property)\`
- Exception Verification: 
  \`\`\`kotlin
  val exception = assertThrows(IllegalArgumentException::class.java) {
      // some transaction
      ... 
  }
  // we can even test the rollbacked state here
  assertTrue(exception.message!!.contains("..."))
  \`\`\`
           

#### Examples
##### Integration Test
###### Simple Arrange, Act and Assert (AAA)


Straight forward tests can be defined easily via annotated methods:

\`\`\`kotlin
package com.scriptmanager.integration.shellscriptmanager

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.scriptmanager.domain.infrastructure.CommandInvoker
import com.scriptmanager.domain.scriptmanager.command.CreateWorkspaceCommand
import com.scriptmanager.domain.scriptmanager.event.WorkspaceCreatedEvent
import com.scriptmanager.integration.BaseTest
import com.scriptmanager.repository.EventRepository
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest


@SpringBootTest
class EventPersistenceTest(
    private val eventRepository: EventRepository,
    private val commandInvoker: CommandInvoker,
    private val objectMapper: ObjectMapper
) : BaseTest(eventRepository) {

    @Test
    fun \`should emit WorkspaceCreatedEvent when creating workspace\`() {
        // Arrange
        val workspaceName = "TestWorkspace_\${System.currentTimeMillis()}"

        // Act
        val result = commandInvoker.invoke(CreateWorkspaceCommand(workspaceName))

        // Assert - Find the event
        val events = eventRepository.findAll()
            .filter { it.eventType == "WorkspaceCreatedEvent" }
            .filter { event ->
                val payload = objectMapper.readValue<WorkspaceCreatedEvent>(event.payload)
                payload.workspace.name == workspaceName
            }

        assertEquals(1, events.size, "Should have exactly 1 WorkspaceCreatedEvent")
        val event = events.first()
        assertTrue(event.success)

        val payload = objectMapper.readValue<WorkspaceCreatedEvent>(event.payload)
        assertEquals(workspaceName, payload.workspace.name)
        assertEquals(result.id, payload.workspace.id)
    }
}
\`\`\`

 
###### Complicated AAA Using Nested Inner Class

- For complicated tests we may need to separate the \`arrange\` and \`act-assert\` separately. 

- Sometimes when multiple \`act-assert\`s can share the same arrange logic, we also group similar tests together:


\`\`\`kotlin
@SpringBootTest
class FolderTest(
    private val eventRepository: EventRepository,
    private val folderRepository: ScriptsFolderRepository,
    private val commandInvoker: CommandInvoker,
    private val objectMapper: ObjectMapper,
    private val entityManager: EntityManager
) : BaseTest(eventRepository) {
    @Nested
    @DisplayName("Should delete folder and its children")
    open inner class ShouldDeleteFolderAndChildren {
        private lateinit var parentFolder: ScriptsFolder
        private lateinit var subfolder: ScriptsFolder
        private lateinit var scriptInSubfolder: ShellScriptResponse
        private lateinit var scriptInfolder: ShellScriptResponse

        @BeforeEach
        @Transactional
        open fun arrange() {
            parentFolder = commandInvoker.invoke(
                CreateFolderCommand("Parent_\${System.currentTimeMillis()}")
            )

            subfolder = commandInvoker.invoke(
                AddSubfolderCommand(
                    parentFolderId = parentFolder.id!!,
                    name = "Subfolder_\${System.currentTimeMillis()}"
                )
            )

            this@FolderTest.entityManager.flush()

            scriptInfolder = commandInvoker.invoke(
                CreateScriptCommand(
                    folderId = subfolder.id!!,
                    name = "Script_\${System.currentTimeMillis()}_in_folder",
                    content = "echo 'Hello, World!'"
                )
            )

            scriptInSubfolder = commandInvoker.invoke(
                CreateScriptCommand(
                    folderId = parentFolder.id!!,
                    name = "Script_\${System.currentTimeMillis()}_in_subfolder",
                    content = "echo 'Hello, World!'"
                )
            )
        }

        @Test
        @Transactional
        open fun \`should delete folder, subfolders and all scripts inside\`() {
            // Act
            commandInvoker.invoke(DeleteFolderCommand(parentFolder.id!!))
            this@FolderTest.entityManager.flush()

            // Assert - All entities deleted
            assertNull(
                folderRepository.findByIdOrNull(parentFolder.id!!),
                "Parent folder should be deleted"
            )
            assertNull(
                folderRepository.findByIdOrNull(subfolder.id!!),
                "Subfolder should be deleted"
            )
            assertNull(
                shellScriptRepository.findByIdOrNull(scriptInfolder.id!!),
                "Script should be deleted"
            )
            assertNull(
                shellScriptRepository.findByIdOrNull(scriptInSubfolder.id!!),
                "Script should be deleted"
            )

            // Assert - Events emitted
            val events = eventRepository.findAll()
            val folderCreatedEvents = events.filter { it.eventType == "FolderCreatedEvent" }
            val subfolderCreatedEvents = events.filter { it.eventType == "SubfolderAddedEvent" }
            val scriptCreatedEvents = events.filter { it.eventType == "ScriptCreatedEvent" }
            val folderDeletedEvents = events.filter { it.eventType == "FolderDeletedEvent" }
            val scriptDeletedEvents = events.filter { it.eventType == "ScriptDeletedEvent" }

            assertEquals(1, folderCreatedEvents.size, "Should have 1 FolderCreatedEvents from setup")
            assertEquals(1, subfolderCreatedEvents.size, "Should have 1 SubfolderAddedEvent from setup")
            assertEquals(2, scriptCreatedEvents.size, "Should have 2 ScriptCreatedEvent from setup")

            assertEquals(2, folderDeletedEvents.size, "Should emit 2 FolderDeletedEvents")
            assertEquals(2, scriptDeletedEvents.size, "Should emit 2 ScriptDeletedEvent")
        }

        @Test
        @Transactional
        open fun \`should emit events with correct folder IDs\`() {
            // Act
            commandInvoker.invoke(DeleteFolderCommand(parentFolder.id!!))
            this@FolderTest.entityManager.flush()
            // Assert
            val folderDeleteEvents = eventRepository.findAll()
                .filter { it.eventType == "FolderDeletedEvent" }
                .map { objectMapper.readValue<FolderDeletedEvent>(it.payload) }

            assertTrue(
                folderDeleteEvents.any { it.folderId == parentFolder.id!! },
                "Should emit event for parent folder"
            )
            assertTrue(
                folderDeleteEvents.any { it.folderId == subfolder.id!! },
                "Should emit event for subfolder"
            )
        }
    }
}
\`\`\`

##### Controller Test

\`\`\`kotlin
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration::class)
class FolderControllerTest(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
    private val eventRepository: EventRepository,
    private val folderRepository: ScriptsFolderRepository
) {

    @BeforeEach
    fun setUp() {
        eventRepository.deleteAll()
    }

    @Test
    fun \`should create folder with required headers\`() {
        // Arrange
        val folderName = "TestFolder_\${System.currentTimeMillis()}"
        val request = CreateFolderRequest(name = folderName)
        val requestJson = objectMapper.writeValueAsString(request)

        // Act & Assert
        mockMvc.perform(
            post("/folders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson)
                .header("Authorization", "Bearer mock-jwt-token")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.result.name").value(folderName))

        val folders = folderRepository.findAll()
        assert(folders.any { it.name == folderName })
    }
}
\`\`\`

### IDE Freezes During Tests



**Problem.** IntelliJ IDEA tries to index the \`build/\` directory after each test run, causing the IDE to freeze.

**Solution.** Mark \`build/\` as *Excluded* via: 

1. Right-click \`build/\` folder in Project view
2. Select **"Mark Directory as"** → **"Excluded"**
3. Folder turns orange/red and won't be indexed


When we exclude \`build/\`:

1. No indexing of generated files
2. Faster IDE performance
3. No autocomplete from generated code
4. Test reports still accessible


Next we also uncheck the following to avoid accidentally indexing a large file:

![](/assets/img/2026-01-03-19-47-20.png)



### Further Questions

#### Can I inspect the database during tests?

Yes! Use the connection info printed at startup:

\`\`\`text
JDBC URL: jdbc:postgresql://localhost:52106/testdb
Username: test
Password: test
\`\`\`

We can connect to the database via any GUI application for inspection.

#### Are tables dropped after each test?

No, schema persists, data are truncated only before the launch of new tests.

#### What about transaction rollback?

Not needed. Event table is cleared before each test via \`@BeforeEach\`. Other tables are truncated between
contexts.



#### How do I test transaction rollback?

Use database events approach (no test queue) and force a rollback:

\`\`\`kotlin
@Test
fun \`should rollback on error\`() {
    assertThrows<RuntimeException> {
        commandInvoker.invoke(CommandThatFails())
    }

    // Verify nothing was saved
    assertEquals(0, eventRepository.findAll().size)
}
\`\`\`

#### Can I run tests without Docker?

No. Testcontainers requires Docker. Consider H2 database if Docker isn't available, but you'll lose
PostgreSQL-specific testing.





`;export{e as default};
