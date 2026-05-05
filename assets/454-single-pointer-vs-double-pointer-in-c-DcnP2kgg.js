const n=`---
title: "Single Pointer vs Double Pointer in C"
date: 2026-02-12
id: blog0454
tag: C
toc: true
intro: "When allocating memory to data, when should we use pointer and when should we use double pointer?"
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


### Core Concept: Pass-by-Value

***Everything in C is passed by value*** - all parameters are copied when passed to functions.

\`\`\`c
void func(int x, float y, struct data_t s, int* ptr) {
    // All parameters are copies of the original values
}
\`\`\`

### Single Pointer (\`type*\`)

#### Purpose
Pass a pointer to existing memory so the function can modify the data at that location.

#### Usage Pattern
\`\`\`c
void init_header(struct db_header_t* header) {
    header->version = 1;           // Modifies existing memory
    header->magic = HEADER_MAGIC;
}

// Caller must provide memory:
struct db_header_t myHeader;       // Stack allocation
init_header(&myHeader);            // Function fills it in
\`\`\`

#### When to Use
- ***Caller allocates memory*** (stack or heap)
- Small, fixed-size data structures
- Short lifetime (function-local scope is fine)
- Performance critical (stack allocation is faster)
- Initializing or modifying existing data
- Examples: configuration structs, temporary buffers

#### Memory Model
\`\`\`text
Stack:
┌──────────────┐
│ myHeader     │ <--- pointer points here
│ (struct)     │      function modifies this
└──────────────┘
\`\`\`

### Double Pointer (\`type**\`)

#### Purpose
Pass the address of a pointer variable so the function can allocate new memory and update the caller's pointer to point to it.

#### Usage Pattern
\`\`\`c
int create_header(struct db_header_t** headerOut) {
    *headerOut = calloc(1, sizeof(struct db_header_t));  // Allocate NEW memory
    (*headerOut)->version = 1;
    return STATUS_SUCCESS;
}

// Caller starts with NULL:
struct db_header_t* myHeader = NULL;    // No memory yet
create_header(&myHeader);               // Function allocates and returns address
// ... use myHeader ...
free(myHeader);                         // Caller must cleanup
\`\`\`

#### When to Use
- ***Function allocates memory*** (on heap)
- Size unknown until runtime
- Data needs to outlive the function call
- Large data structures (avoid stack overflow)
- Building dynamic data structures (linked lists, trees)
- Examples: reading files, database queries, parsing unknown-size data

#### Memory Model
\`\`\`text
Stack:                          Heap:
┌──────────────┐              ┌──────────────┐
│ myHeader     │─────────────>│ struct       │
│ (pointer)    │              │ (allocated)  │
└──────────────┘              └──────────────┘
      ↑                              ↑
   We modify this             Points to this
   (via double pointer)       (persists after function)
\`\`\`

### Why Double Pointer is Necessary

#### This DOESN'T work (single pointer):
\`\`\`c
void create_header(struct db_header_t* headerOut) {
    headerOut = calloc(1, sizeof(struct db_header_t));  // Only modifies LOCAL copy!
}

struct db_header_t* myHeader = NULL;
create_header(myHeader);  // myHeader is STILL NULL!
\`\`\`

The pointer \`headerOut\` is passed by value (copied). Assigning to it only changes the local copy.

#### This WORKS (double pointer):
\`\`\`c
void create_header(struct db_header_t** headerOut) {
    *headerOut = calloc(1, sizeof(struct db_header_t));  // Modifies CALLER's pointer!
}

struct db_header_t* myHeader = NULL;
create_header(&myHeader);  // Pass address of myHeader
// Now myHeader points to allocated memory!
\`\`\`

By passing \`&myHeader\`, we give the function access to modify the original pointer variable.

### Stack vs Heap Memory

#### Stack Memory
\`\`\`c
struct db_header_t header = { 0 };  // On stack
// Automatically destroyed when function returns
\`\`\`

***Cannot return pointer to stack memory*** - it becomes invalid (dangling pointer).

#### Heap Memory
\`\`\`c
struct db_header_t* header = calloc(1, sizeof(struct db_header_t));  // On heap
// Persists until explicitly freed
\`\`\`

***Local pointer variable*** is on stack (destroyed when function returns), but the ***data it points to*** is on heap (persists).

### Comparison Table

| Aspect | Single Pointer | Double Pointer |
|--------|----------------|----------------|
| **Who allocates** | Caller | Function |
| **Parameter type** | \`type* param\` | \`type** param\` |
| **Caller passes** | \`&variable\` | \`&pointer\` |
| **Function modifies** | Data content | Pointer itself |
| **Memory location** | Stack or heap (caller decides) | Heap (function allocates) |
| **Cleanup** | Automatic (if stack) | Manual \`free()\` required |
| **Use case** | Initialize existing data | Create and return new data |

### Complete Examples

#### Single Pointer
\`\`\`c
#include <stdio.h>

void init_config(struct config_t* cfg) {
    cfg->timeout = 30;
    cfg->retries = 3;
}

int main() {
    struct config_t config;      // Stack allocation
    init_config(&config);        // Pass address
    printf("%d\\n", config.timeout);  // Prints: 30
    // Automatic cleanup when main() ends
    return 0;
}
\`\`\`

#### Double Pointer
\`\`\`c
#include <stdio.h>
#include <stdlib.h>

int load_data(const char* filename, int** dataOut, int* countOut) {
    *countOut = 100;  // Determine size at runtime
    *dataOut = calloc(*countOut, sizeof(int));
    if (*dataOut == NULL) return -1;
    
    // Fill data...
    for (int i = 0; i < *countOut; i++) {
        (*dataOut)[i] = i;
    }
    return 0;
}

int main() {
    int* data = NULL;            // Start with NULL
    int count;
    
    if (load_data("file.dat", &data, &count) == 0) {
        printf("Loaded %d items\\n", count);
        // Use data...
        free(data);              // Manual cleanup required!
    }
    return 0;
}
\`\`\`

### Memory Analogy

Think of pointers like addresses written on paper:

- ***Single pointer***: "Here's the address of a house, go paint it red"
  - The house already exists
- We are just modifying it

- ***Double pointer***: "Here's a piece of paper where an address will be written, I'll build a new house and write its address there"
  - The house doesn't exist yet
- Function builds it and tells us where it is

### Common Pitfalls

#### 1. Returning pointer to stack memory
\`\`\`c
struct data_t* bad_function() {
    struct data_t local = { 0 };
    return &local;  // DANGEROUS! 'local' destroyed when function returns
}
\`\`\`

#### 2. Not checking allocation failure
\`\`\`c
int* ptr = calloc(1000, sizeof(int));
ptr[0] = 42;  // CRASH if calloc failed!
\`\`\`

**Always check:**
\`\`\`c
int* ptr = calloc(1000, sizeof(int));
if (ptr == NULL) {
    return ERROR;
}
\`\`\`

#### 3. Forgetting to free heap memory
\`\`\`c
void leak() {
    int* data = malloc(100 * sizeof(int));
    // ... use data ...
    // Forgot to free(data)! MEMORY LEAK
}
\`\`\`

### Key Takeaways

1. ***C only has pass-by-value*** - everything is copied

2. ***Single pointer*** - to modify existing memory
3. ***Double pointer*** - to allocate new memory and return it
4. Choose based on ***who allocates*** the memory
5. ***Stack memory*** is automatic but temporary
6. ***Heap memory*** persists but requires manual cleanup with \`free()\`

`;export{n as default};
