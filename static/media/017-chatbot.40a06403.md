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




### Result

You can already play with the chatbot which is available at the lower right corner:


![](/assets/img/2025-12-22-01-15-14.png)



### Tech Stacks


<ragtechstack></ragtechstack>

### Technique Involved


#### Semantic Chunking

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


### Deployment 

The backend for the agentic solution is simply a `fast-api` application with endpoints using  `openai` package. 

The application is bundled into a zip file and deployed onto AWS:

![](/assets/img/2025-12-22-02-02-37.png)






### Known Limitation (No Memory)


The main purpose of the chatbot is to search my tech articles using natural language in case the fuzzy text search is not enough:

![](/assets/img/2025-12-22-01-55-56.png)

In this stage for each question there is no memory to the previous conversation.

I am already aware of the solution to this memory issue using `langgraph` and `checkpointer`, a detailed study has been recorded in the following:

- [Langgraph checkpointer using PostgreSQL](/blog/article/MCP-Course-Week-4-LangGraph#3.6.1.2.-postgresql)


However, ***answering technical questions*** based on the knowledge is not the main purpose of the chatbot, memory persistence will not be implemented.

### References


- [CCLee, *RAG Deployment Part 1: Semantic Chunking, Agentic Rephase and Reranking; Chroma Database*, This Blog](/blog/article/RAG-Deployment-Part-1-Semantic-Chunking-Agentic-Rephase-and-Reranking-Chroma-Database)

- [CCLee, *RAG Deployment Part 2: Transition from Chroma DB to PostgreSQL*, This Blog](/blog/article/RAG-Deployment-Part-2-Transition-from-Chroma-DB-to-PostgreSQL)


- [CCLee, *MCP Course Week 2: Agents, Tools, Handoff and Guardrails*, This Blog](/blog/article/MCP-Course-Week-2-Agents-Tools-Handoff-and-Guardrails)

- [CCLee, *MCP Course Week 4: LangGraph*, This Blog](/blog/article/MCP-Course-Week-4-LangGraph)