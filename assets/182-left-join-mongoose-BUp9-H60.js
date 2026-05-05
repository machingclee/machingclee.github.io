const n=`---
title: "Create a left-join in Mongoose"
date: 2023-09-21
id: blog0182
tag: mongo
intro: "We create an aggregation pipeline which acts like a left-join."
toc: true
---

### The Pipelines

#### createLeftJoin

\`\`\`js
const createLeftJoin = (params: {
  from: string,
  localField: { stringToOid?: boolean, fieldName: string },
  foreignField: string,
  leftjoinPipeline: PipelineStage.Lookup["$lookup"]["pipeline"],
  as: string,
}) => {
  const {
    as: newFieldName,
    foreignField,
    from,
    localField,
    leftjoinPipeline,
  } = params;
  const pipeline: PipelineStage[] = [
    {
      $addFields: {
        tmp_localfield: "$" + localField.fieldName,
      },
    },
    {
      $unwind: {
        path: "$tmp_localfield",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        let: { tmp: "$tmp_localfield" },
        from: from,
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  "$" + foreignField,
                  localField.stringToOid ? { $toObjectId: "$$tmp" } : "$$tmp",
                ],
              },
            },
          },
          ...(leftjoinPipeline || []),
        ],
        as: "tmp_singleElementList",
      },
    },
    {
      $unwind: {
        path: "$tmp_singleElementList",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$_id",
        originalData: { $first: "$$ROOT" },
        pushList: { $push: "$tmp_singleElementList" },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ["$originalData", { [newFieldName]: "$pushList" }],
        },
      },
    },
    {
      $unset: "tmp_singleElementList",
    },
    {
      $unset: "tmp_localfield",
    },
  ];
  return pipeline;
};
\`\`\`

#### createSqueeze

\`\`\`js
const createSqueeze = (fieldName: string): PipelineStage[] => {
  return [
    {
      $unwind: {
        path: "$" + fieldName,
        preserveNullAndEmptyArrays: true,
      },
    },
  ];
};
\`\`\`

### Usage

\`\`\`js
const results = await RoomModel.aggregate([
  { $match: {} },
  {
    $project: { code: 1, name: 1, hostUserOid: 1, active: 1, createdAt: 1 },
  },
  ...mongoUtil.createLeftJoin({
    from: UserModel.collection.name,
    localField: { stringToOid: true, fieldName: "hostUserOid" },
    foreignField: "_id",
    leftjoinPipeline: [{ $project: { _id: 0, name: 1, email: 1 } }],
    as: "hostUser",
  }),
  ...mongoUtil.createSqueeze("hostUser"),
]).exec();
\`\`\`

Note that we also cover the case when our \`localField\` is an **_stringified_** \`ObjectId\`, we provide a \`stringToOid\` option to convert the string into \`ObjectId\` which inherits an index for searching.
`;export{n as default};
