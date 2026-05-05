const n=`---
title: "RAG Study Using Markdown Articles in this Blog"
date: 2025-12-06
id: blog0441
tag: llm, rag
toc: true
intro: Study of RAG
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

### Result 

![](/assets/img/2025-12-07-11-26-04.png)


### Dependencies via \`pyproject.toml\`

We first \`uv init\` to generate \`pyproject.toml\` and \`.python-version\` separately. 

Next inside \`.python-version\` we write \`3.12.8\` and in \`pyproject.toml\` we fill in the depenendencies.

**Remark.** I didn't minimize this bulky list as I learned it from some other RAG course, but \`uv\` is already insanely fast so it doesn't quite matter.

\`\`\`toml
[project]
name = "app"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = "==3.12.8"
dependencies = [
    "anthropic>=0.69.0",
    "beautifulsoup4>=4.14.2",
    "chromadb>=1.1.0",
    "datasets==3.6.0",
    "feedparser>=6.0.12",
    "google-genai>=1.41.0",
    "google-generativeai>=0.8.5",
    "gradio>=5.47.2",
    "ipykernel>=6.30.1",
    "ipywidgets>=8.1.7",
    "jupyter-dash>=0.4.2",
    "langchain>=0.3.27",
    "langchain-chroma>=0.2.6",
    "langchain-community>=0.3.30",
    "langchain-core>=0.3.76",
    "langchain-openai>=0.3.33",
    "langchain-text-splitters>=0.3.11",
    "litellm>=1.77.5",
    "matplotlib>=3.10.6",
    "nbformat>=5.10.4",
    "modal>=1.1.4",
    "numpy>=2.3.3",
    "ollama>=0.6.0",
    "openai>=1.109.1",
    "pandas>=2.3.3",
    "plotly>=6.3.0",
    "protobuf==3.20.2",
    "psutil>=7.1.0",
    "pydub>=0.25.1",
    "python-dotenv>=1.1.1",
    "requests>=2.32.5",
    "scikit-learn>=1.7.2",
    "scipy>=1.16.2",
    "sentence-transformers>=5.1.1",
    "setuptools>=80.9.0",
    "speedtest-cli>=2.1.3",
    "tiktoken>=0.11.0",
    "torch>=2.8.0",
    "tqdm>=4.67.1",
    "transformers>=4.56.2",
    "wandb>=0.22.1",
    "langchain-huggingface>=1.0.0",
    "langchain-ollama>=1.0.0",
    "langchain-anthropic>=1.0.1",
    "langchain-experimental>=0.0.42",
    "groq>=0.33.0",
    "xgboost>=3.1.1",
    "python-frontmatter>=1.1.0",
]
\`\`\`

### RAG Implementation

#### Import

\`\`\`py
import os
import glob
import tiktoken
import numpy as np
from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import AzureChatOpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sklearn.manifold import TSNE
import plotly.graph_objects as go

MODEL = os.getenv("AZURE_OPENAI_MODEL")
DB_NAME = "vector_db"
load_dotenv(override=True)
\`\`\`
#### Define \`AzureOpenAI\` Object

\`\`\`py
from openai import AzureOpenAI

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2025-01-01-preview",
    azure_endpoint="https://shellscriptmanager.openai.azure.com"
)
\`\`\`

#### Get all \`md\` Files and Tokenize It

![](/assets/img/2025-12-07-12-33-25.png)

According to this folder structure:

\`\`\`py
knowledge_base_path = "../src/mds/articles/**/*.md"
files = glob.glob(knowledge_base_path, recursive=True)
print(f"Found {len(files)} files in the knowledge base")

entire_knowledge_base = ""

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        entire_knowledge_base += f.read()
        entire_knowledge_base += "\\n\\n"


encoding = tiktoken.encoding_for_model(MODEL)
tokens = encoding.encode(entire_knowledge_base)
token_count = len(tokens)
print(f"Total tokens for {MODEL}: {token_count:,}")
\`\`\`

\`\`\`text
Found 411 files in the knowledge base
Total tokens for gpt-4.1-mini: 722,623
Total tokens for gpt-4.1-mini: 722,623
\`\`\`

#### Get \`metadata\` from \`md\` Files and Create \`Document\` list 
\`\`\`py
import frontmatter
from langchain_core.documents import Document


def load_md_with_frontmatter(filepath):
    import frontmatter
    from langchain_core.documents import Document

    try:
        post = frontmatter.load(filepath)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        raise

    tags = post.get("tag", "")
    if isinstance(tags, list):
        tags = ",".join(sorted(tags))
    elif isinstance(tags, str) and "," in tags:
        tags = ",".join(sorted([t.strip() for t in tags.split(",")]))

    return Document(
        page_content=post.content,
        metadata={
            "title": post.get("title", ""),
            "date": str(post.get("date", "")),
            "tags": tags,  # Now a string: "db-backup,postgresql,sql"
            "id": post.get("id", ""),
            "source": filepath
        }
    )


# Load all your markdown files
documents = []
for filepath in glob.glob(knowledge_base_path, recursive=True):
    try:
        documents.append(load_md_with_frontmatter(filepath))
    except Exception as e:
        print(f"Skipping {filepath} due to error: {e}")
\`\`\`

#### Split the Texts with Overlap

\`\`\`py
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000, chunk_overlap=200)
chunks = text_splitter.split_documents(documents)

print(f"Divided into {len(chunks)} chunks")
\`\`\`

\`\`\`text
Divided into 3667 chunks
\`\`\`

#### Embed Documents into Vector DB \`Chroma\`


\`\`\`py
db_name = "vector_db"

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
# embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

if os.path.exists(db_name):
    Chroma(persist_directory=db_name,
           embedding_function=embeddings).delete_collection()

vectorstore = Chroma.from_documents(
    documents=chunks, embedding=embeddings, persist_directory=db_name)
print(f"Vectorstore created with {vectorstore._collection.count()} documents")
\`\`\`

\`\`\`text
Vectorstore created with 3667 documents
\`\`\`


![](/assets/img/2025-12-07-12-44-54.png?width=400px)

#### Create RAG \`Retriever\` and \`Agent\`

\`\`\`py
retriever = vectorstore.as_retriever()
llm = AzureChatOpenAI(
    temperature=0,
    azure_deployment=os.getenv("AZURE_OPENAI_MODEL"),  # Your deployment name
    azure_endpoint="https://shellscriptmanager.openai.azure.com",
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2025-01-01-preview"
)
\`\`\`

#### Define a Chat \`Agent\` Without any \`Checkpointer\` and \`history\`

\`\`\`py
SYSTEM_PROMPT_TEMPLATE = """
You are a knowledgeable, friendly assistant representing the blog author James Lee.
You are chatting with a user about articles in the blog.
If relevant, use the given context to answer any question.
If you don't know the answer, say so.
Please list all the related articles and a very brief summary in no more than 30 words in bullet points.
Context:
{context}
"""

def format_docs_with_metadata(docs):
    formatted = []
    for i, doc in enumerate(docs, 1):
        title = doc.metadata.get("title", "Unknown")
        source = doc.metadata.get("source", "Unknown")
        date = doc.metadata.get("date", "")

        formatted.append(
            f"[Document {i}]\\n"
            f"Title: {title}\\n"
            f"Source: {source}\\n"
            f"Date: {date}\\n"
            f"Content:\\n{doc.page_content}"
        )
    return "\\n\\n===\\n\\n".join(formatted)

def answer_question(question: str, history):
    docs = retriever.invoke(question)
    context = format_docs_with_metadata(docs)
    print(context)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context)
    response = llm.invoke(
        [SystemMessage(content=system_prompt), HumanMessage(content=question)])
    return response.content
\`\`\`

#### Run a Chat UI via \`gradio\`

\`\`\`py
gr.ChatInterface(answer_question).launch()
\`\`\`

Which results in the chatbot that we displayed at the beginning:


![](/assets/img/2025-12-07-11-26-04.png)`;export{n as default};
