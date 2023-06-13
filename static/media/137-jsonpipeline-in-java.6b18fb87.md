---
title: "Write Mongo Aggregation Using JSON in Java Springboot"
date: 2023-06-11
id: blog0137
tag: java, mongo
intro: "We get rid of the headache of writing mongo agggregation using mongo apis in java given that we already know how to write that in json format."
toc: false
---

In our Mongo package we add the following subclass:

```java
public class Mongo {
    ...
    public class JsonAggregration {
        private List<BsonDocument> pipline = new ArrayList<>();

        public List<BsonDocument> get() {
            return pipline;
        }

        public void add(String json) {
            var pipeline_ = new BsonArrayCodec()
                    .decode(
                        new JsonReader(json),
                        DecoderContext.builder().build()
                    )
                    .stream()
                    .map(BsonValue::asDocument)
                    .toList();
            this.pipline.addAll(pipeline_);
        }
    }

    public JsonAggregration createJsonPipeline() {
        return new JsonAggregration();
    }
}
```

Then our pipeline is as simple as

```java
var pipeline = mongo.createJsonPipeline();
pipeline.add("[{ $project: { code: 1, name: 1, role: 1 }}]");
List<Document> results = companies.aggregate(pipeline.get()).into(new ArrayList<>());
```

Instead of

```java
var projections = Arrays.asList(
        Aggregates.project(
                Projections.fields(
                        Projections.include("code"),
                        Projections.include("name"),
                        Projections.include("role")
                ))
);
List<Document> results = companies.aggregate(projections).into(new ArrayList<>());
```
