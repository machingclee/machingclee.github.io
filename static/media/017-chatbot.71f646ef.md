---
id: portfolio017
title: "Chatbot with Knowledge based in this Blog"
intro: Study how to create a RAG application using markdown files in this blog as a knowledge base.
thumbnail: /assets/img/2025-12-22-01-10-15.png
tech: RAG, LLM, Agentic Solution
thumbWidth: 1000
thumbTransX: 0
thumbTransY: 0
date: 2025-12-13
---


<style>
    video {
      border-radius: 4px;
      max-width: 660px;
    }
    img{
        margin-top: 10px;
        margin-bottom: 10px;
        max-width: 660px;
    }
    /* Alternative solid color version */
    .download-btn-solid {
      background: #3b82f6;
      border: none;
      border-radius: 8px;
      color: white;
      cursor: pointer;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 16px;
      font-weight: 600;
      padding: 6px 24px;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
      margin-bottom: 20px;
    }

    .download-btn-solid:hover {
      background: #2563eb;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
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








### Introduction

#### Purpose of The Chatbot

This project is to create a chatbot to:

> Search my tech articles *using natural languages* by providing the *content* of the article.

This is due to the following problems when the number of articles is getting big:


<Example>

***Problem 1.***  I forgot the title of the article.

</Example>

<Example>

***Problem 2.***  The fuzzy text search (implemented using [`lunr.js` (click)](/blog/article/Build-a-Search-Function#2.3.2.-lunr.js,-a-much-more-powerful-version-of-fuse.js)) occasionally fails:

![](/assets/img/2025-12-22-01-55-56.png)

</Example>


#### Chatbot Result 
You can chat to my blog explorer which is available at the lower right corner of this webpage:

![](/assets/img/2026-03-20-02-12-47.png)

You can ask any technical question, my chatbot will try to find the most relevant articles for you with a brief summary on how your problem could be solved:

![](/assets/img/2026-03-19-05-05-21.png?width=500px)

And the relevant articles follow:

![](/assets/img/2026-03-22-18-15-00.png?width=500px)



### Repository for the Answering Agent

Python backend for the agent of blog explorer:


- https://github.com/machingclee/2026-03-19-RAG-personal-blogging/blob/main/app.py

For how I create the embeddings, the underlying idea has been outlined in [#chunking_strategy].


### Tech Stacks


<ragtechstack></ragtechstack>

### Technique Involved



#### Agentic Chunking {#chunking_strategy}

Instead of standard chunking strategy like text overlapping, we let agent to understand the whole document and let it chunk the document into several pieces based on semantic meaning.

Detail:

- [`make_user_prompt` and `make_user_messages`](/blog/article/RAG-Deployment-Part-1-Semantic-Chunking-Agentic-Rephase-and-Reranking-Chroma-Database#3.1.-make_user_prompt-and-make_user_messages)


```py
def make_user_prompt(document: CustomDocument):
    how_many = (len(document["text"]) // AVERAGE_CHUNK_SIZE) + 1
    return f"""
        You take a document and you split the document into overlapping chunks for a KnowledgeBase.

        The document is from the articles from Blog of James Lee.
        The document is of tags: {document["tags"]}
        The document has title: {document["title"]}

        A chatbot will use these chunks to answer questions about the articles and retrieve a related list of articles for the reader.
        You should divide up the document as you see fit, being sure that the entire document is returned in the chunks - don't leave anything out.
        This document should probably be split into {how_many} chunks, but you can have more or less as appropriate.
        There should be overlap between the chunks as appropriate; typically about 25% overlap or about 50 words, so you have the same text in multiple chunks for best retrieval results.

        For each chunk, you should provide a headline, a summary, and the original text of the chunk.
        Together your chunks should represent the entire document with overlap.

        Here is the document:

        {document["text"]}

        Respond with the chunks.
    """
```


#### Agentic Question Rephasing

Instead of putting questions into our RAG system directly, we use an agent to rephase the question appropriately as a pre-processing of the question:

- [Prompts to Answer Question with Agentic Reranking](/blog/article/RAG-Deployment-Part-1-Semantic-Chunking-Agentic-Rephase-and-Reranking-Chroma-Database#6.-prompts-to-answer-question-with-agentic-reranking)

```py
def rewrite_query(question, history=[]):
    """Rewrite the user's question to be a more specific question that is more likely to surface relevant content in the Knowledge Base."""

    sys_message = f"""
        You are in a conversation with a user, answering questions about the articles from the blog of James Lee.
        You are about to look up information in a Knowledge Base to answer the user's question.

        This is the history of your conversation so far with the user:
        {history}

        And this is the user's current question:
        {question}

        Respond only with a single, refined question that you will use to search the Knowledge Base.
        It should be a VERY short specific question most likely to surface content. Focus on the question details.
        IMPORTANT: Respond ONLY with the knowledgebase query, nothing else.
    """
    response = completion(model=MODEL, messages=[
                          {"role": "system", "content": sys_message}])
    return response.choices[0].message.content
```



#### Agentic Results Reranking with Structured Output

Since vector search results are sorted based on simularities, they are somehow related but may not be semantically relevant to our question based on the similarity scores.

We use an agent to rerank the results according to the question and the contents of the vector search results:

- [rerank](/blog/article/RAG-Deployment-Part-1-Semantic-Chunking-Agentic-Rephase-and-Reranking-Chroma-Database#5.2.-rerank)


```py
class RankOrder(BaseModel):
    order: list[int] = Field(
        description="The order of relevance of chunks, from most relevant to least relevant, by chunk id number"
    )

def rerank(question, chunks):
    system_prompt = """
You are a document re-ranker.
You are provided with a question and a list of relevant chunks of text from a query of a knowledge base.
The chunks are provided in the order they were retrieved; this should be approximately ordered by relevance, but you may be able to improve on that.
You must rank order the provided chunks by relevance to the question, with the most relevant chunk first.
Reply only with the list of ranked chunk ids, nothing else. Include all the chunk ids you are provided with, reranked.
"""
    user_prompt = f"The user has asked the following question:\n\n{question}\n\nOrder all the chunks of text by relevance to the question, from most relevant to least relevant. Include all the chunk ids you are provided with, reranked.\n\n"
    user_prompt += "Here are the chunks:\n\n"
    for index, chunk in enumerate(chunks):
        user_prompt += f"# CHUNK ID: {index + 1}:\n\n{chunk.page_content}\n\n"
    user_prompt += "Reply only with the list of ranked chunk ids, nothing else."
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    response = completion(model=MODEL, messages=messages,
                          response_format=RankOrder)
    reply = response.choices[0].message.content
    order = RankOrder.model_validate_json(reply).order
    print(order)
    return [chunks[i - 1] for i in order]
```

### Answering Strategy for Higher Accuracy

#### Stage 1: Find Suitable Tags

I have provided a constant tag list `TAGS` to the system prompt:

```py
def find_tag_by_question(self, question: str) -> str:
    """Find the most relevant tag for a question"""
    system_prompt = f"""You are a tag finder for a blog about programming and technology.
        You are given a question from a user:
        {question}
        and you must respond with the most relevant tags, up to 5 tags, from the following list of tags: {TAGS}

        Your answer should be in the following format: tag1,tag2,tag3,..., all relevant tags, separated by commas, 
        with no spaces. If no tags are relevant, respond with "untagged".
        """

    response = self.client.chat.completions.create(
        model=self.model,
        messages=[{"role": "system", "content": system_prompt}],
        max_tokens=300
    )

    return response.choices[0].message.content
```

Now based on the question and the constant `TAGS` I have provided, the agent can select scopes (tags) for the upcoming RAG process.

#### Stage 2: Find the Answer from Scoped Articles 

##### Problem: Semantic Noise
Cosine similarity is not perfect. Since our embedding model is general-purpose, the resulting vector is inevitably capturing broad semantic similarity, resulting in ***semantic noise*** in our query. 

Without correct scope (domain boundary), the result of highest score does not mean the best answer to our question.

To ***get rid of the noise***, we provide scope (`tags: list[str]`) in our upcoming implementation:



##### Python Code Implementation

- https://github.com/machingclee/2026-03-19-RAG-personal-blogging/blob/main/src/RAGQuestionAnswerer.py#L205

##### SQL Query Involved

Since each of my articles has been carefully tagged, to shrink the scope of vector search in order to achieve better results I have made the following query in our PostgreSQL:

```py-1{7}
cur.execute(
    """
    SELECT * FROM (
        SELECT DISTINCT ON (metadata->>'title') id, content, metadata,
                embedding <=> %s::vector AS distance
        FROM embeddings
        WHERE string_to_array(metadata->>'tags', ',') && %s::text[]
        ORDER BY metadata->>'title', distance
    ) sub
    ORDER BY distance
    LIMIT %s
    """,
    (query_embedding, tags, self.retrieval_k)
)
```

Let's explain line 7:

- `string_to_array(metadata->>'tags', ',')` resolves into a ***text array***;

  <item bar>
  
  **Detail.** `metadata->>'tags'` is `'tag1,tag2,tag3'`.

  </item>

- `%s::text[]` resolves into **`ARRAY['tag1', 'tag2', 'tag3']::text[]`**;

  <item bar>
  
  **Detail.** Our query paramter `tags` is of type `list[str]`, `cur.execute` from `psycopg2` converts it into `ARRAY[...]` 
  </item>
  
- `SELECT array1 && array2` returns whether there is intersection, for example:

  ![](/assets/img/2026-03-22-00-53-57.png)

We have thereby obtained chunked articles whose tag is ***within the target scope*** before computing any "distances" (cosine similarities). 


##### Caveat and Solution

Scoped vector search has enourmously enhanced the accuracy but it sacrifices the diversity of how agent can answer the question. 

For exmaple, I have an article on f1-score in computer vision and this score is actually an harmonic mean. ***In the past*** if I search harmonic mean, the f1-score gets related.

But if I now search for harmonic mean, it will simply find the results related to mathematics as it is hard to relate this "harmonic mean" to computer vision.


There should be ***knowledge graph*** on how one word could be related to multiple words in a specific domain (like apple should be related to computer in digital products world), in such a way we can enlarge the scope appropriately to include more answers. 

For example, I could make:

```py
# expand ["harmonic-mean"] → ["harmonic-mean", "f1-score", "ml-metrics"]
expanded = expand_tags(tags)
```

and then search using this expanded list of tags.

#### Analysis: How does my Approach let user Evaluate the Result Correctly?
##### First Attempt

Suppose I ask the following question about an attribute of an annotation in spring boot:

```text
any article about insertable = true
```

![](/assets/img/2026-03-19-21-41-38.png)

By examinating

1. The ***rephased*** question;
2. The ***categories (tags)*** of answers that our system tries to narrow down;


We can observe our agent ***cannot relate*** the question to anything about spring boot.


##### Easy Refinement

Now if I adjust my question to

```text
any article about insertable = true in spring
```

Then I got my target articles in a correct scope:

![](/assets/img/2026-03-19-21-43-21.png)



### Deployment 

The backend for the agentic solution is simply a `fast-api` application with endpoints using  `openai` package. 

The application is bundled into a zip file and deployed onto AWS:

![](/assets/img/2025-12-22-02-02-37.png)





### Known Issue: No Memory




In this chatbot for each question there is no memory to the previous conversation.

I am already aware of the solution to this memory issue using `langgraph` and `checkpointer`, a detailed study has been recorded in the following:

- [Langgraph checkpointer using PostgreSQL](/blog/article/MCP-Course-Week-4-LangGraph#3.6.1.2.-postgresql)


However, ***answering technical questions*** based on the knowledge is not the main purpose of the chatbot, memory persistence will not be implemented.

### References



- VeloDB (Powered by Apache Doris), [*Vector search is great for RAG, recommendations, ...*](https://www.linkedin.com/posts/velodb_vectorsearch-apachedoris-bytedance-activity-7430555570769666048-KDaE/?utm_medium=ios_app&rcm=ACoAACC2BCUBnrXcwrUnHWUo2uKfHmNCo8LL7CA&utm_source=social_share_send&utm_campaign=copy_link), Linkedin

- CCLee, [*RAG Deployment Part 1: Semantic Chunking, Agentic Rephase and Reranking; Chroma Database*](/blog/article/RAG-Deployment-Part-1-Semantic-Chunking-Agentic-Rephase-and-Reranking-Chroma-Database), This Blog

- CCLee, [*RAG Deployment Part 2: Transition from Chroma DB to PostgreSQL*](/blog/article/RAG-Deployment-Part-2-Transition-from-Chroma-DB-to-PostgreSQL), This Blog


- CCLee, [*MCP Course Week 2: Agents, Tools, Handoff and Guardrails*](/blog/article/MCP-Course-Week-2-Agents-Tools-Handoff-and-Guardrails), This Blog

- CCLee, [*MCP Course Week 4: LangGraph*](/blog/article/MCP-Course-Week-4-LangGraph), This Blog

