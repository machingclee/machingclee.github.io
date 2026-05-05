const e=`---
title: "RAG Deployment Part 2: Transition from Chroma DB to PostgreSQL"
date: 2025-12-20
id: blog0444
tag: llm, rag, vectordb
intro: Study the transition from chromadb to postgresql
img: /assets/img/2025-12-11-07-56-15.png
scale: 1.4
offsetx: 28
offsety: -9
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>

### Transition from Chroma to PostgreSQL

#### Step 1. Create Remote Database with Target Schema

Setup a PostgreSQL Databse with your own choice of cloud service provider:

\`\`\`py
import psycopg2
from pgvector.psycopg2 import register_vector
import json
from dotenv import load_dotenv
import os

load_dotenv(override=True)

conn = psycopg2.connect(
    host=os.getenv("POSTGRES_HOST"),
    database=os.getenv("POSTGRES_DATABASE"),
    user=os.getenv("POSTGRES_USER"),
    password=os.getenv("POSTGRES_PASSWORD"),
    sslmode="require"  # Neon requires SSL
)

cur = conn.cursor()

try:
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    conn.commit()
    print("Vector extension created successfully")
except Exception as e:
    print(f"Error creating extension: {e}")
    conn.rollback()
    # Check if extension exists
    cur.execute("SELECT * FROM pg_available_extensions WHERE name = 'vector';")
    result = cur.fetchone()
    if result:
        print("Vector extension is available but not installed. Contact Neon support.")
    else:
        print("Vector extension is not available in this database.")
    exit(1)

register_vector(conn)

cur.execute("""
    DROP TABLE IF EXISTS embeddings;
    
    CREATE TABLE embeddings (
        id TEXT PRIMARY KEY,
        content TEXT,
        metadata JSONB,
        embedding vector(1536)
    );
    
    CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
""")
conn.commit()
print("Table created successfully")
\`\`\`




#### Step 2. Migrate from Chroma DB to PostgreSQL DB

\`\`\`py
import psycopg2
from pgvector.psycopg2 import register_vector
import json
from chromadb import PersistentClient
from dotenv import load_dotenv
import os

load_dotenv(override=True)

CHROMA_DB_NAME = "preprocessed_db"
COLLECTION_NAME = "docs"

conn = psycopg2.connect(
    host=os.getenv("POSTGRES_HOST"),
    database=os.getenv("POSTGRES_DATABASE"),
    user=os.getenv("POSTGRES_USER"),
    password=os.getenv("POSTGRES_PASSWORD"),
    sslmode="require"
)
register_vector(conn)


def clean_text(text):
    """Remove null bytes and other problematic characters"""
    if text is None:
        return ""
    return text.replace('\\x00', '')


def migrate_chroma_to_postgres():
    # Load from ChromaDB
    chroma = PersistentClient(path=CHROMA_DB_NAME)
    collection = chroma.get_collection(COLLECTION_NAME)
    result = collection.get(include=['embeddings', 'documents', 'metadatas'])

    # Insert into PostgreSQL
    cur = conn.cursor()

    for i, (doc_id, doc, embedding, metadata) in enumerate(
        zip(result['ids'], result['documents'],
            result['embeddings'], result['metadatas'])
    ):
        # Clean the document text
        cleaned_doc = clean_text(doc)

        # Clean metadata values if they're strings
        cleaned_metadata = {}
        for key, value in metadata.items():
            if isinstance(value, str):
                cleaned_metadata[key] = clean_text(value)
            else:
                cleaned_metadata[key] = value

        try:
            cur.execute(
                """
                INSERT INTO embeddings (id, content, metadata, embedding)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET content = EXCLUDED.content,
                    metadata = EXCLUDED.metadata,
                    embedding = EXCLUDED.embedding
                """,
                (doc_id, cleaned_doc, json.dumps(cleaned_metadata), embedding)
            )
        except Exception as e:
            print(f"Error at document {i} (id: {doc_id}): {e}")
            conn.rollback()
            continue

        if i % 100 == 0:
            conn.commit()
            print(f"Migrated {i} documents...")

    conn.commit()
    print(f"Migration complete! Total documents: {len(result['ids'])}")


# Run migration
migrate_chroma_to_postgres()
\`\`\`

#### Step 3. Inject New Article into PostgreSQL Vector DB

When everything works properly we would like to directly inject the data into the vector db without going though chroma again.

Most of the implmentations are directly coped from:
- [RAG Deployment Part 1: Semantic Chunking, Agentic Rephase and Reranking; Chroma Database](/blog/article/RAG-Deployment-Part-1-Semantic-Chunking-Agentic-Rephase-and-Reranking-Chroma-Database).

\`\`\`py
import psycopg2
from pgvector.psycopg2 import register_vector
from dotenv import load_dotenv
import os
from openai import AzureOpenAI
from litellm import completion
from pydantic import BaseModel, Field
import frontmatter
import re
import time
import json
from typing import TypedDict
from tqdm import tqdm

load_dotenv(override=True)

# Set environment variables for litellm
os.environ["AZURE_API_KEY"] = os.getenv("AZURE_OPENAI_API_KEY")
os.environ["AZURE_API_BASE"] = os.getenv("AZURE_OPENAI_ENDPOINT")
os.environ["AZURE_API_VERSION"] = os.getenv("AZURE_API_VERSION")


class CustomDocument(TypedDict):
    tags: str
    title: str
    text: str


class Result(BaseModel):
    page_content: str
    metadata: dict


class Chunk(BaseModel):
    headline: str = Field(
        description="A brief heading for this chunk, typically a few words, that is most likely to be surfaced in a query. This headline must be in English")
    summary: str = Field(
        description="A few sentences summarizing the content of this chunk to answer common questions, this summary must be in English")
    original_text: str = Field(
        description="The original text of this chunk from the provided document, exactly as is, not changed in any way")

    def as_result(self, document):
        metadata = {"title": document["title"], "tags": document["tags"]}
        return Result(page_content=self.headline + "\\n\\n" + self.summary + "\\n\\n" + self.original_text, metadata=metadata)


class Chunks(BaseModel):
    chunks: list[Chunk]


class ArticleInjector:
    """Inject new articles into PostgreSQL vector database"""

    def __init__(self, average_chunk_size: int = 2500):
        # PostgreSQL connection
        self.conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST"),
            database=os.getenv("POSTGRES_DATABASE"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            sslmode="require"
        )
        register_vector(self.conn)

        # Azure OpenAI setup
        self.client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_API_VERSION"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
        )

        self.embedding_model = "text-embedding-ada-002"
        self.model = f"azure/{os.getenv('AZURE_OPENAI_MODEL')}"
        self.average_chunk_size = average_chunk_size

    def get_tags_and_title_from_blogpost(self, filepath: str) -> tuple[str, str]:
        try:
            blog_post = frontmatter.load(filepath)
        except Exception as e:
            print(f"Error loading {filepath}: {e}")
            raise

        tags = blog_post.get("tag", "")
        title = blog_post.get("title", "")

        if isinstance(tags, list):
            tags = ",".join(sorted(tags))
        elif isinstance(tags, str) and "," in tags:
            tags = ",".join(sorted([t.strip() for t in tags.split(",")]))
        return tags, title

    def load_document(self, filepath: str) -> CustomDocument:
        """Load a single markdown file and return as CustomDocument"""
        blog_post = frontmatter.load(filepath)
        tags, title = self.get_tags_and_title_from_blogpost(filepath)

        # Get content without frontmatter
        text = blog_post.content

        # Remove <style>...</style> blocks (including multiline)
        text = re.sub(r'<style[^>]*>.*?</style>', '',
                      text, flags=re.DOTALL | re.IGNORECASE)

        # Clean up extra whitespace
        text = text.strip()

        return CustomDocument(tags=tags, title=title, text=text)

    def make_user_prompt(self, document: CustomDocument):
        how_many = (len(document["text"]) // self.average_chunk_size) + 1
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

    def process_document(self, document: CustomDocument) -> list[Result]:
        """Process document into chunks using LLM"""
        messages = [
            {"role": "user", "content": self.make_user_prompt(document)}]
        response = completion(
            model=self.model, messages=messages, response_format=Chunks)
        reply = response.choices[0].message.content
        doc_as_chunks = Chunks.model_validate_json(reply).chunks
        return [chunk.as_result(document) for chunk in doc_as_chunks]

    def create_embeddings_batched(self, texts: list[str], batch_size: int = 50) -> list[list[float]]:
        """Create embeddings in batches to avoid rate limits"""
        all_embeddings = []

        for i in tqdm(range(0, len(texts), batch_size), desc="Creating embeddings"):
            batch = texts[i:i + batch_size]

            try:
                response = self.client.embeddings.create(
                    model=self.embedding_model,
                    input=batch
                )
                all_embeddings.extend([e.embedding for e in response.data])
            except Exception as e:
                if "rate limit" in str(e).lower():
                    print(f"Rate limit hit, waiting 60 seconds...")
                    time.sleep(60)
                    # Retry the same batch
                    response = self.client.embeddings.create(
                        model=self.embedding_model,
                        input=batch
                    )
                    all_embeddings.extend([e.embedding for e in response.data])
                else:
                    raise

            # Add delay between batches to avoid rate limits
            if i + batch_size < len(texts):
                time.sleep(2)

        return all_embeddings

    def clean_text(self, text):
        """Remove null bytes and other problematic characters"""
        if text is None:
            return ""
        return text.replace('\\x00', '')

    def get_next_id(self) -> int:
        """Get the next available ID from PostgreSQL"""
        cur = self.conn.cursor()
        cur.execute(
            "SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 FROM embeddings WHERE id ~ '^[0-9]+$'")
        next_id = cur.fetchone()[0]
        return next_id

    def inject_article(self, filepath: str):
        """
        Load a markdown article, chunk it, create embeddings, and insert into PostgreSQL

        Args:
            filepath: Absolute path to the markdown file
        """
        print(f"Loading article from: {filepath}")

        # Load document
        document = self.load_document(filepath)
        print(f"Title: {document['title']}")
        print(f"Tags: {document['tags']}")

        # Process into chunks
        print("Processing document into chunks...")
        chunks = self.process_document(document)
        print(f"Created {len(chunks)} chunks")

        # Create embeddings
        texts = [chunk.page_content for chunk in chunks]
        vectors = self.create_embeddings_batched(texts, batch_size=50)

        # Get starting ID
        start_id = self.get_next_id()
        print(f"Starting ID: {start_id}")

        # Insert into PostgreSQL
        cur = self.conn.cursor()

        for i, (chunk, embedding) in enumerate(zip(chunks, vectors)):
            doc_id = str(start_id + i)
            cleaned_doc = self.clean_text(chunk.page_content)

            # Clean metadata values if they're strings
            cleaned_metadata = {}
            for key, value in chunk.metadata.items():
                if isinstance(value, str):
                    cleaned_metadata[key] = self.clean_text(value)
                else:
                    cleaned_metadata[key] = value

            try:
                cur.execute(
                    """
                    INSERT INTO embeddings (id, content, metadata, embedding)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE
                    SET content = EXCLUDED.content,
                        metadata = EXCLUDED.metadata,
                        embedding = EXCLUDED.embedding
                    """,
                    (doc_id, cleaned_doc, json.dumps(cleaned_metadata), embedding)
                )
            except Exception as e:
                print(f"Error inserting chunk {i} (id: {doc_id}): {e}")
                self.conn.rollback()
                continue

        self.conn.commit()
        print(f"Successfully injected {len(chunks)} chunks into PostgreSQL")

        # Verify
        cur.execute("SELECT COUNT(*) FROM embeddings")
        total = cur.fetchone()[0]
        print(f"Total documents in database: {total}")

    def close(self):
        """Close database connection"""
        self.conn.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: uv run step3_inject_new_article.py <path_to_markdown_file>")
        sys.exit(1)

    filepath = sys.argv[1]

    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        sys.exit(1)

    injector = ArticleInjector(average_chunk_size=2500)

    try:
        injector.inject_article(filepath)
    finally:
        injector.close()
\`\`\`

#### Step 4. Wrap our Agentic Solution into a Class

\`\`\`py
import psycopg2
from pgvector.psycopg2 import register_vector
from dotenv import load_dotenv
import os
from openai import AzureOpenAI
from pydantic import BaseModel, Field

load_dotenv(override=True)


class Result(BaseModel):
    page_content: str
    metadata: dict


class RankOrder(BaseModel):
    order: list[int] = Field(
        description="The order of relevance of chunks, from most relevant to least relevant, by chunk id number"
    )


class RAGQuestionAnswerer:
    """RAG system for answering questions using PostgreSQL vector store"""

    def __init__(self, retrieval_k: int = 10):
        # PostgreSQL connection
        self.conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST"),
            database=os.getenv("POSTGRES_DATABASE"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD"),
            sslmode="require"
        )
        register_vector(self.conn)

        # Azure OpenAI setup
        self.client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_API_VERSION"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
        )

        self.embedding_model = "text-embedding-ada-002"
        self.model = os.getenv('AZURE_OPENAI_MODEL')
        self.retrieval_k = retrieval_k

    def create_embeddings(self, batch_of_texts: list[str]) -> list[list[float]]:
        response = self.client.embeddings.create(
            model=self.embedding_model,
            input=batch_of_texts
        )
        return [e.embedding for e in response.data]

    def fetch_context_unranked(self, question: str) -> list[Result]:
        """Query PostgreSQL for relevant chunks"""
        # Get query embedding
        query_embedding = self.create_embeddings([question])[0]

        # Query PostgreSQL
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT id, content, metadata,
                   embedding <=> %s::vector AS distance
            FROM embeddings
            ORDER BY distance
            LIMIT %s
            """,
            (query_embedding, self.retrieval_k)
        )

        results = cur.fetchall()
        chunks = []
        for row in results:
            chunks.append(Result(
                page_content=row[1],
                metadata=row[2]
            ))

        return chunks

    def rerank(self, question: str, chunks: list[Result]) -> list[Result]:
        """Rerank chunks using LLM"""
        system_prompt = """
You are a document re-ranker.
You are provided with a question and a list of relevant chunks of text from a query of a knowledge base.
The chunks are provided in the order they were retrieved; this should be approximately ordered by relevance, but you may be able to improve on that.
You must rank order the provided chunks by relevance to the question, with the most relevant chunk first.
Reply only with the list of ranked chunk ids, nothing else. Include all the chunk ids you are provided with, reranked.
"""
        user_prompt = f"The user has asked the following question:\\n\\n{question}\\n\\nOrder all the chunks of text by relevance to the question, from most relevant to least relevant. Include all the chunk ids you are provided with, reranked.\\n\\n"
        user_prompt += "Here are the chunks:\\n\\n"
        for index, chunk in enumerate(chunks):
            user_prompt += f"# CHUNK ID: {index + 1}:\\n\\n{chunk.page_content}\\n\\n"
        user_prompt += "Reply only with the list of ranked chunk ids, nothing else."

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = self.client.beta.chat.completions.parse(
            model=self.model,
            messages=messages,
            response_format=RankOrder,
            max_tokens=100  # Short JSON array output
        )
        reply = response.choices[0].message.parsed
        order = reply.order
        print(f"Reranked order: {order}")
        return [chunks[i - 1] for i in order]

    def fetch_reranked_context(self, question: str) -> list[Result]:
        """Fetch and rerank context"""
        chunks = self.fetch_context_unranked(question)
        return self.rerank(question, chunks)

    def rewrite_query(self, question: str, history: list = []) -> str:
        """Rewrite the user's question to be more specific"""
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

Dont mention the name James Lee
"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": sys_message}],
            max_tokens=100  # Short rewritten query
        )
        return response.choices[0].message.content

    def make_rag_messages(self, question: str, history: list, chunks: list[Result]) -> list[dict]:
        """Create messages for RAG"""
        SYSTEM_PROMPT = """
You are a knowledgeable, friendly assistant to search for articles in the blog of James Lee.
You are chatting with a user about finding related articles.
Your answer will be evaluated for accuracy, relevance and completeness, so make sure it only answers the question and fully answers it.
If you don't know the answer, say so.
For context, here are specific extracts from the Knowledge Base that might be directly relevant to the user's question:
{context}

With this context, please answer the user's question. Be accurate, relevant and complete.
"""
        context = "\\n\\n".join(
            f"Extract from article titled '{chunk.metadata['title']}':\\n{chunk.page_content}"
            for chunk in chunks
        )
        system_prompt = SYSTEM_PROMPT.format(context=context)
        return [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": question}]

    def answer_question(self, question: str, history: list[dict] = []) -> tuple[str, list]:
        """
        Answer a question using RAG and PostgreSQL vector store

        Args:
            question: The user's question
            history: Conversation history

        Returns:
            tuple: (answer, retrieved_chunks)
        """
        # Rewrite query for better retrieval
        query = self.rewrite_query(question, history)
        print(f"Rewritten query: {query}")

        # Fetch and rerank context
        chunks = self.fetch_reranked_context(query)

        # Generate answer
        messages = self.make_rag_messages(question, history, chunks)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=800  # Limit answer length for faster responses
        )

        return response.choices[0].message.content, chunks

    def close(self):
        """Close database connection"""
        self.conn.close()


if __name__ == "__main__":
    # Example usage
    rag = RAGQuestionAnswerer(retrieval_k=10)

    try:
        question = "restore database "
        answer, chunks = rag.answer_question(question)

        print("\\n" + "="*80)
        print("QUESTION:", question)
        print("="*80)
        print("\\nANSWER:", answer)
        # print("\\n" + "="*80)
        titles = [chunk.metadata['title'] for chunk in chunks]
        # print(titles)
        # print("="*80)
    finally:
        rag.close()
\`\`\`

### Expose this Service via a Fast-API Endpoint

\`\`\`py
@app.get("/articles")
async def answer(question: str):
    from src.RAGQuestionAnswerer import RAGQuestionAnswerer

    rag = RAGQuestionAnswerer(retrieval_k=10)
    answer, chunks = rag.answer_question(question)

    titles = [chunk.metadata['title'] for chunk in chunks]
    return {"answer": answer, "titles": titles}
\`\`\`

### Quick fix for Data in Jsonb Column

Our agentic solution make use of metadata to route users to different answers. 

Assume that such data are simply "title" or "id" of the related documents, then we can update it arbitrarily in postgresql as follows:

#### Find Articles for Direct Adjustment
\`\`\`SQL
--- find article with target title
SELECT id, metadata->>'title' as current_title
FROM embeddings
WHERE metadata->>'title' ILIKE '%Without Langchain%';
\`\`\`


#### Update Target Articles
\`\`\`SQL
--- update those article
UPDATE embeddings
SET metadata = jsonb_set(
    metadata,
    '{title}',
    '"RAG Deployment Part 1: Semantic Chunking, Agentic Rephase and Reranking; Chroma Database"'
)
WHERE metadata->>'title' ILIKE '%Without Langchain%';
\`\`\``;export{e as default};
