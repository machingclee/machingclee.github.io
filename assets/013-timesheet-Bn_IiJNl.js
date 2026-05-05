const e=`---
id: portfolio013
title: "Event Time Confirmation System"
intro: This project attempts to confirm times available to all members of an event.
thumbnail: /assets/portfolios/thumbnails/time-confirmation.png
tech: Next.js, Express, PostgreSQL, Lambda Function
thumbWidth: 600
thumbTransX: 15
thumbTransY: 12
hoverImageHeight: 160
date: 2024-03-11
---

<style>
    img{
        max-width: 660px;
    }
    table{

      width: 100%;
      td, th {
        padding: 5px 10px;
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


### Tech Stack

|Tech|Reason|
|---|---|
|Next.js |Love the file-based router, deployed as a vercel.app|
|Express.js|Simple backend|
|Lambda Functions|It's cheap, rather than spending 3x USD/month for low number of requests using ec2 or fargate|
|Prisma|For schema migration only, removed in deployment as it's huge|
|PostgreSQL|With prisma we have flexible schema-migration. I have been using MongoDB for a long while and get used to PGSQL recently, even use it in personal project|
|PGSQL Service Provider| Neon-Tech, it doesn't charge you until you exceed its limit of time for resource computation, love it for POC project|
|Kysely|For query builder|


### Frontend Deployment with Demonstration Links

- [Specific Example of Timesheets](https://ffxiv-timesheet.vercel.app/timesheet/detail?weeklyId=018e2741-6b5d-550f-85aa-fd4bd28fc891)

- [The Timesheet System (google-login required)](https://ffxiv-timesheet.vercel.app/timesheet)


- Light and Dark Mode

  [![](/assets/img/2024-02-18-17-58-57.png)](/assets/img/2024-02-18-17-58-57.png)




### Repository

- https://github.com/machingclee/2024-01-31-FFXIV-Timesheet-System




### Backend Deployment by Lambda Function

- Lambda Service Provided by AWS

  [![](/assets/img/2024-02-18-18-02-02.png)](/assets/img/2024-02-18-18-02-02.png)

- PGSQL and its Schema: (using camel case for column name is just my hobby, I realize it is not conventionally correct)

  [![](/assets/img/2024-02-18-18-43-28.png)](/assets/img/2024-02-18-18-43-28.png)

  


### Why this Project?




#### Background


This project is to ***provide a timetable system*** for a group of ***4 or 8*** players of Final Fantasy XIV to fill in their available timeslots within a week so that,

- All 4 or 8 people of the group can join an event, or

- leader can arrange substitution for that week as early as possible.


For example, 8 people raiding for an ***ultimate dungeon*** in FF14 have to commit 4~6 days per week with 2 hours per day to join the raiding group for practice, e.g.,
  
  ![](/assets/img/2024-02-18-18-05-39.png)

#### Problems to Solve

***Time arrangement is always an headache***, each group ***uses different strategies*** to confirm available timeslots for each of 8 members, for example:

**Case 1.**

  ![](/assets/img/2024-02-18-18-08-00.png)

**Case 2.**

  ![](/assets/img/2024-02-18-18-08-41.png)

**Case 3.** 
  
  ![](/assets/img/2024-02-18-18-08-49.png)

  - In case 3 there is a Japanese member, therefore HKT must be specified.

  - As FFXIV is full of people with ***diversified*** national background, such method is confusing for players in ***different timezones***.


  `;export{e as default};
