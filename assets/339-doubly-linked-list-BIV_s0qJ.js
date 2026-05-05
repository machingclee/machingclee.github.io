const n=`---
title: "Doubly-Linked List in Typescript"
date: 2024-11-08
id: blog0339
tag: data-structure
toc: false
intro: "We implement a doubly-linked list with generic data type that is useful when trying to group a set of \\"directional\\" objects."
---

<style>
  img {
    max-width: 660px;
  }
</style>


\`\`\`js
class Node<T> {
    value: T;
    next: Node<T> | null = null;
    prev: Node<T> | null = null;

    constructor(value: T) {
        this.value = value;
    }

    appendRight(newNode: Node<T>): void {
        newNode.prev = this;
        newNode.next = this.next;
        if (this.next) {
            this.next.prev = newNode;
        }
        this.next = newNode;
    }

    appendLeft(newNode: Node<T>): void {
        newNode.next = this;
        newNode.prev = this.prev;
        if (this.prev) {
            this.prev.next = newNode;
        }
        this.prev = newNode;
    }

    traverse(): Node<T>[] {
        const head = this.getHead();
        const nodes: Node<T>[] = [];
        let current: Node<T> | null = head;

        while (current) {
            nodes.push(current);
            current = current.next;
        }

        return nodes;
    }

    getHead(): Node<T> {
        let current: Node<T> = this;

        while (current.prev) {
            current = current.prev;
        }

        return current;
    }
}
\`\`\``;export{n as default};
