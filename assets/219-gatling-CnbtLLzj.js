const e=`---
title: "Load Test and Stress Test by Gatling"
date: 2023-11-19
id: blog0219
tag: gatling, test
intro: "Record the steps to run load and stress test."
toc: true
---

### Use Scala

Open [this github project](https://github.com/gatling/gatling-maven-plugin-demo-scala) in **_intelliJ_** and install everything that we are asked to install.

<p></p>

<a href="/assets/tech/219/01.png"><img src="/assets/tech/219/01.png" width="340"></a></Center>

<p></p>
<center></center>

And the following should be shown in the console:

<p></p>

<a href="/assets/tech/219/02.png"><img src="/assets/tech/219/02.png" width="420"></a></Center>

<p></p>
<center></center>

Up to this point we are sure that installation is completed.

### Custom Script

Now follow this architecture

<p></p>

<a href="/assets/tech/219/03.png"><img src="/assets/tech/219/03.png" width="400"></a></Center>

<p></p>
<center></center>

And create our first simiulation script:

\`\`\`scala
package videogamedb

import io.gatling.core.Predef._
import io.gatling.http.Predef._

class MyFirstTest extends Simulation
{
  //http config
  val httpProtocal = http.baseUrl(url="https://videogamedb.uk/api")
    .acceptHeader(value="application/json")

  //  scenario def
  val scn = scenario(name="My First Test")
    .exec(
      http("Get all games")
        .get("/videogame")
    )

  //  load scenario
  setUp(scn.inject(atOnceUsers(1))).protocols(httpProtocal)
}
\`\`\`

Now run our engine again, as usual java framework try to grab all \`Simulation\` class files **_in a blackbox_** secretly. Once we type \`test\`, we get:

\`\`\`shell
videogamedb.MyFirstTest is the only simulation, executing it.
Select run description (optional)
test
Simulation videogamedb.MyFirstTest started...

================================================================================
2023-11-19 19:01:19                                           0s elapsed
---- Requests ------------------------------------------------------------------
> Global                                                   (OK=1      KO=0     )
> Get all games                                            (OK=1      KO=0     )

---- My First Test -------------------------------------------------------------
[##########################################################################]100%
          waiting: 0      / active: 0      / done: 1
================================================================================

Simulation videogamedb.MyFirstTest completed in 0 seconds
Parsing log file(s)...
Parsing log file(s) done
Generating reports...

================================================================================
---- Global Information --------------------------------------------------------
> request count                                          1 (OK=1      KO=0     )
> min response time                                    721 (OK=721    KO=-     )
> max response time                                    721 (OK=721    KO=-     )
> mean response time                                   721 (OK=721    KO=-     )
> std deviation                                          0 (OK=0      KO=-     )
> response time 50th percentile                        721 (OK=721    KO=-     )
> response time 75th percentile                        721 (OK=721    KO=-     )
> response time 95th percentile                        721 (OK=721    KO=-     )
> response time 99th percentile                        721 (OK=721    KO=-     )
> mean requests/sec                                      1 (OK=1      KO=-     )
---- Response Time Distribution ------------------------------------------------
> t < 800 ms                                             1 (100%)
> 800 ms <= t < 1200 ms                                  0 (  0%)
> t >= 1200 ms                                           0 (  0%)
> failed                                                 0 (  0%)
================================================================================

Reports generated in 0s.
Please open the following file: file:///C:/Users/user/Repos/gatling/2023-11-19-gatling-maven-plugin-demo-scala-main/target/gatling/myfirsttest-20231119110117759/index.html

Process finished with exit code 0
\`\`\`

We also get a full review in an html file:

<p></p>

<a href="/assets/tech/219/04.png"><img src="/assets/tech/219/04.png" width="600"></a></Center>

<p></p>
<center></center>

### Scripts Fundamental in Gatling

#### Pause

\`\`\`scala
package videogamedb.scriptfundamentals
import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration.DurationInt

class AddPauseTime extends Simulation{
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  val scn = scenario("Video Game DB - 3 calls")
    .exec(http("Get all video games").get("/videogame"))
    .pause(5)

    .exec(http("Get specific game").get("/videogame/1"))
    .pause(1, 10)  // random pause time between 1 and 10

    .exec(http("Get all video games - 2nd call").get("/videogame"))
    .pause(3000.milliseconds)

  setUp(scn.inject(atOnceUsers(users=1)).protocols(httpProtocol))
}
\`\`\`

#### Check Response Code

\`\`\`scala
package videogamedb.scriptfundamentals
import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration.DurationInt

class CheckResponseCode extends Simulation{
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  val scn = scenario("Video Game DB - 3 calls")
    .exec(
      http("Get all video games")
        .get("/videogame")
        .check(status.is(200))
    )
    .pause(5)

    .exec(http("Get specific game")
      .get("/videogame/1")
      .check(status.in(200 to 210))
    )
    .pause(1, 10)  // random pause time between 1 and 10

    .exec(http("Get all video games - 2nd call")
      .get("/videogame")
      .check(status.not(404), status.not(500))
    )
    .pause(3000.milliseconds)

  setUp(scn.inject(atOnceUsers(users=1)).protocols(httpProtocol))
}
\`\`\`

#### Check Response Body

\`\`\`scala
package videogamedb.scriptfundamentals
import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration.DurationInt

class CheckResponseBodyAndExtract extends Simulation{
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  val scn = scenario("Check with JSON path").exec(
    http("Get specific game")
      .get("/videogame/1")
      .check(jsonPath("$.name").is("Resident Evil 4"))
  ).exec()


  setUp(scn.inject(atOnceUsers(users=1)).protocols(httpProtocol))
}
\`\`\`

#### Save the Result in Variable and Reuse it

\`\`\`scala
package videogamedb.scriptfundamentals
import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration.DurationInt

class CheckResponseBodyAndExtract extends Simulation{
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  val scn = scenario("Check with JSON path")
    .exec(http("Get specific game")
      .get("/videogame/1")
      .check(jsonPath("$.name").is("Resident Evil 4"))
  )

    .exec(http("Get all video games")
      .get("/videogame")
      .check(jsonPath(path="$[1].id").saveAs("gameId"))
    )

    .exec(http("Get specific game")
      .get("/videogame/#{gameId}")
      .check(jsonPath("$.name").is("Gran Turismo 3"))
    )

  setUp(scn.inject(atOnceUsers(users=1)).protocols(httpProtocol))
}
\`\`\`

#### Logging for Debugging

\`\`\`scala
package videogamedb.scriptfundamentals
import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration.DurationInt

class CheckResponseBodyAndExtract extends Simulation{
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  val scn = scenario("Check with JSON path")
    .exec(http("Get specific game")
      .get("/videogame/1")
      .check(jsonPath("$.name").is("Resident Evil 4"))
  )

    .exec(http("Get all video games")
      .get("/videogame")
      .check(jsonPath(path="$[1].id").saveAs("gameId"))
    )
    .exec { session => println(session); session}

    .exec(http("Get specific game")
      .get("/videogame/#{gameId}")
      .check(jsonPath("$.name").is("Gran Turismo 3"))
      .check(bodyString.saveAs("responseBody"))
    )
    .exec { session => println(session("responseBody").as[String]); session}

  setUp(scn.inject(atOnceUsers(users=1)).protocols(httpProtocol))
}
\`\`\`

#### Code Reuse

\`\`\`scala
package videogamedb.scriptfundamentals
import io.gatling.core.Predef._
import io.gatling.http.Predef._

class CodeReuse extends Simulation {
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  def getAllVideoGames() = {
    exec(
      http("Get all video games")
        .get("/videogame")
        .check(status.is(200))
    )
  }

  def getSpecificGame() = {
    exec(
      http("Get specific game")
        .get("/videogame/1")
        .check(status.in(200 to 210))
    )
  }

  val scn = scenario("Code reuse")
    .exec(getAllVideoGames())
    .pause(5)
    .exec(getSpecificGame())
    .pause(5)
    .exec(getAllVideoGames())

  setUp(scn.inject(atOnceUsers(users=1)).protocols(httpProtocol))
}
\`\`\`

#### Repeat Requests Several Times (Single User)

\`\`\`scala
package videogamedb.scriptfundamentals
import io.gatling.core.Predef._
import io.gatling.http.Predef._

class CodeReuse extends Simulation {
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  def getAllVideoGames() = {
    repeat(3){
      exec(
        http("Get all video games")
          .get("/videogame")
          .check(status.is(200))
      )
    }
  }

  def getSpecificGame() = {
    repeat(5, "counter"){
      exec(
        http(s"Get specific game with id: #{counter}")
          .get("/videogame/#{counter}")
          .check(status.in(200 to 210))
      )
    }
  }

  val scn = scenario("Code reuse")
    .exec(getAllVideoGames())
    .pause(5)
    .exec(getSpecificGame())
    .pause(5)
    .repeat(2){
      getAllVideoGames()
    }

  setUp(scn.inject(atOnceUsers(users=1)).protocols(httpProtocol))
}
\`\`\`

#### Authenticate and Use that Token for Post Request

The authentication post request returns the following json

\`\`\`text
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTcwMDQwMjQ0MCwiZXhwIjoxNzAwNDA2MDQwfQ.MgyULBwMTd_Kj13E7UwrMALNctO6NUTL9qxS_sOk39k"
}
\`\`\`

We can use jsonPath \`$.token\` to extract this value and use it elsewhere.

\`\`\`scala
package videogamedb.scriptfundamentals
import io.gatling.core.Predef._
import io.gatling.http.Predef._

class Authenticate extends Simulation {
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")

  def authenticate() = {
    exec(http("Authenticate")
      .post("/authenticate")
      .body(StringBody("{\\n  \\"password\\": \\"admin\\",\\n  \\"username\\": \\"admin\\"\\n}"))
      .check(jsonPath("$.token").saveAs("jwtToken"))
    )
  }

  def createNewGame() = {
    exec(http("Create new game")
      .post("/videogame")
      .header("Authorization", "Bearer #{jwtToken}")
      .body(StringBody(
        "{\\n  \\"category\\": \\"Platform\\",\\n  \\"name\\": \\"Mario\\",\\n  \\"rating\\": \\"Mature\\",\\n  \\"releaseDate\\": \\"2012-05-04\\",\\n  \\"reviewScore\\": 85\\n}"
      ))
    )
  }

  val scn = scenario("Authenticate")
    .exec(authenticate())
    .exec(createNewGame())

  setUp(scn.inject(atOnceUsers(users = 1)).protocols(httpProtocol))
}
\`\`\`

### Feed Data into the Test

#### CsvFeeder

\`\`\`scala
package videogamedb.feeders
import io.gatling.core.Predef._
import io.gatling.http.Predef._

import scala.concurrent.duration.DurationInt

class CsvFeeder extends Simulation{
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  val csvFeeder = csv("data/gameCsvFile.csv").circular

  def getSpecificVideoGame() = {
    repeat(10){
      feed(csvFeeder)
        .exec(http("Get video game with name - #{gameName}")
        .get("/videogame/#{gameId}")
          .check(jsonPath("$.name").is("#{gameName}"))
          .check(status.is(200))
      )
        .pause(1)
    }
  }

  val scn = scenario("Csv feeder test")
    .exec(getSpecificVideoGame())
  setUp(scn.inject(atOnceUsers(users=1)).protocols(httpProtocol))
}
\`\`\`

#### Complex Feeder with Json Template, Random Data (String, Integer, Date)

##### Json Template

Let's create a template here:

<p></p>

<a href="/assets/tech/219/05.png"><img src="/assets/tech/219/05.png" width="340"></a></Center>

<p></p>
<center></center>

Note that for non-string content we **_should not_** enclose it by \`"\`'s.

\`\`\`text
// resources/bodies/newGameTemplate.txt
{
  "id": #{gameId} ,
  "category": "#{category}",
  "name": "#{name}",
  "rating": "#{rating}",
  "releaseDate": "#{releaseDate}",
  "reviewScore": #{reviewScore}
}
\`\`\`

##### Script

\`\`\`scala
package videogamedb.feeders
import io.gatling.core.Predef._
import io.gatling.http.Predef._

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import scala.util.Random

class ComplexCustomFeeder extends Simulation{
  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")

  val idNumbers = (1 to 10).iterator
  val rnd = new Random()
  val now = LocalDate.now()
  val pattern = DateTimeFormatter.ofPattern("yyyy-MM-dd")

  def randomString(length:Int) ={
    rnd.alphanumeric.filter(_.isLetter).take(length).mkString
  }

  def randomDate(startDate: LocalDate, random:Random):String = {
    startDate.minusDays(random.nextInt(30)).format(pattern)
  }

  val customFeeder = Iterator.continually(Map(
    "gameId" -> idNumbers.next(),
    "name" -> ("Game-" + randomString(5)),
    "releaseDate" -> randomDate(now, rnd),
    "reviewScore" -> rnd.nextInt(100),
    "category" ->  ("Category-" + randomString(6)),
    "rating" ->  ("Rating-" + randomString(4)),
  ))

  def authenticate() = {
    exec(http("Authenticate")
      .post("/authenticate")
      .body(StringBody("{\\n  \\"password\\": \\"admin\\",\\n  \\"username\\": \\"admin\\"\\n}"))
      .check(jsonPath("$.token").saveAs("jwtToken"))
    )
  }

  def createNewGame()={
    repeat(10){
      feed(customFeeder)
        .exec(http("Create new game - #{name}").
          post("/videogame")
          .header("authorization", "Bearer #{jwtToken}")
          .body(ElFileBody("bodies/newGameTemplate.json")).asJson
          .check(bodyString.saveAs("responseBody"))
        )
        .exec{session => println(session("responseBody").as[String]); session}
        .pause(1)
    }
  }

  val scn = scenario("Csv feeder test")
    .exec(authenticate())
    .exec(createNewGame())

  setUp(scn.inject(atOnceUsers(users = 1)).protocols(httpProtocol))
}
\`\`\`

### Load Test with Scenario: Increase Number of Users Concurrently for a Period

\`\`\`scala
package videogamedb.simulations

import io.gatling.core.Predef._
import io.gatling.http.Predef._

class BasicLoadSimulation extends Simulation {

  val httpProtocol = http.baseUrl("https://videogamedb.uk/api")
    .acceptHeader("application/json")

  def getAllVideoGames() = {
    exec(
      http("Get all video games")
        .get("/videogame")
    )
  }

  def getSpecificGame() = {
    exec(
      http("Get specific game")
        .get("/videogame/2")
    )
  }

  val scn = scenario("Basic Load Simulation")
    .exec(getAllVideoGames())
    .pause(5)
    .exec(getSpecificGame())
    .pause(5)
    .exec(getAllVideoGames())

  setUp(
    scn.inject(
      nothingFor(5),
      atOnceUsers(5),
      rampUsers(10).during(10)
    ).protocols(httpProtocol)
  )
}
\`\`\`

<p></p>

<a href="/assets/tech/219/07.png"><img src="/assets/tech/219/07.png" width="600"></a></Center>

<p></p>
<center></center>

<p></p>

<a href="/assets/tech/219/06.png"><img src="/assets/tech/219/06.png" width="600"></a></Center>

<p></p>
<center></center>

### More Setup for Different Scenario from Official Documentation

- [Documentation](https://gatling.io/docs/gatling/reference/current/core/injection/#open-model)
`;export{e as default};
