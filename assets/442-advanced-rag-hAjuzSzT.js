const e=`---
title: "Retrieval Evaluation Metrics: MRR, nDCG, and Recall@K"
date: 2025-12-08
id: blog0442
tag: llm, rag
intro: Study of Advanced Rag Technique
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

### Metrics to Measure Accuracy of RAG

When building RAG (Retrieval Augmented Generation) systems, you need to measure how well your retrieval component is working. These three metrics are the most commonly used:

---

####  MRR (Mean Reciprocal Rank)

##### What it measures
MRR measures **how quickly you find the first relevant result**. It rewards systems that put relevant documents at the top.

##### The Formula

For a single query:

$$
\\texttt{Reciprocal Rank (RR)} = \\frac{1}{\\texttt{position of first relevant document}}
$$

For mes:

$$
\\texttt{MRR} = \\frac{1}{N}\\times \\sum_i \\frac{1}{\\texttt{rank_$i$}}
$$

Where $N$ is the number of queries, and \`rank_i\` is the position of the first relevant result for \`query_i\`.

##### Example

Imagine you search for "Who is Avery?" and get these results:

| Position | Document | Relevant? |
|----------|----------|-----------|
| 1 | Company Overview | ❌ |
| 2 | Product Info | ❌ |
| 3 | **Avery's Profile** | ✅ |
| 4 | Team Page | ❌ |

**Reciprocal Rank = 1/3 = 0.333**

If the relevant document was at position 1:
**Reciprocal Rank = 1/1 = 1.0** (perfect!)

##### Multiple Queries Example

| Query | First Relevant Position | RR |
|-------|------------------------|-----|
| "Who is Avery?" | 3 | 1/3 = 0.333 |
| "What is HomeProtect?" | 1 | 1/1 = 1.000 |
| "Company address?" | 2 | 1/2 = 0.500 |

**MRR = (0.333 + 1.000 + 0.500) / 3 = 0.611**

##### How it's implemented

\`\`\`python
def calculate_mrr(keyword: str, retrieved_docs: list) -> float:
    """Calculate reciprocal rank for a single keyword."""
    keyword_lower = keyword.lower()
    for rank, doc in enumerate(retrieved_docs, start=1):
        if keyword_lower in doc.page_content.lower():
            return 1.0 / rank
    return 0.0  # Keyword not found
\`\`\`

##### Interpretation

| MRR Score | Meaning |
|-----------|---------|
| 1.0 | Perfect - relevant doc always first |
| 0.9+ | Excellent - usually in top 1-2 |
| 0.75+ | Good - usually in top 2-3 |
| 0.5+ | Acceptable - often in top 2-4 |
| < 0.5 | Poor - relevant docs buried |

##### Limitations
- Only considers the **first** relevant result
- Ignores all other relevant documents
- A query with 10 relevant docs but first at position 2 scores the same as one with 1 relevant doc at position 2


####  nDCG (Normalized Discounted Cumulative Gain)

##### What it measures
nDCG measures **the quality of the entire ranking**, not just the first result. It considers:
1. How many relevant documents you retrieved
2. Where they appear in the ranking (higher is better)

##### The Formula

**Step 1: Calculate DCG (Discounted Cumulative Gain)**

$$
\\texttt{DCG@k} = \\sum_{i=1}^k \\frac{\\texttt{relevance}_i}{\\log_2(i+1)}
$$

Where $i$ is the document retrival position and 
$$
\\texttt{relevance}_i\\in \\{0,1\\}
$$
is the relevance score at position $i$, detailed example will be given in [#relavance_example].

The choice of  $\\log_2$ simply ensures the whole summand is a non-negative value, and because it grows slower than $x\\mapsto x$, it provides higher score for later relevant result (less penality).

**Step 2: Calculate IDCG (Ideal DCG)**
The best possible DCG if you ranked all relevant docs at the top.

**Step 3: Calculate nDCG**
\`\`\`text
nDCG@k = DCG@k / IDCG@k
\`\`\`

##### Example (Binary Relevance: 0 or 1) {#relavance_example}

Query: "insurance products"

Your retrieved results:
| Position | Document | Relevant? | Relevance Score |
|----------|----------|-----------|-----------------|
| 1 | Company News | ❌ | 0 |
| 2 | HomeProtect | ✅ | 1 |
| 3 | About Us | ❌ | 0 |
| 4 | AutoInsure | ✅ | 1 |
| 5 | CarePlus | ✅ | 1 |

**Calculate DCG:**
\`\`\`text
DCG = 0/log₂(2) + 1/log₂(3) + 0/log₂(4) + 1/log₂(5) + 1/log₂(6)
    = 0 + 0.631 + 0 + 0.431 + 0.387
    = 1.449
\`\`\`

**Calculate Ideal DCG (if all 3 relevant docs were at top):**
\`\`\`text
IDCG = 1/log₂(2) + 1/log₂(3) + 1/log₂(4)
     = 1.0 + 0.631 + 0.5
     = 2.131
\`\`\`

**nDCG = 1.449 / 2.131 = 0.680**

##### Why the "Discount"?

The logarithmic discount penalizes relevant results that appear lower:

| Position | Discount Factor (1/log₂(i+1)) |
|----------|-------------------------------|
| 1 | 1.000 |
| 2 | 0.631 |
| 3 | 0.500 |
| 4 | 0.431 |
| 5 | 0.387 |
| 10 | 0.289 |

A relevant document at position 1 contributes **1.0** to DCG.  
A relevant document at position 10 contributes only **0.289**.

##### How it's implemented

\`\`\`python
def calculate_dcg(relevances: list[int], k: int) -> float:
    """Calculate Discounted Cumulative Gain."""
    dcg = 0.0
    for i in range(min(k, len(relevances))):
        dcg += relevances[i] / math.log2(i + 2)  # i+2 because rank starts at 1
    return dcg


def calculate_ndcg(keyword: str, retrieved_docs: list, k: int = 10) -> float:
    """Calculate nDCG for a single keyword (binary relevance)."""
    keyword_lower = keyword.lower()

    # Binary relevance: 1 if keyword found, 0 otherwise
    relevances = [
        1 if keyword_lower in doc.page_content.lower() else 0 
        for doc in retrieved_docs[:k]
    ]

    # DCG
    dcg = calculate_dcg(relevances, k)

    # Ideal DCG (best case: all relevant docs at top)
    ideal_relevances = sorted(relevances, reverse=True)
    idcg = calculate_dcg(ideal_relevances, k)

    return dcg / idcg if idcg > 0 else 0.0
\`\`\`

##### Interpretation

| nDCG Score | Meaning |
|------------|---------|
| 1.0 | Perfect ranking |
| 0.9+ | Excellent |
| 0.75+ | Good |
| 0.5+ | Acceptable |
| < 0.5 | Poor - relevant docs ranked too low |

##### Graded Relevance (Advanced)

nDCG also supports graded relevance (not just binary):

| Relevance | Score | Meaning |
|-----------|-------|---------|
| Perfect | 3 | Exactly what the user wanted |
| Highly Relevant | 2 | Very useful |
| Somewhat Relevant | 1 | Partially useful |
| Not Relevant | 0 | Useless |

This gives more nuanced evaluation but requires human annotation.

---

####  Recall@K

##### What it measures
Recall@K measures **what percentage of all relevant documents you retrieved** in the top K results.

##### The Formula

\`\`\`text
Recall@K = (Number of relevant docs in top K) / (Total number of relevant docs)
\`\`\`

##### Example

You have a database with **5 documents about HomeProtect**.

Query: "Tell me about HomeProtect"

Top 10 retrieved results contain **3 HomeProtect documents**.

\`\`\`text
Recall@10 = 3/5 = 0.60 = 60%
\`\`\`

##### Different K values

| Metric | Meaning |
|--------|---------|
| Recall@1 | Did you get at least 1 relevant doc in the top result? |
| Recall@5 | What % of relevant docs are in the top 5? |
| Recall@10 | What % of relevant docs are in the top 10? |
| Recall@100 | What % of relevant docs are in the top 100? |

##### Example across K values

Total relevant documents: 4

| K | Relevant in top K | Recall@K |
|---|-------------------|----------|
| 1 | 1 | 25% |
| 3 | 2 | 50% |
| 5 | 3 | 75% |
| 10 | 4 | 100% |

##### Implementation

\`\`\`python
def calculate_recall_at_k(retrieved_docs: list, relevant_docs: set, k: int) -> float:
    """Calculate Recall@K."""
    retrieved_ids = set(doc.metadata.get('id') for doc in retrieved_docs[:k])
    found = len(retrieved_ids.intersection(relevant_docs))
    return found / len(relevant_docs) if relevant_docs else 0.0
\`\`\`

##### Interpretation

| Recall@K | Meaning |
|----------|---------|
| 100% | Found all relevant documents |
| 75%+ | Good coverage |
| 50%+ | Acceptable |
| < 50% | Missing important information |

##### Trade-off with Precision

Higher K → Higher Recall (find more relevant docs)  
Higher K → Lower Precision (more irrelevant docs too)

---

#### Comparing the Metrics

| Metric | Focus | Question it answers |
|--------|-------|---------------------|
| **MRR** | First relevant result | "How quickly do I find something useful?" |
| **nDCG** | Ranking quality | "Are relevant docs ranked higher than irrelevant ones?" |
| **Recall@K** | Coverage | "Did I find all the relevant information?" |

#### When to use which?

| Use Case | Best Metric |
|----------|-------------|
| Search engine (user wants 1 good result) | MRR |
| RAG system (need complete context) | Recall@K |
| Recommendation system (order matters) | nDCG |
| General retrieval evaluation | All three! |

---

### Practical Example: RAG Evaluation

#### Test Case
\`\`\`python
test = TestQuestion(
    question="What products does InsureLLM offer?",
    keywords=["HomeProtect", "AutoInsure", "CarePlus", "TravelGuard"],
    answer="InsureLLM offers four products: HomeProtect, AutoInsure, CarePlus, and TravelGuard."
)
\`\`\`

#### Retrieved Documents (top 5)
1. Company Overview (mentions "HomeProtect") ✅
2. Team Page (no keywords) ❌
3. AutoInsure Product Page ✅
4. News Article (no keywords) ❌
5. CarePlus Details ✅

#### Calculations

**MRR per keyword:**
- HomeProtect: found at position 1 → RR = 1/1 = 1.0
- AutoInsure: found at position 3 → RR = 1/3 = 0.333
- CarePlus: found at position 5 → RR = 1/5 = 0.2
- TravelGuard: not found → RR = 0

**Average MRR = (1.0 + 0.333 + 0.2 + 0) / 4 = 0.383**

**Recall@5:**
- Found 3 out of 4 keywords
- Recall@5 = 3/4 = 75%

---

### Summary

\`\`\`text
┌─────────────────────────────────────────────────────────────────┐
│  MRR: How fast do you find the FIRST relevant result?           │
│  ────────────────────────────────────────────────────           │
│  Position 1 → Score 1.0                                         │
│  Position 2 → Score 0.5                                         │
│  Position 3 → Score 0.33                                        │
│  Not found  → Score 0.0                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  nDCG: How good is the ENTIRE ranking?                          │
│  ────────────────────────────────────────                       │
│  Relevant docs at top → High score                              │
│  Relevant docs buried → Low score                               │
│  Normalized: 0-1 scale (1 = perfect)                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Recall@K: How many relevant docs did you FIND?                 │
│  ───────────────────────────────────────────────                │
│  Found 3 of 4 relevant → 75% recall                             │
│  Higher K → More coverage but slower                            │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

### References

- [Wikipedia: Mean Reciprocal Rank](https://en.wikipedia.org/wiki/Mean_reciprocal_rank)
- [Wikipedia: Discounted Cumulative Gain](https://en.wikipedia.org/wiki/Discounted_cumulative_gain)
- [RAGAS Evaluation Metrics](https://docs.ragas.io/)
- Ed Donner, [*AI Engineer Core Track: LLM Engineering, RAG, QLoRA, Agents*](https://www.udemy.com/course/llm-engineering-master-ai-and-large-language-models/), Udemy




`;export{e as default};
