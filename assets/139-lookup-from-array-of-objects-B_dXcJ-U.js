const n=`---
title: "Inner and Left Joining Multiple Collections in Mongo --- The preserveNullAndEmptyArrays in $unwind"
date: 2023-06-15
id: blog0139
tag: mongo
intro: "$lookup only works for the whole collection, we demonstrate how to left join another collection using a field which is an array."
toc: true
---

### Demonstration 1 Look up from Arrays Instead of Collections (Inner Joins Only)

#### Stages

- Since look up is only available for collections in mongodb, if there is a property among the array of elements, like \`id\`, which we need to left join with another collection. We need to \`$unwind\` it to reduce the problem into our old familiar problem.

- Next we need to undo the \`$unwind\` process, which can be done by using using all other fields jointly to form an\`_id\` object, then we push the lookup results into an array according to this \`_id\`.

- We then use \`$replaceRoot: {  newRoot: ... }\` trick to move everything in \`_id: {...}\` to the parent level.

#### Full Breakdown

\`\`\`javascript-1
db.ns_material_categories.aggregate([
    {
        $lookup: {
            let: { group_code: "$group_code" },
            from: "ns_material_category_groups",
            pipeline: [
                { $match: { $expr: { $eq: ["$code", "$$group_code"] } } },
                { $project: { name: 1, code: 1, _id: 0 } }
            ],
            as: "materialGroup"
        }
    },
    {
        $match: {
            $expr: {
                $eq: ["$enabled", "Y"]
            }
        }
    },
    {
        $unwind: "$materialGroup"
    },
\`\`\`

This lookup only aims at left-joining \`ns_material_category_groups\` to get \`materialGroup\`, which becomes an array of objects of only 1 element (due to 1-1 correspondance), we \`$unwind\` to sequeeze the array into an object:

\`\`\`none
 [{
    "_id": {
        "timestamp": 1648724334,
        "date": "2022-03-31T10:58:54.000+00:00"
    },
    "code": "FINISHES_CERAMIC_TILES",
    "group_code": "InteriorFinishes",
    "enabled": "Y",
    "materialGroup": {
        "code": "InteriorFinishes"
    }
}]
\`\`\`

We next need to lookup from another collection using the field \`code\`:

\`\`\`javascript-23
   {
        $lookup: {
            let: { code: "$code" },
            from: "ns_materials",
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$category_code", "$$code"] },
                                { $eq: ["$is_dummy", "Y"] }
                            ]
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        manu_code: 1,
                    }
                }
            ],
            as: "suppliers"
        }
    },
\`\`\`

At this point our queried object becomes

\`\`\`none
[
    {
        "_id": {
            "timestamp": 1648724334,
            "date": "2022-03-31T10:58:54.000+00:00"
        },
        "code": "FINISHES_CERAMIC_TILES",
        "group_code": "InteriorFinishes",
        "enabled": "Y",
        "materialGroup": {
            "code": "InteriorFinishes"
        },
        "suppliers": [
            {
                "manu_code": "DAUGRES"
            },
            {
                "manu_code": "ELEPHOME"
            },
            {
                "manu_code": "HONGYU"
            },
            {
                "manu_code": "KITO"
            },
            {
                "manu_code": "MMMOSAIC"
            }
        ]
    },
 ...
]
\`\`\`

But we need to look up from another collection using \`manu_code\`, we \`$unwind\` the \`suppliers\` field and do a \`$lookup\` from \`ns_material_manus\` again to get the \`name_en\` field.

\`\`\`javascript-48
    {
        $unwind: "$suppliers"
    },
    {
        $lookup: {
            let: { manu_code: "$suppliers.manu_code" },
            from: "ns_material_manus",
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $eq: ["$$manu_code", "$internal_code"]
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        name_en: 1
                    }
                },
                { $limit: 1 }
            ],
            as: "supplierDetail"
        }
    },
\`\`\`

At this point we get

\`\`\`none
[
    {
        "_id": {
            "timestamp": 1648724334,
            "date": "2022-03-31T10:58:54.000+00:00"
        },
        "code": "FINISHES_CERAMIC_TILES",
        "group_code": "InteriorFinishes",
        "enabled": "Y",
        "materialGroup": {
            "code": "InteriorFinishes"
        },
        "suppliers": {
            "manu_code": "DAUGRES"
        },
        "supplierDetail": [
            {
                "name_en": "DAUGRES"
            }
        ]
    },
    ...
]
\`\`\`

- Note that we have used \`{ $limit: 1 }\` as we understand each company only has one name, lookup results are born with being an array.

- We \`$unwind\` it to get ordinary object and finally use the original fields jointly as an \`_id\` to group all supplier results:

\`\`\`javascript-74
    {
        $unwind: "$supplierDetail"
    },
    {
        $group: {
            _id: {
                code: "$code",
                group_code: "$group_code",
                name: "$name",
                "code": "$code",
                "group_code": "$group_code",
                "enabled": "$enabled",
                "materialGroup": "$materialGroup"
            },
            suppliers: { "$push": { name_en: "$supplierDetail.name_en" } }
        }
    },
\`\`\`

The result at this point is of the form:

\`\`\`none
[
    {
        "_id": {
            "code": "EXTERIOR_FINISHES_COMPOSITE_DECKING",
            "group_code": "ExteriorFlooring",
            "enabled": "Y",
            "materialGroup": {
                "code": "ExteriorFlooring"
            }
        },
        "suppliers": [
            {
                "name_en": "GREENZONE"
            },
            {
                "name_en": "MEXY"
            }
        ]
    },
    ...
]
\`\`\`

We finally move everything inside \`_id\` to upper level:

\`\`\`javascript-93
    {
        $replaceRoot: {
            newRoot: {
                $mergeObjects: ["$_id", { suppliers: "$suppliers" }]
            }
        }
    }
])
\`\`\`

which finally yields

\`\`\`none
[
    {
        "code": "TAPWARES_KITCHEN_TAPWARE",
        "group_code": "Tapwares.Accessories",
        "enabled": "Y",
        "materialGroup": {
            "code": "Tapwares.Accessories"
        },
        "suppliers": [
            {
                "name_en": "EMPOLO"
            },
            {
                "name_en": "ECCO VITA"
            }
        ]
    },
    ...
]
\`\`\`

### Demonstration 2: \`$lookup\` + \`$unwind\` by Default is an Inner Join

#### Example Demonstrating Inner Join Behaviour

Consider the following aggregation, we are restricting ourself to look at only one "problematic" document by enforcing \`{ code: "NEW_CATEGORY_20230614C" }\`.

\`\`\`js-1
db.ns_material_categories.aggregate([
    {
        $match: {
            $and: [
                { enabled: "Y" },
                { code: "NEW_CATEGORY_20230614C" }
            ]
        }
    },
    {
        $lookup: {
            let: { group_code: "$group_code" },
            from: "ns_material_category_groups",
            pipeline: [
                { $match: { $expr: { $eq: ["$code", "$$group_code"] } } },
                { $project: { oid: { $toString: "$_id" }, name: 1, code: 1, _id: 0 } }
            ],
            as: "catGroup"
        }
    },
    {
        $unwind: "$catGroup"
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
                                { $eq: ["$category_code", "$$code"] },
                                { $eq: ["$is_dummy", "Y"] }
                            ]
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        manu_code: 1,
                    }
                }
            ],
            as: "suppliers"
        }
    },
\`\`\`

At this point the result is:

\`\`\`none
[
  {
    "_id": {
      "$oid": "648954d9547dee498d4f85a3"
    },
    "code": "NEW_CATEGORY_20230614C",
    "group_code": "NewCategoryGroup20230614c",
    "enabled": "Y",
    "catGroup": {
      "code": "NewCategoryGroup20230614c",
      "oid": "648954d2547dee498d4f85a2"
    },
    "suppliers": []
  }
]
\`\`\`

Note that \`suppliers\` is an empty array, which means that we have _nothing matched_ from the table on the right.

Each item in \`suppliers\` contains a field called \`manu_code\`, with which we will be using to look up from another collection, for this purpose, we need to \`$unwind\` \`suppliers\` field and then do a \`$lookup\` using \`$suppliers.manu_code\`.

\`\`\`js-50
    {
        $unwind: "$suppliers"
    },
\`\`\`

but oops!

\`\`\`none
[]
\`\`\`

We conclude from this stage that by default \`$lookup + $unwind\` is an inner join operation (assuming we will be doing \`$group\` action in the last stage).

#### unwind with preserveNullAndEmptyArrays: true

As in mySQL we most of the time want to \`left join\` instead of \`inner join\`, if we instead

\`\`\`js-50
    {
        $unwind: {
            path: "$suppliers",
            preserveNullAndEmptyArrays: true
        }
    },
\`\`\`

we get

\`\`\`none
[
  {
    "_id": {
      "$oid": "648954d9547dee498d4f85a3"
    },
    "code": "NEW_CATEGORY_20230614C",
    "group_code": "NewCategoryGroup20230614c",
    "enabled": "Y",
    "catGroup": {
      "code": "NewCategoryGroup20230614c",
      "oid": "648954d2547dee498d4f85a2"
    }
  }
]
\`\`\`

that means row on the left table is preserved even we match nothing on the right table. This is exactly what \`left join\` does.

If we do a look up using \`suppliers.manu_code\`:

\`\`\`js-53
    {
        $lookup: {
            let: { manu_code: "$suppliers.manu_code" },
            from: "ns_material_manus",
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $eq: ["$$manu_code", "$internal_code"]
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        name_en: 1
                    }
                },
                { $limit: 1 }
            ],
            as: "supplierDetail"
        }
    },
\`\`\`

we get

\`\`\`none
[
  {
    "_id": {
      "$oid": "648954d9547dee498d4f85a3"
    },
    "code": "NEW_CATEGORY_20230614C",
    "group_code": "NewCategoryGroup20230614c",
    "enabled": "Y",
    "catGroup": {
      "code": "NewCategoryGroup20230614c",
      "oid": "648954d2547dee498d4f85a2"
    },
    "supplierDetail": []
  }
]
\`\`\`

As desired.

#### Grouping and Handling the \`[ {} ]\` Result

##### Starting from Nonempty Suppliers Document and Group the Results

We enforce \`{ code: "EXTERIOR_FLOORING_COBBLE_STONE" }\` at the beginning of the aggregation script, this has 3 suppliers and thefore we have 3 supplierDetails.

Up to line 75 of the aggregation script, the result will be 3 pieces of data having the following form (with \`suppliers\` and \`supplierDetail\` being the only varying field)

\`\`\`none
{
  "_id": {
    "$oid": "63316d25fe1ff183f4436771"
  },
  "code": "KITCHEN_APPLIANCES_OVEN",
  "group_code": "KitchenAppliances",
  "enabled": "Y",
  "catGroup": {
    "code": "KitchenAppliances",
    "oid": "63316d07fe1ff183f443676a"
  },
  "suppliers": {
    "manu_code": "FOTILE"
  },
  "supplierDetail": [
    {
      "name_en": "FOTILE"
    }
  ]
}
\`\`\`

Next we \`$unwind\` (just for squeezing the array) and \`$group\` what we need:

\`\`\`js-76
    {
        $unwind: {
            path: "$supplierDetail",
            preserveNullAndEmptyArrays: true
        }
    },
    {
        $group: {
            _id: {
                oid: { $toString: "$_id" },
                code: "$code",
                enabled: "$enabled",
                catGroup: "$catGroup"
            },
            suppliers: { "$push": { name_en: "$supplierDetail.name_en" } }
        }
    },
\`\`\`

which yields:

\`\`\`none
[
  {
    "_id": {
      "oid": "63316d25fe1ff183f4436770",
      "code": "EXTERIOR_FLOORING_COBBLE_STONE",
      "enabled": "Y",
      "catGroup": {
        "code": "ExteriorFlooring",
        "oid": "62cbbf0b35fc26d4990aa2f1"
      }
    },
    "suppliers": [
      {
        "name_en": "DALEI"
      },
      {
        "name_en": "EASTWOOD STONE"
      },
      {
        "name_en": "STONELINK"
      }
    ]
  }
]
\`\`\`

\`$replaceRoot\` is the trick to bring everything in \`_id\` to the top level:

\`\`\`js-99
    {
        $replaceRoot: {
            newRoot: {
                $mergeObjects: ["$_id", { suppliers: "$suppliers" }]
            }
        }
    },
\`\`\`

which results in:

\`\`\`none
[
  {
    "oid": "63316d25fe1ff183f4436770",
    "code": "EXTERIOR_FLOORING_COBBLE_STONE",
    "enabled": "Y",
    "catGroup": {
      "code": "ExteriorFlooring",
      "oid": "62cbbf0b35fc26d4990aa2f1"
    },
    "suppliers": [
      {
        "name_en": "DALEI"
      },
      {
        "name_en": "EASTWOOD STONE"
      },
      {
        "name_en": "STONELINK"
      }
    ]
  }
]
\`\`\`

We finally look up another table for technical purpose. Note the use of javascript, which is considerably tedious if we rely merely on mongo query:

\`\`\`js-106
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
                { $project: { subtypes: 0 } },
                {
                    $match: { "formAnalysis.hasForm": true }
                },
                { $limit: 1 },
                { $replaceRoot: { newRoot: "$formAnalysis" } },
                { $set: { formOid: { $toString: "$formOid" } } },
            ],
            as: "genericForm"
        }
    },
\`\`\`

We next \`$unwind\` again simply for sequeezing the array into a single object:

\`\`\`js-142
    {
        $unwind: {
            path: "$genericForm",
            preserveNullAndEmptyArrays: true
        }
    },
\`\`\`

And we get a pretty result:

\`\`\`none
[
  {
    "oid": "63316d25fe1ff183f4436770",
    "code": "EXTERIOR_FLOORING_COBBLE_STONE",
    "enabled": "Y",
    "catGroup": {
      "code": "ExteriorFlooring",
      "oid": "62cbbf0b35fc26d4990aa2f1"
    },
    "suppliers": [
      {
        "name_en": "DALEI"
      },
      {
        "name_en": "EASTWOOD STONE"
      },
      {
        "name_en": "STONELINK"
      }
    ],
    "genericForm": {
      "category_code": "EXTERIOR_FLOORING_COBBLE_STONE",
      "hasForm": true,
      "formOid": "62972948261ac272d152e238"
    }
  }
]
\`\`\`

##### Starting from Empty Suppliers Document and Deal with \`[ {} ]\`

We go back to \`{ code: "NEW_CATEGORY_20230614C" }\` which has no suppliers. We run through all the same script to line 147 as above, then the result becomes

\`\`\`none
[
  {
    "oid": "648954d9547dee498d4f85a3",
    "code": "NEW_CATEGORY_20230614C",
    "enabled": "Y",
    "catGroup": {
      "code": "NewCategoryGroup20230614c",
      "oid": "648954d2547dee498d4f85a2"
    },
    "suppliers": [
      {}
    ]
  }
]
\`\`\`

To make \`[ {} ]\` into \`[]\`, we do a filtering:

\`\`\`js-149
        {
            $set: {
                suppliers: {
                    $filter: {
                        input: "$suppliers",
                        cond: {
                            $ifNull: ["$$this.name_en", false]
                        }
                    }
                }
            }
        }
    ]
)
\`\`\`

and we get:

\`\`\`none
[
  {
    "oid": "648954d9547dee498d4f85a3",
    "code": "NEW_CATEGORY_20230614C",
    "enabled": "Y",
    "catGroup": {
      "code": "NewCategoryGroup20230614c",
      "oid": "648954d2547dee498d4f85a2"
    },
    "suppliers": []
  }
]


\`\`\`
`;export{n as default};
