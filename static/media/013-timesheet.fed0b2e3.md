---
id: portfolio013
title: "Event Time Confirmation System"
intro: This projects attempts to confirm times available to all members of an event.
thumbnail: /assets/portfolios/thumbnails/time-confirmation.png
tech: Next.js, Express, PostgreSQL, Lambda Function
thumbWidth: 600
thumbTransX: -100
thumbTransY: -150
date: 2024-03-11
toc: true
---

<style>
    img{
        max-width: 660px;
    }
    table{
      width: 100%;
      td, th {
        padding: 2px 10px;
      }
      tr:nth-child(2n){
        background-color: rgba(0,0,0,0.05);
      }
      td:nth-child(1) {
        vertical-align: top;
        width:170px;
      }
    }
</style>

#### Repository

- https://github.com/machingclee/2024-01-31-FFXIV-Timesheet-System

#### Deployment 
##### Deployed Frontend
- https://ffxiv-timesheet.vercel.app/timesheet

- [Specific Example of Timesheets](https://ffxiv-timesheet.vercel.app/timesheet/detail?weeklyId=9f084019-29b2-4ca9-ab4a-638713583cb0)


- The layout (light and dark mode):

  [![](/assets/img/2024-02-13-00-41-01.png)](/assets/img/2024-02-13-00-41-01.png)

##### Deployed Backend
- Lambda Service Provided by AWS

  [![](/assets/img/2024-02-12-16-55-07.png)](/assets/img/2024-02-12-16-55-07.png)

#### Tech Stack and Some of My Technical Consideration for the Stack
##### Next.js
###### Choose to use External Backend Instead of Using `app/api/` Folder in Nextjs
- Unlike usual middlewares in `express.js`, middlewares in `next.js` cannot modify the `req` object, and therefore not able to equip `req` with desired new properties along the chain of middlewares.

- Each api call is handled by a single file and each file exports  `GET, POST, PUT, DELETE` methods.

  However, I am used to functional way of defining handlers using  `app.get, app.post`, etc, that can be organized ***in a single file***.

- More refined error handling by customized middleware.

###### Then Why Nextjs anyway?
- Love the file-based router, deployed as a vercel.app.

##### Lambda Functions
   
- It's cheap, much better choice than EC2/Fargate which usually cost 3x USD/month when it comes to low number of requests.


   

##### PostgreSQL, Prisma
###### Prisma 
- Prisma is for schema migration only, it is removed in deployment as it's huge.

###### Why not MongoDB?  

- Flexible-schema is no longer an advantage of MongoDB over other choices as we have flexible schema-migration using Prisma. Moreover, using MongoDB in a relational way has been a ***painful*** process that leads me to a list of studies [***here***](/blog/category/mongo). 
 
  Writing aggregation pipeline ***is not fun, is tedious, and the syntaxes are not memorizable***, I wound't do it again unless necessary.

- Therefore with Prisma there is no good reason to use key-value based storage such as MongoDB, ***unless*** we need caching to improve performance and want a layer before database for repeated I/O requesting for the same set of data.

###### When MongoDB?

- For a medium size project I usually use both relational and non-relational db.

- For me I usually use it to store ***completely non-relational*** stuff (data that you wouldn't "join" them across different collections).

- Examples include 
  - Logging of different services.

  - LLM generated AI Result that has deeply nested structure which we wouldn't want to store in relational DB.
    - Though we can store them in `jsonb` format inside PostgreSQL, it is hard to read and analysed. 
    
    - Recall that PostgreSQL is not a kind of database used for data analytics as it is a row-based database.



##### Kysely

- As a query builder, that's why we remove Prisma in deployment.



#### Problem Encountered
##### Why this Project?
The initiative for this project is to provide a system for a group of 4 or 8 players of Final Fantasy XIV to:

- Fill in their **available timeslots** within a week so that,
- **All** 4 or 8 people of the group can join an event, or special arrangement ***otherwise***.

- Example:

  ![](/assets/img/2024-02-12-15-49-45.png)

  8 people raiding for an ***ultimate dungeon*** in FF14 have to commit 4~6 days a week, and 2 hours for each day, to join the raiding group and practice. 
  
##### Problem and Common Re-invention of Existing Solutions
Time arrangement is always an headache, though a timeslot of 9:00 pm to 11:00 pm is pre-assigned in the recruitment, delaying for 0.5 to 1 hour is always acceptible. 

Sometimes due to active atmosphere, i.e., members want to devote more time, timeslots can ***change drastically***.

Each group I have seen uses different strategies to confirm available timeslots ***for each*** of 8 members, for eaxample:

- Some may use google sheet and mark manually the timeslot available to all 8 members. 

  ![](/assets/img/2024-02-12-23-21-28.png)

- Some may also make a check-list using google sheet which is quite similar to my web-based solution presented in the next section, with their own formula to mark timeslots available:

  ![](/assets/img/2024-02-12-23-19-43.png)

- Some may react to a sentence (which is a timeslot) ***inside discord*** by "icons" provided by discord and confirm a timeslot until there are 8 icons:

  ![](/assets/img/2024-02-11-20-59-52.png)



- As FFXIV is a game full of people with ***diversified*** national background, such method is confusing for players of ***different timezones***.



##### Concluding Problems

As we have seen,  the issues are 

- Variable Timeslot 

- Re-invention of Solutions

which we want to address by providing web-based simple solution.


#### My Solution


- All these  aforementioned tedious methods work well with enough communication between leader and group members. 

- But why don't just let the members tell which timeslots are avilable? That's the main purpose of my timesheet system:

  [![](/assets/img/2024-02-11-21-28-39.png)](/assets/img/2024-02-11-21-28-39.png)

- Moreover, my solution is ***timezone-independent***, HK-player who fills 7:00 pm will appear to be 8:00 pm for a JP-player.

