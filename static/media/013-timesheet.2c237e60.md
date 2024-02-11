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

- https://ffxiv-timesheet.vercel.app/timesheet
- [Specific Example of Timesheets](https://ffxiv-timesheet.vercel.app/timesheet/detail?weeklyId=9f084019-29b2-4ca9-ab4a-638713583cb0)


#### Tech Stack

|Tech|Reason|
|---|---|
|Next.js |love the file-based router, deployed as a vercel.app|
|Express|simple backend|
|Lambda Functions|It's cheap, rather than spending 3x USD/month for low number of requests|
|PostgreSQL|with Prisma no good reason to use key-value based storage such as mongo instead of relational database, which business has no relation anyway?|
|Prisma|for schema migration only, removed in deployment as it's huge|
|Kysely|for query builder|

#### Why this Project? Problem Encountered

The initiative for this project is to provide a system for a group of 4 or 8 players of Final Fantasy XIV to:

- Fill in their **available timeslots** within a week so that,
- **All** 4 or 8 people of the group can join an event, or special arrangement ***otherwise***.

For example, 8 people raiding for an ***ultimate dungeon*** in FF14 have to commit 4~6 days a week, and 2 hours for each day, to join the raiding group and practice. 

Time arrangement is always an headache, each group uses different strategies to confirm available timeslots ***for each*** of 8 members, for eaxample:

- Some may use google sheet and use their own formula to mark timeslots available to all 8 members. 

  ![](/assets/img/2024-02-11-20-56-19.png)

- Some may also make a check-list using google sheet which is quite similar to my web-based solution presented in the last section:

  ![](/assets/img/2024-02-11-21-57-41.png)

- Some may react to a sentence (which is a timeslot) by "icons" provided by discord and confirm a timeslot until there are 8 icons

  ![](/assets/img/2024-02-11-20-59-52.png)


- As FFXIV is a game full of people with ***diversified*** national background, such method is confusing for players of ***different timezones***.


#### My Solution

- All these methods work well with enough communication between leader and group members. 

- But why don't just let the members tell which timeslots are avilable? That's the main purpose of my timesheet system:

  [![](/assets/img/2024-02-11-21-28-39.png)](/assets/img/2024-02-11-21-28-39.png)

- Moreover, my solution is ***timezone-independent***, HK-player who fills 7:00 pm will appear to be 8:00 pm for a JP-player.