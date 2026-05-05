const n=`---
title: "Write Mongo Aggregation Using JSON in Springboot"
date: 2023-07-30
id: blog0137
tag: java, mongo
intro: "We get rid of the headache of writing mongo agggregation using mongo apis in java given that we already know how to write that in json format."
toc: true
---

### The JsonPipeline Class with Pipleline Builder

In our Mongo package we add the following subclass:

\`\`\`java
public class Mongo {
    ...
public static class JsonPipeline {
        private static String trailingBracketWithSpaces = "\\\\]\\\\s*$";
        private static String startBracketWithSpaces = "^\\\\s*\\\\[";

        private String totalPipelineString = "";

        public List<BsonDocument> get() {
            return parseJsonPipline();
        }

        private List<BsonDocument> parseJsonPipline() {
            this.add("[{$addFields: {oid: {$toString: \\"$_id\\"}}}, {$unset: \\"_id\\"}]");
            var pipelines_ = new BsonArrayCodec()
                    .decode(new JsonReader(totalPipelineString), DecoderContext.builder().build())
                    .stream()
                    .map(BsonValue::asDocument)
                    .collect(Collectors.toList());

            return pipelines_;

        }

        public JsonPipeline add(String json) {
            if (totalPipelineString.isEmpty()) {
                totalPipelineString = json;
            } else {
                String prevRemoveCloseBrac = totalPipelineString.replaceAll(trailingBracketWithSpaces, "");
                String nextRemoveOpenBrac = json.replaceAll(startBracketWithSpaces, "");
                totalPipelineString = prevRemoveCloseBrac + "," + nextRemoveOpenBrac;
            }
            return this;
        }

        public String getTotalPipelineString() {
            return totalPipelineString;
        }

        /**
         * oid will be automatically created for foreign collection, the result will
         * always be an array.
         * Make sure to {$unwind: "$newFieldName"} if you are sure there are only one
         * element in the result.
         */
        public JsonPipeline addLeftJoin(
                String foreignCollection,
                String localField,
                String foreignField,
                String leftJoinPipeline,
                String newFieldName) {

            String _jsonPipeline = String.format("""
                    [
                        {
                            $addFields: {
                                tmp_localfield: "%s"
                            }
                        },
                        {
                            $unwind: {
                                path: "$tmp_localfield",
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                let: { tmp: "$tmp_localfield"},
                                from: "%s",
                                pipeline: [
                                     {
                                        $addFields:{
                                            oid: {$toString: "$_id"}
                                        }
                                    },
                                    {
                                        $unset: "_id"
                                    },
                                    {
                                        $match:{
                                            $expr:{
                                                $eq: ["$$tmp", "%s"]
                                            }
                                        }
                                    },
                                    %s
                                ],
                                as: "tmp_singleElementList"
                            }
                        },
                        {
                            $unwind: {
                                path: "$tmp_singleElementList",
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $group:{
                                _id: "$_id",
                                originalData: { $first: "$$ROOT"},
                                pushList: { $push: "$tmp_singleElementList" }
                            }
                        },
                        {
                            $replaceRoot: {
                                newRoot: {
                                    $mergeObjects: [
                                        "$originalData",
                                        { %s: "$pushList" }
                                    ]
                                }
                            }
                        },
                        {
                            $unset : "tmp_singleElementList"
                        },
                        {
                            $unset : "tmp_localfield"
                        }
                    ]
                    """,
                    "$" + localField,
                    foreignCollection,
                    "$" + foreignField,
                    leftJoinPipeline.replaceAll("(^\\\\s*\\\\[)|(\\\\]\\\\s*)$", ""),
                    newFieldName);

            return this.add(_jsonPipeline);
        }
    }

    public static JsonPipeline createJsonPipeline() {
        return new JsonPipeline();
    }
}
\`\`\`

### Pipelines

#### Simplest One

Now a projection pipeline can be as simple as

\`\`\`java
var pipeline = Mongo.createJsonPipeline();
pipeline.add("[{ $project: { code: 1, name: 1, role: 1 }}]");
List<Document> results = companies.aggregate(pipeline.get()).into(new ArrayList<>());
\`\`\`

instead of

\`\`\`java
var projections = Arrays.asList(
        Aggregates.project(
                Projections.fields(
                        Projections.include("code"),
                        Projections.include("name"),
                        Projections.include("role")
                ))
);
List<Document> results = companies.aggregate(projections).into(new ArrayList<>());
\`\`\`

#### More Advanced Pipeline with Left Joins

\`\`\`java
var chainOid = searchEmailRefinedParam.getEmail_chain_oid();
var chainCollection = mongodb.getCollection(CollectionNames.email_messages);
var pipeline = MongoDB.createJsonPipeline();
pipeline
    .add(String.format("[{ $match:{ email_chain_oid: \\"%s\\" }}]", chainOid))
    .addLeftJoin(CollectionNames.users,
            "sender_email",
            "user_name",
            "[{ $project: {user_name: 1, email: 1, first_name: 1, last_name: 1, company_code: 1} }]",
            "senderInDb")
    .add("[{$unwind: \\"$senderInDb\\"}]")
    .addLeftJoin(CollectionNames.users,
            "recipient_emails",
            "user_name",
            "[{ $project: {user_name: 1, email: 1, first_name: 1, last_name: 1} }]",
            "recipientsInDb")
    .addLeftJoin(CollectionNames.companies,
            "senderInDb.company_code",
            "code",
            "[{ $project:{ name:1 } }]",
            "sender_company")
    .add("[{ $unwind: \\"$sender_company\\" }]");

var emailsResult = chainCollection.aggregate(pipeline.get()).into(new ArrayList<>());
\`\`\`
`;export{n as default};
