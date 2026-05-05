const n=`---
title: "Mongoose way to Convert String into Objectid in Aggregation"
date: 2023-11-02
id: blog0207
tag: mongoose
intro: "Just a syntax record"
toc: false
---

<style>
  img {
    max-width: 600px;
  }
  video {
    border-radius: 8px;
  }
</style>

<Center></Center>

For example, a \`$lookup\` usually involves a linkage with another collection through \`objectId\` in \`pipeline\` argument.

\`\`\`js
{
    $lookup: {
        let: { hostUserOid: "$hostUserOid" },
        from: UserModel.collection.name,
        pipeline: [
            {
                $match: {
                    $expr: { $eq: ["$_id", { $toObjectId: "$$hostUserOid" }] }
                }
            }
        ],
        as: "hostUser"
    }
},
\`\`\`

Different mongo engine may use different key to convert a string to an \`ObjectId\`, in \`mongodb-java-driver\` it uses \`$oid\` instead of \`$toObjectId\`. Aggregation can have slight difference.
`;export{n as default};
