const n=`---
title: Exercises on Algorithms
date: 2021-07-26
id: blog0010
tag: algorithm
intro: A note to solved problems and calculate the related time complexities.
---

### Exercises

#### Exercise 1 ($\\bf{h}$-index)

> **Problem.** If a scholar has at least $h$ of their papers cited $h$ times, then the $h$-index of a scholar is defined to be $h$. Find $h$.

\`\`\`python
# Algorithm:
def hIndex(citations):
  result = 0
  length = len(citations)
  n_cites = [0] * (length+1)

  for c in citations:
    c_ = min(c, length)
    n_cites[c_] += 1

  total = 0
  for i in range(length, -1, -1):
    total += n_cites[i]
    if total == i:
      result = total
      break

return result
\`\`\`

**Complexities.**

- **Time.** The loop \`for c in citations\` takes $O(n)$ operations and the loop \`for i in range(length, -1, -1)\` also takes $O(n)$ operations, the algorithm in total has time complexity $O(n)$.
- **Space.** The space complexity is $O(n)$ as well since we have constructed a new array \`n_cites\`.

---

#### Exercise 2 (Trie)

This exercise presents us a well-known sequential data structure called **Trie**. It is beneficial for us to see it at least once to get motivated for tackling the next similar problems.

> **Problem.** Given a list of words, for each word find the shortest unique prefix. You can assume a word will not be a substring of another word (i.e., play and playing won't be in the same words list).

Example:

- \`Input: ['james', 'john', 'jack', 'techlead']\`
- \`Ouput: ['jam', 'jo','jac', 't']\`

We tackle it by defining our node by:

\`\`\`python
# each children is identified/pointed by a character
class Node:
  def __init__(self, char):
    self.count = 0
    self.char = char
    self.children = {}
\`\`\`

\`\`\`python
class Trie:
  def __init__(self):
    self.root = Node("")

  def insert(self, word):
    curr_node = self.root
    for c in word:
      if c not in curr_node.children:
        curr_node.children[c] = Node(c)
      curr_node = curr_node.children[c]
      curr_node.count += 1

  def unique_prefix(self, word):
    curr_node = self.root
    prefix = ""

    for c in word:
      if curr_node.count == 1:
        return prefix
      else:
        curr_node = curr_node.children[c]
        prefix += curr_node.char
    return prefix
\`\`\`

Finally we define

\`\`\`python
def shortest_unique_prefix(words):
  trie = Trie()

  for word in words:
    trie.insert(word)

  unique_prefix = []
  for word in words:
    unique_prefix.append(trie.unique_prefix(word))

  return unique_prefix
\`\`\`

and

\`\`\`python
words = ['james', 'john', 'jack', 'techlead']
shortest_unique_prefix(words)
\`\`\`

gives \`['jam', 'jo', 'jac', 't']\`.

**Complexities.**
Denote $\\ell$ the maximum length among all $n$ words, i.e., $\\ell=$ \`max([len(w) for w in words])\`.

- **Time.** For each of $n$ words we spend $O(1)$ operations to go from one node to another, it also takes $O(1)$ operation to check if the current node has \`count == 1\`, so in total our time complexity is $O(n\\ell)$.
- **Space.** In the worst case we insert $n$ distinct words that starts from different characters, therefore the space complexity is $O(n\\ell)$.
`;export{n as default};
