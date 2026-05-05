const e=`---
title: "As-With Clause in SQL"
date: 2024-02-28
id: blog0242
tag: kysely, sql
intro: "Some simple yet common use case of as-with clause in sql, and its counterpart in kysely."
toc: true
---

<style>
  img {
    max-width: 660px
  }
</style>


### Objective

The use case:

- Due to the nature of \`left-join\`'s our table will get bigger and bigger with rows that we might think of as "duplicated".

- For example, in an invitation table (we call this \`UserToChannel\`) there can be plenty of users inviting a single user into a channel, in that case our business logic would ***require only the first invitation be effective*** (but we still wish to leave the invitation record).

- There can be even more duplicated rows due to ***left-joins*** without very refined \`where\` clauses (or there can't be such conditions).

- Therefore when we want to get all invitation, we wish to ***collapse*** all invitations into 1 invitation per channel.

- However, we want to sort the invitation by \`createdAt\` in descending order.

***Problem.***  We cannot 
- Collapse (deduplicate, using the first occurence) by \`createdAt\` in ascending order and 
- Sort by \`createdAt\` in descending order 

at the same time.

<center></center>

***Solution.*** 
- We use \`With Collapsed AS (SELECT ...)\` to create a deduplicated table, then 
- we sort this deduplicated table as if we are sorting an existing table


**Remark.** This technique is also helpful if we want to create a table of \`id\`'s for \`intersection\` (inner-join) to another table on the \`id\` condition.



### SQL

We skip the tedious select and where clauses and only leave the important part that we use to "deduplicate", the detail can be seen in kysely part of the next section:

\`\`\`text
WITH collapsedChannels AS (
  SELECT DISTINCT ON ("Channel".id) "Channel".*, "UserToChannel".joined, ... (not important) 
  FROM "Channel"
  WHERE ...
  ORDER BY "Channel".id "Channel"."createdAt" asc
) 
SELECT * FROM "collapsedChannels"
ORDER BY "collapsedChannels"."createdAt" desc
\`\`\`

Note that we first group \`createdAt\` by \`asc\` and then order that by \`desc\`.


### Kysely

The following is the actual code implementation of a request handler:

\`\`\`js
const getChannels = async (req: Request, res: Response) => {
    const userId = req.user?.userId || "";
    const userEmail = req.user?.email || "";
    const isAdmin = req.user?.isAdmin || false;
    const { projectId } = req.params;
    let reportChannel: Channel | undefined

    reportChannel = await db.selectFrom("Channel").selectAll().where("Channel.type", "=", "EXPORT_REPORT").executeTakeFirst();

    if (!reportChannel) {
        reportChannel = await db.insertInto("Channel").values({
            type: "EXPORT_REPORT",
            isDeleted: false,
            name: "Export Report",
        })
            .returningAll()
            .executeTakeFirst();
    }

    const standardChannels_ = db.with("collapsedChannels", db => db.selectFrom("Channel")
        .leftJoin("UserToChannel", "UserToChannel.channelId", "Channel.id")
        .leftJoin("UserToProjectInvitation", "UserToProjectInvitation.linkedByChannelId", "Channel.id")
        .leftJoin("User as Inviter", "Inviter.companyEmail", "UserToProjectInvitation.invitedByEmail")
        .leftJoin("Company as InviterCompany", "InviterCompany.id", "Inviter.companyId")
        .selectAll("Channel")
        .select("UserToChannel.joined")
        .select(eb => {
            const firstName = eb.ref("Inviter.firstName");
            const lastName = eb.ref("Inviter.lastName");
            const fullName = sql<string>\`concat(\${firstName}, ' ', \${lastName})\`;
            return fullName.as("inviterName")
        })
        .select("InviterCompany.name as inviterCompanyName")
        .select("UserToProjectInvitation.invitedByUser")
        .select(eb => [
            jsonObjectFrom(
                eb.selectFrom("MessagesSession")
                    .select([
                        eb => eb.fn.count("MessagesSession.id").as("count")
                    ])
                    .whereRef("MessagesSession.channelId", "=", "Channel.id")
                    .where("MessagesSession.hostUserId", "=", userId)
                    .where("MessagesSession.isDeleted", "!=", true)
                    .where("MessagesSession.isSessionConfirmed", "=", true)
                    .where("MessagesSession.isDraftInstantIssue", "=", true)
            ).as("draft")
        ])
        .where("Channel.projectId", "=", projectId)
        .where("Channel.isDeleted", "=", false)
        .$if(!isAdmin, qb => qb.where("UserToChannel.userEmail", "=", userEmail))
        .distinctOn("Channel.id")
        .orderBy(["Channel.id", "Channel.createdAt asc"])
    )

    const standardChannels = await standardChannels_
        .selectFrom("collapsedChannels")
        .selectAll()
        .orderBy("collapsedChannels.createdAt desc")
        .execute();

    res.json({
        success: true,
        result: { channels: [reportChannel, ...standardChannels] }
    });
}
\`\`\``;export{e as default};
