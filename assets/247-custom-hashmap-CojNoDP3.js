const n=`---
title: "Custom HashTable by Separate Chaining"
date: 2024-03-15
id: blog0247
tag: go, data-structure
intro: "We implement a simple hashtable by using golang."
toc: true
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Underlying Structs

\`\`\`go
package main

import (
	"fmt"
	"strconv"
)

const ArraySize = 7

type HashTable struct {
	array [ArraySize]*bucket
}

type bucket struct {
	head *bucketNode
}

type bucketNode struct {
	key  string
	next *bucketNode
}
\`\`\`

### Hash Function

\`\`\`go
func hash(key string) int {
	total := 0
	for i := 0; i < len(key); i++ {
		char := key[i]
		code := int(char)
		total += code
	}
	return total % ArraySize
}
\`\`\`

### Method Receivers 

#### Insert 

\`\`\`go
func (h *HashMap) Insert(key string) {
	bucketIndex := hash(key)
	bucket := h.array[bucketIndex]
	bucket.Insert(key)
}

func (b *bucket) Insert(key string) {
	if b.head == nil {
		b.head = &bucketNode{key, nil}
	} else {
		if b.head.key == key {
			// replace new value
		} else {
			newNode := &bucketNode{key, nil}
			newNode.next = b.head
			b.head = newNode
		}
	}
}
\`\`\`

#### search 

\`\`\`go
func (h *HashMap) search(key string) bool {
	bucketIndex := hash(key)
	bucket := h.array[bucketIndex]
	node := bucket.head

	for node != nil {
		if node.key == key {
			return true
		} else {
			node = node.next
		}
	}

	return false
}
\`\`\`
#### delete

\`\`\`go
func (h *HashMap) delete(key string) {
	bucketIndex := hash(key)
	bucket := h.array[bucketIndex]

	if bucket.head == nil {
		return
	}

	if bucket.head.key == key {
		bucket.head = bucket.head.next
	}

	node := bucket.head

	if node.next == nil {
		return
	}

	for node.next != nil {
		if node.next.key == key {
			node.next = node.next.next
		} else {
			node = node.next
		}
	}
}
\`\`\`



### Experiments

#### Init 

\`\`\`go
func Init() *HashMap {
	result := HashMap{}
	for i := 0; i < 7; i++ {
		result.array[i] = &bucket{}
	}
	return &result
}
\`\`\`

#### print 

\`\`\`go
func (h HashMap) print() {
	var results [ArraySize]([]string)
	for i := 0; i < ArraySize; i++ {
		results[i] = make([]string, 0, 100)
	}

	for i := 0; i < ArraySize; i++ {
		bucket := h.array[i]
		node := bucket.head
		for node != nil {
			results[i] = append(results[i], node.key)
			node = node.next
		}
	}

	for i := 0; i < ArraySize; i++ {
		fmt.Printf("%v-th bucket: ", i)
		for j := 0; j < len(results[i]); j++ {
			fmt.Print(results[i][j] + " ")
		}
		fmt.Println()
	}
}
\`\`\`

#### Let's Playaround with it
\`\`\`go
func main() {
	hashTable := Init()
	for i := 0; i < 20; i++ {
		hashTable.Insert("abcd" + strconv.Itoa(i))
	}

	println("Before Deletion")
	hashTable.print()
	hashTable.delete("abcd17")
	hashTable.delete("abcd1")
	hashTable.delete("abcd2")
	hashTable.delete("abcd3")
	hashTable.delete("abcd4")
	hashTable.delete("abcd5")
	hashTable.delete("abcd6")
	hashTable.delete("abcd7")
	hashTable.delete("abcd8")
	hashTable.delete("abcd18")
	hashTable.delete("abcd0")
	hashTable.delete("abcd12")
	hashTable.delete("abcd9")
	println("After Deletion")

	hashTable.print()
}
\`\`\`
Which results in:

\`\`\`text
Before Deletion
0-th bucket: abcd16 abcd6 
1-th bucket: abcd17 abcd10 abcd7 abcd0 
2-th bucket: abcd18 abcd11 abcd8 abcd1 
3-th bucket: abcd19 abcd12 abcd9 abcd2
4-th bucket: abcd13 abcd3
5-th bucket: abcd14 abcd4
6-th bucket: abcd15 abcd5

After Deletion
0-th bucket: abcd16
1-th bucket: abcd10
2-th bucket: abcd11
3-th bucket: abcd19
4-th bucket: abcd13
5-th bucket: abcd14
6-th bucket: abcd15
\`\`\`
`;export{n as default};
