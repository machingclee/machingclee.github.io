const n=`---
title: "Understand \`strtok()\` in C"
date: 2026-02-14
id: blog0456
tag: C
toc: true
intro: "Study \`strtok\` for delimited string"
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



### What is \`strtok\`?

\`strtok\` (string tokenize) is a C standard library function that **splits a string into tokens** based on delimiter characters.

\`\`\`c
#include <string.h>
char *strtok(char *str, const char *delim);
\`\`\`

**Parameters:**
- \`str\` - String to tokenize (first call) or \`NULL\` (subsequent calls)
- \`delim\` - String containing delimiter characters

**Returns:**
- Pointer to the next token
- \`NULL\` when no more tokens are found

### Key Characteristic: Stateful Behavior

\`strtok\` is **stateful** - it remembers its position between calls using an internal static variable. This is why we use \`NULL\` in subsequent calls.

### How It Works

#### The Two-Parameter Purpose

1. **First parameter (str/NULL)**: WHERE to search
   - Pass the string on **first call** to initialize
   - Pass \`NULL\` on **subsequent calls** to continue from saved position

2. **Second parameter (delim)**: WHAT to search for
   - Specifies which characters are delimiters
   - Must be provided on **every call** (can be different each time)

#### What strtok Does

1. Searches for the next delimiter character
2. **Replaces the delimiter with \`'\\0'\`** (modifies original string!)
3. Returns pointer to the start of the current token
4. Saves position internally for next call
5. Returns \`NULL\` when no more tokens exist

### Step-by-Step Example

#### Input String
\`\`\`c
char str[] = "James,Hong Kong,20";
\`\`\`

#### First Call - Initialize
\`\`\`c
char* name = strtok(str, ",");
\`\`\`

**What happens:**
1. Searches \`str\` for first \`','\`
2. Replaces \`','\` with \`'\\0'\`
3. Returns pointer to \`"James"\`
4. Saves internal position after the \`'\\0'\`

**Memory after:**
\`\`\`text
"James\\0Hong Kong,20"
      ↑ replaced
       ↑ saved position
\`\`\`

**Result:** \`name\` points to \`"James"\`

#### Second Call - Continue
\`\`\`c
char* addr = strtok(NULL, ",");
\`\`\`

**What happens:**
1. \`NULL\` means "use saved position"
2. Continues from saved position
3. Searches for next \`','\`
4. Replaces it with \`'\\0'\`
5. Returns pointer to \`"Hong Kong"\`
6. Updates saved position

**Memory after:**
\`\`\`text
"James\\0Hong Kong\\020"
                 ↑ replaced
                  ↑ new saved position
\`\`\`

**Result:** \`addr\` points to \`"Hong Kong"\`

#### Third Call - Continue
\`\`\`c
char* hours = strtok(NULL, ",");
\`\`\`

**What happens:**
1. Continues from saved position
2. No more \`','\` found
3. Returns pointer to \`"20"\`
4. Reaches end of string

**Memory after:**
\`\`\`text
"James\\0Hong Kong\\020\\0"
                      ↑ end of original string
\`\`\`

**Result:** \`hours\` points to \`"20"\`

#### Fourth Call - End
\`\`\`c
char* next = strtok(NULL, ",");
\`\`\`

**Result:** \`next\` is \`NULL\` (no more tokens)

### Visual Flow Diagram

\`\`\`text
Original string: "James,Hong Kong,20"
                       ↓

Call 1: strtok(str, ",")
        "James\\0Hong Kong,20"
         ↑
      returns
        
Call 2: strtok(NULL, ",")
        "James\\0Hong Kong\\020"
                 ↑
              returns
              
Call 3: strtok(NULL, ",")
        "James\\0Hong Kong\\020\\0"
                          ↑
                       returns
                       
Call 4: strtok(NULL, ",")
        returns NULL (no more tokens)
\`\`\`

### Complete Working Example

\`\`\`c
#include <stdio.h>
#include <string.h>

int main() {
    char str[] = "James,Hong Kong,20";
    
    char* name  = strtok(str, ",");   // "James"
    char* addr  = strtok(NULL, ",");  // "Hong Kong"
    char* hours = strtok(NULL, ",");  // "20"
    
    printf("Name: %s\\n", name);       // Name: James
    printf("Address: %s\\n", addr);    // Address: Hong Kong
    printf("Hours: %s\\n", hours);     // Hours: 20
    
    return 0;
}
\`\`\`

### Why Use NULL in Subsequent Calls?

**If we DON'T use NULL:**
\`\`\`c
char* name  = strtok(str, ",");   // "James"
char* addr  = strtok(str, ",");   // "James" again!
char* hours = strtok(str, ",");   // "James" again!
\`\`\`

Passing the string again **resets** to the beginning.

**With NULL (correct):**
\`\`\`c
char* name  = strtok(str, ",");   // "James"
char* addr  = strtok(NULL, ",");  // "Hong Kong" ✓
char* hours = strtok(NULL, ",");  // "20" ✓
\`\`\`

NULL tells strtok to **continue** from where it stopped.

### Multiple Delimiter Characters

We can specify multiple delimiters in one string:

\`\`\`c
char str[] = "name=James;addr=Hong Kong;hours=20";
char* token = strtok(str, "=;");  // Split on '=' OR ';'

// Returns: "name", "James", "addr", "Hong Kong", "hours", "20"
\`\`\`

**Common use case:**
\`\`\`c
char str[] = "one  two\\tthree\\nfour";
char* token = strtok(str, " \\t\\n");  // Split on space, tab, or newline

while (token != NULL) {
    printf("%s\\n", token);
    token = strtok(NULL, " \\t\\n");
}
\`\`\`

### Using Different Delimiters Per Call

Each call can use different delimiters:

\`\`\`c
char str[] = "name:James,addr:Hong Kong,hours:20";

char* field1 = strtok(str, ":");    // "name"
char* value1 = strtok(NULL, ",");   // "James"
char* field2 = strtok(NULL, ":");   // "addr"
char* value2 = strtok(NULL, ",");   // "Hong Kong"
// And so on...
\`\`\`

### Loop Pattern

Common pattern to process all tokens:

\`\`\`c
char str[] = "apple,banana,cherry,date";
char* token = strtok(str, ",");

while (token != NULL) {
    printf("%s\\n", token);
    token = strtok(NULL, ",");
}

// Output:
// apple
// banana
// cherry
// date
\`\`\`

### Critical Warnings

#### Modifies Original String

\`strtok\` **destroys the original string** by replacing delimiters with \`'\\0'\`.

\`\`\`c
char str[] = "a,b,c";
printf("%s\\n", str);        // "a,b,c"

strtok(str, ",");
printf("%s\\n", str);        // "a" (rest is still there but separated by \\0)
\`\`\`

**Solution:** Make a copy if we need the original

\`\`\`c
char original[] = "James,Hong Kong,20";
char copy[256];
strcpy(copy, original);

char* token = strtok(copy, ",");  // Work with copy
// original is preserved
\`\`\`

#### Not Thread-Safe

\`strtok\` uses a static internal variable, making it **not thread-safe**. Multiple threads calling \`strtok\` will interfere with each other.

**Solution:** Use \`strtok_r\` (reentrant version)

\`\`\`c
char* saveptr;
char* token = strtok_r(str, ",", &saveptr);
char* next  = strtok_r(NULL, ",", &saveptr);
\`\`\`

#### Cannot Use on String Literals

\`\`\`c
char* str = "a,b,c";         // String literal (in read-only memory)
strtok(str, ",");            // ❌ CRASH! Cannot modify string literals
\`\`\`

**Solution:** Use array instead

\`\`\`c
char str[] = "a,b,c";        // Modifiable array
strtok(str, ",");            // ✓ Works
\`\`\`

####  Empty Tokens

\`strtok\` skips consecutive delimiters:

\`\`\`c
char str[] = "a,,c";         // Two commas
strtok(str, ",");            // "a"
strtok(NULL, ",");           // "c" (skips empty token!)
\`\`\`

If we need to preserve empty tokens, use alternative methods.

### Common Use Cases

#### Parsing CSV Data
\`\`\`c
char line[] = "John,Doe,30,Engineer";
char* first = strtok(line, ",");
char* last  = strtok(NULL, ",");
char* age   = strtok(NULL, ",");
char* job   = strtok(NULL, ",");
\`\`\`

#### Parsing Command-Line Input
\`\`\`c
char input[] = "add 5 10";
char* cmd  = strtok(input, " ");   // "add"
char* arg1 = strtok(NULL, " ");    // "5"
char* arg2 = strtok(NULL, " ");    // "10"
\`\`\`

#### Splitting Path Components
\`\`\`c
char path[] = "/usr/local/bin";
char* token = strtok(path, "/");

while (token != NULL) {
    printf("Component: %s\\n", token);
    token = strtok(NULL, "/");
}
// Output: usr, local, bin
\`\`\`

### Alternatives to strtok

#### \`strtok_r\` (Thread-Safe)
\`\`\`c
char* saveptr;
char* token = strtok_r(str, ",", &saveptr);
while (token != NULL) {
    printf("%s\\n", token);
    token = strtok_r(NULL, ",", &saveptr);
}
\`\`\`

#### strsep (BSD/Linux)
\`\`\`c
char* token;
char* ptr = str;
while ((token = strsep(&ptr, ",")) != NULL) {
    printf("%s\\n", token);  // Handles empty tokens
}
\`\`\`

#### Manual Parsing
\`\`\`c
char* start = str;
char* end;
while ((end = strchr(start, ',')) != NULL) {
    *end = '\\0';
    printf("%s\\n", start);
    start = end + 1;
}
printf("%s\\n", start);  // Last token
\`\`\`

### Summary Table

| Feature | Behavior |
|---------|----------|
| **First parameter** | String pointer (first call) or NULL (subsequent calls) |
| **Second parameter** | Delimiter characters (required every call) |
| **Modifies string** | Yes - replaces delimiters with '\\0' |
| **Thread-safe** | No - use strtok_r instead |
| **Empty tokens** | Skipped (consecutive delimiters ignored) |
| **String literals** | Cannot use - will crash |
| **Returns** | Pointer to token, or NULL when done |

### Quick Reference

\`\`\`c
// Basic usage
char str[] = "a,b,c";
char* tok1 = strtok(str, ",");     // First token
char* tok2 = strtok(NULL, ",");    // Second token
char* tok3 = strtok(NULL, ",");    // Third token

// Loop pattern
char str[] = "a,b,c";
char* token = strtok(str, ",");
while (token != NULL) {
    // Process token
    token = strtok(NULL, ",");
}

// Preserve original
char original[] = "a,b,c";
char copy[256];
strcpy(copy, original);
strtok(copy, ",");                  // original unchanged

// Thread-safe version
char* saveptr;
strtok_r(str, ",", &saveptr);
\`\`\`

### Key Takeaways

1. **First call**: Pass the string to initialize
2. **Subsequent calls**: Pass NULL to continue
3. **Delimiter**: Can be different for each call
4. **Modifies string**: Always makes a copy if we need the original
5. **Loop pattern**: Common idiom is \`while (token != NULL)\`
6. **Thread safety**: Use \`strtok_r\` for multithreaded code
7. **NULL terminates**: The function replaces delimiters with '\\0'
8. **Stateful**: Maintains internal position between calls
`;export{n as default};
