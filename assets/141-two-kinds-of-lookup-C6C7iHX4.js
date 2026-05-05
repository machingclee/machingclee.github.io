const n=`---
title: "Two Kinds of $lookup, and use Javascript in Advanced lookup"
date: 2023-06-15
id: blog0141
tag: mongo
intro: "We demonstrate it by examples."
toc: true
---

### First \\$lookup

\`\`\`js-1
db.ns_material_categories.aggregate(
    [
        {
            $lookup: {
                from: "ns_material_category_groups",
                localField: "group_code",
                foreignField: "code",
                as: "properties"
            }
        },
\`\`\`

The \`$lookup\` here is the most basic form, which do a left join by gluing \`group_code\` and \`code\`.

### Second \\$lookup

The next one is a generalization of the first \`$lookup\`
.

\`\`\`js-11
        {
            $unwind: "$properties"
        },
        {
            $lookup: {
                let: { code: "$code" },
                from: "ns_materials",
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {$eq: ["$category_code", "$$code"]},
                                    {$eq: ["$is_dummy", "Y"]}
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            manu_code: 1,
                            model_code: 1,
                            name: 1
                        }
                    }
                ],
                as: "suppliers"
            }
        }
    ]
)
\`\`\`

This is somewhat more complicated, but the \`pipeline\` makes it much more flexible than the basic form.

### The \`from-let-pipeline-as\` lookup

For look up we have either

- \`from-localField-foreignField-as\`
- \`from-let-pipeline-as\`
  There is no \`pipeline\` when either \`localField\` or \`foreignField\` exists.

We try to break down to explain the more advanced \`$lookup\`, we start form line 16 of the code blocks above.

- In \`let\` we have \`\${code: "$code"}\`, the key \`code\` is the variable name for temp storage, the \`"$code"\` is the field path of an object from the upstream collection in the pipeline.

- We store all desired variable in the \`let\` stage. In this example, we will unwrap and utilize the value by writing \`"$$code"\`.

- We use \`$expr\` to **instantiate** any comparison.

- The basic \`$lookup\` can just do

  \`\`\`mysql
  select a.* from A
  left join B b on b.a_id = a.id
  \`\`\`

- whereas the advanced \`$lookup\` can do
  \`\`\`mysql
  select b.sth1, b.sth2, a.* from A a
  left join B b on b.id = b_id and ... and ... and ...
  \`\`\`
  due to the field \`pipeline\`.

### Using Javascript in $lookup with Pipeline!

\`\`\`js
pipeline: [
    {
        $lookup: {
            from: "ns_generic_form_templates",
            let: { code: "$code" },
            pipeline: [
                { $project: { subtypes: 1 } },
                {
                    $addFields: {
                        formAnalysis: {
                            $function: {
                                body: function (code, subtypes, formId) {
                                    if (!subtypes) {
                                        return null
                                    } else {
                                        const hasForm = subtypes.indexOf(code) > -1;

                                        return { category_code: code, hasForm, formOid: formId }
                                    }
                                },
                                args: ["$$code", "$subtypes", "$_id"],
                                lang: 'js'
                            }
                        }
                    }
                },
                { $project: { subtypes: 0 } }
                {
                $match: {
                    "formAnalysis.hasForm": true
                }
                },
                { $limit: 1 },
                { $replaceRoot: { newRoot: "$formAnalysis" } },
                { $set: { formOid: { $toString: "$formOid" } } },
            ],
            as: "genericForm"
        }
    },
    {
        $unwind: "$genericForm"
    }
]
\`\`\`
`;export{n as default};
