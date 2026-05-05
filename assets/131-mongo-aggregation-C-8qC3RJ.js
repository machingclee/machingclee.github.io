const n=`---
title: "List of Mongo Aggregation Pipelines that I have Used."
date: 2023-06-10
id: raspect001
tag: mongo
intro: "Record the mongo query using aggregation pipeline to get the results as in the title in my usual work. These include \`$lookup\`, \`$project\`, \`$arrayElemAt\`, \`{$gt: {$size: 1}}\`, etc interesting operations."
toc: true
---

### Query and Update

#### Return ObjectId in Plain Text by \\$project

\`\`\`js
{ $project:{ _id: { $toString: "$_id" } } }
\`\`\`

#### Update Deeply Nested Object Conditionally

Sometime if a conditional update is hard to write in a single update object, then we can separate it into two parts:

\`\`\`js
{
	db.ns_generic_form_templates.updateMany(
		{ _id: ObjectId("6333d861ec5588b3b43b5183") },
		{
			$set: { "sections.$[].questions.$[question]._mandatory": true },
		},
		{
			arrayFilters: [{ "question.mandatory": "Y" }]
		}
	)
	db.ns_generic_form_templates.updateMany(
		{ _id: ObjectId("6333d861ec5588b3b43b5183") },
		{
			$set: { "sections.$[].questions.$[question]._mandatory": false },
		},
		{
			arrayFilters: [{
				$or: [
					{ "question.mandatory": { $eq: "N" } },
					{ "question.mandatory": { $exists: false } }
				]
			}]
		}
	)
}
\`\`\`

will do.

#### Query Users with Inner Join and Project Desired Fields using \\$map

\`\`\`js
[
    {
        $lookup: {
            from: "%s",
            localField: "code",
            foreignField: "internal_code",
            as: "contacts"
        }
    },
    {
       $project: {
           _id: { $toString: "$_id" },
           code: 1,
           name: 1,
           contacts: {
               $map: {
                   input: "$contacts",
                   as: "this",
                   in: {
                       contact_full_name1: { $ifNull: ["$$this.contact_full_name1", ""] },
                       contact_email1: { $ifNull: ["$$this.contact_email1", ""] },
                       contact_full_name2: { $ifNull: ["$$this.contact_full_name2", ""] },
                       contact_email2: { $ifNull: ["$$this.contact_email2", ""] }
                   }
               }
           }
       }
   }
]
\`\`\`

#### Photos with Missing Signboards

Signboards that are drawn by users will be of type \`Pending\` and can be queried by

\`\`\`js
db.signboards.find({ isManualCreate: true, status: "Pending" })
\`\`\`

If we want to query for images that have pending annotation, then we do a lookup:

\`\`\`js
db.signboards.aggregate(
  [
    {
      $match: {
        signboardId: { $regex: /2022\\-1st_TRIP\\-06/ },
        isManualCreate: true, status: "Pending"
      }
    },
    {
      $lookup: {
        from: "signboardimages",
        localField: "signboardId",
        foreignField: "signboardId",
        as: "signboardimage"
      }
    },
    {
      $project: {
        signboardimage: {
          $arrayElemAt: ["$signboardimage", 0]
        },
        signboardId: 1,
        _id: 0
      }
    },
    {
      $project: {
        originalFilename: "$signboardimage.originalFilename",
        signboardId: 1,
        _id: 0
      }
    },
  ]
)
\`\`\`

Result:

\`\`\`none
[
  { signboardId: '2022-1st_TRIP-02_00377',
    originalFilename: '2022-1st_TRIP-02/P202203252_635_3807.jpg'
  },
  { signboardId: '2022-1st_TRIP-04_00347',
    originalFilename: '2022-1st_TRIP-04/P202203254_463_2778.jpg'
  },
  { signboardId: '2022-1st_TRIP-04_00348',
    originalFilename: '2022-1st_TRIP-04/P202203254_463_2777.jpg'
  },
  ...
]
\`\`\`

#### Photos with False Positive Signboard (that is Deleted)

The annotation of false positive results will be deleted in the frontend, therefore

\`\`\`js
db.signboards.aggregate(
  [
    {
      $match: {
        signboardId: { $regex: /2022\\-1st_TRIP\\-06/ },
        "revisionStatus.signboardIdentificationRevised.status": "deleted"
      }
    },
    {
      $lookup: {
        from: "signboardimages",
        localField: "signboardId",
        foreignField: "signboardId",
        as: "signboardimage"
      }
    },
    {
      $project: {
        signboardimage: {
          $arrayElemAt: ["$signboardimage", 0]
        },
        signboardId: 1,
        "revisionStatus.signboardIdentificationRevised.status": 1,
        _id: 0
      }
    },
    {
      $project: {
        originalFilename: "$signboardimage.originalFilename",
        signboardId: 1,
        "revisionStatus.signboardIdentificationRevised.status": 1,
        _id: 0
      }
    }
  ]
)
\`\`\`

Result:

\`\`\`none
[
  {
    revisionStatus: { signboardIdentificationRevised: { status: 'deleted' } },
    signboardId: '2021-01_TRIP-20_00485',
    originalFilename: '2021-01_TRIP-20/P2021101920_594_3562.jpg'
  }
]
\`\`\`

#### Photos with Missing Defect

If a defect is missing, we will draw polygon to annotate the defective signboard, therefore missing signboards are signboard image with \`defectAnnotations.isManualCreate == true\`:

Suppose I want to get all photos with missing defect(s) in trip06:

\`\`\`js
db.signboardimages.aggregate(
  [
    {
      $unwind: "$defectAnnotations"
    },
    {
      $match: {
        signboardId: { $regex: /2022\\-1st_TRIP\\-06/ },
        "defectAnnotations.isManualCreate": true
      }
    },
    {
      $project: {
        _id: 0,
        signboardId: 1,
        originalFilename: 1
      }
    }
  ]
)
\`\`\`

Result:

\`\`\`none
[
  {
    originalFilename: '2022-1st_TRIP-06/P202204066_2088_12538.jpg',
    signboardId: '2022-1st_TRIP-06_00115'
  }
]
\`\`\`

#### Photos with False Positive Defect

To get photo name with false positive defects, we try to get signboardimages with deleted defect annotation, and then use the \`originalFilename\` to get the photo filenames.

\`\`\`js
db.signboardimages.aggregate(
  [
    {
      $match: {
        signboardId: { $regex: /2022\\-1st_TRIP\\-06/ },
        defectAnnotations: {
          $gt: {$size: 1}
        }
      }
    },
    {
      $project: {
        signboardId: 1,
        originalFilename: 1,
        defectAnnotations: 1,
        _id: 0
      }
    },
    {
      $unwind: "$defectAnnotations"
    },
    {
      $match: {
        "defectAnnotations.status": "deleted"
      }
    }
  ]
)
\`\`\`

yields

\`\`\`none
[
  { originalFilename: '2022-1st_TRIP-01/P202203251_331_1983.jpg',
    defectAnnotations:
    {
      isManualCreate: true,
      status: 'deleted',
      _id: ObjectId("625eb88bdaadc41b9147a385"),
      defectType: 'damagedDisplay',
      location:
        {
          coordinates:
          [ [ [ 0.5452018181472019, 0.11694282238757442 ],
              [ 0.5383045307230735, 0.5721815800254274 ],
              [ 0.7962630803854851, 0.5376322100261263 ],
              [ 0.7852274205068791, 0.06410260944746654 ],
              [ 0.5589963929954593, 0.11491050650526251 ] ] ],
          _id: ObjectId("625eb88bdaadc41b9147a386"),
          type: 'Polygon'
        },
      defectId: '2022-1st_TRIP-01_00001_DAMAGED_DISPLAY_14',
      sequenceNum: 14,
      groupedSignboardId: ObjectId("625eb88bdaadc41b9147a384")
    },
    signboardId: '2022-1st_TRIP-01_00001'
  },
  ...
]
\`\`\`

### Output Complete List to a Json File

Unforturnately the embedded mongoshell of MongoCompass is only for testing purpose, the output cannot be piped into an existing file. For that purpose, we install \`monogosh\` from

https://www.mongodb.com/try/download/shell?jmp=docs

<center></center>

After the installation, you can run

\`\`\`bash
mongosh --help
\`\`\`

to test whether \`mongosh\` has been installed.

Let's take the query for missing signboard as an example, in our bash shell we can run (replace \`$\` by \`\\$\` and \`"\` by \`\\"\`)

\`\`\`sh
mongosh "{{connection string to DSDS db}}" \\
--eval "config.set('displayBatchSize', 300); db.signboards.aggregate(
  [
    {
      \\$match: {
        signboardId: { \\$regex: /2022\\-1st_TRIP\\-06/ },
        isManualCreate: true, status: \\"Pending\\"
      }
    },
    {
      \\$lookup: {
        from: \\"signboardimages\\",
        localField: \\"signboardId\\",
        foreignField: \\"signboardId\\",
        as: \\"signboardimage\\"
      }
    },
    {
      \\$project: {
        signboardimage: {
          \\$arrayElemAt: [\\"\\$signboardimage\\", 0]
        },
        signboardId: 1,
        _id: 0
      }
    },
    {
      \\$project: {
        originalFilename: \\"\\$signboardimage.originalFilename\\",
        signboardId: 1,
        _id: 0
      }
    },
  ]
)" | sed 's/originalFilename/"originalFilename"/g' \\
| sed 's/signboardId/"signboardId"/g' \\
| sed 's/_id/"_id\\"/g' \\
| sed "s/'/\\"/g" \\
> ~/missing-signboards-06.json && code ~/missing-signboards-06.json

\`\`\`
`;export{n as default};
