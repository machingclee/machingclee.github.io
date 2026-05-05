const n=`---
title: "Command-Line Argument Parsing in C"
date: 2026-02-15
id: blog0457
tag: C
toc: true
intro: "Study argument parser in C"
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



### Introduction

Command-line argument parsing allows programs to accept user input through terminal arguments, making programs flexible and scriptable. In C, the standard library provides \`getopt()\` from \`<unistd.h>\` to parse command-line options.

### Basic Concepts

#### Program Arguments

When we run a program like:
\`\`\`bash
./dbview -n -f database.db -a "John,123 Main St,40"
\`\`\`

The arguments are passed to \`main()\`:
\`\`\`c
int main(int argc, char* argv[])
\`\`\`

- **\`argc\`**: Argument count (number of arguments including program name)
- **\`argv\`**: Argument vector (array of strings)
  - \`argv[0]\` = \`"./dbview"\`
  - \`argv[1]\` = \`"-n"\`
  - \`argv[2]\` = \`"-f"\`
  - \`argv[3]\` = \`"database.db"\`
  - etc.

### Using \`getopt()\`

#### Basic Structure

\`\`\`c
#include <getopt.h>

int main(int argc, char* argv[]) {
    // Declare variables to store parsed values
    char* filepath  = NULL;
    char* addstring = NULL;
    bool newfile    = false;
    int c;  // Holds the current option character
    
    // Parse arguments
    while ((c = getopt(argc, argv, "nf:a:")) != -1) {
        switch (c) {
        case 'n':
            newfile = true;
            break;
        case 'f':
            filepath = optarg;
            break;
        case 'a':
            addstring = optarg;
            break;
        case '?':  // Unknown option
            fprintf(stderr, "Unknown option\\n");
            return 1;
        default:
            fprintf(stderr, "Usage: %s [-n] -f filename\\n", argv[0]);
            return 1;
        }
    }
    
    // Validate required arguments
    if (filepath == NULL) {
        printf("Filepath is required\\n");
        return 1;
    }
    
    // Use the parsed values
    printf("File: %s\\n", filepath);
    if (newfile) {
        printf("Creating new file\\n");
    }
    
    return 0;
}
\`\`\`

#### The Option String Format

\`\`\`c
getopt(argc, argv, "nf:a:")
                    ^^^^^^
\`\`\`

The third argument is the **option string** defining valid options:

| Pattern | Meaning | Example Usage |
|---------|---------|---------------|
| \`"n"\` | Flag option (no value) | \`-n\` |
| \`"f:"\` | Option requires value (colon) | \`-f database.db\` |
| \`"a:"\` | Option requires value | \`-a "John,NYC,40"\` |
| \`"nf:a:"\` | Combined: \`-n\` is flag, \`-f\` and \`-a\` need values | \`-n -f file.db -a data\` |

#### Key Variables

##### \`optarg\`
- Global variable from \`getopt.h\`
- Points to the argument value for options with \`:\`
- Example: For \`-f database.db\`, \`optarg\` = \`"database.db"\`

##### \`optind\`
- Global variable tracking current index in \`argv\`
- After \`getopt()\` completes, \`optind\` points to first non-option argument

##### Return value of \`getopt()\`
- Returns the option character (\`'n'\`, \`'f'\`, etc.)
- Returns \`'?'\` for unknown options
- Returns \`-1\` when all options are parsed

### Complete Example Pattern

\`\`\`c
#include <stdio.h>
#include <stdbool.h>
#include <getopt.h>
#include <stdlib.h>

void print_usage(char* program_name) {
    printf("Usage: %s [OPTIONS]\\n", program_name);
    printf("Options:\\n");
    printf("  -n            Create new file (flag)\\n");
    printf("  -f FILE       Specify file path (required)\\n");
    printf("  -a STRING     Add data string\\n");
    printf("  -h            Show this help\\n");
}

int main(int argc, char* argv[]) {
    // Step 1: Declare storage variables
    char* filepath  = NULL;
    char* addstring = NULL;
    bool newfile    = false;
    int c;
    
    // Step 2: Parse options in a loop
    while ((c = getopt(argc, argv, "nf:a:h")) != -1) {
        switch (c) {
        case 'n':
            // Flag option: just set boolean
            newfile = true;
            break;
            
        case 'f':
            // Option with value: use optarg
            filepath = optarg;
            break;
            
        case 'a':
            addstring = optarg;
            break;
            
        case 'h':
            print_usage(argv[0]);
            return 0;
            
        case '?':
            // getopt() prints error automatically
            print_usage(argv[0]);
            return 1;
            
        default:
            fprintf(stderr, "Unexpected option\\n");
            return 1;
        }
    }
    
    // Step 3: Validate required arguments
    if (filepath == NULL) {
        fprintf(stderr, "Error: -f FILE is required\\n");
        print_usage(argv[0]);
        return 1;
    }
    
    // Step 4: Use parsed values
    printf("Configuration:\\n");
    printf("  File: %s\\n", filepath);
    printf("  New file: %s\\n", newfile ? "yes" : "no");
    if (addstring) {
        printf("  Add string: %s\\n", addstring);
    }
    
    // Step 5: Process remaining non-option arguments
    for (int i = optind; i < argc; i++) {
        printf("Non-option argument: %s\\n", argv[i]);
    }
    
    return 0;
}
\`\`\`

### Usage Examples

\`\`\`bash
# Simple flag
./program -n

# Option with value
./program -f database.db

# Multiple options
./program -n -f database.db -a "John,NYC,40"

# Combined short options (if no values)
./program -nf database.db  # -n flag, -f with value

# Show help
./program -h

# Error: missing required option
./program -n
# Error: -f FILE is required
\`\`\`

### Best Practices

#### Initialize Variables to Sensible Defaults
\`\`\`c
char* filepath  = NULL;     // NULL indicates "not provided"
bool newfile    = false;    // false is default
int port        = 8080;     // Default port value
\`\`\`

#### Always Validate Required Arguments
\`\`\`c
if (filepath == NULL) {
    fprintf(stderr, "Filepath is required\\n");
    print_usage(argv[0]);
    return 1;
}
\`\`\`

#### Provide a Help Option
\`\`\`c
case 'h':
    print_usage(argv[0]);
    return 0;
\`\`\`

#### Handle Unknown Options
\`\`\`c
case '?':
    fprintf(stderr, "Unknown option\\n");
    print_usage(argv[0]);
    return 1;
\`\`\`

#### Use \`stderr\` for Errors
\`\`\`c
fprintf(stderr, "Error: invalid argument\\n");  // Not printf()
\`\`\`

#### Handle Arguments with Spaces
When arguments contain spaces or special characters, users must quote them:
\`\`\`bash
./program -a "John Doe,123 Main Street,40"
\`\`\`

Our program receives the full string in \`optarg\`.

### Common Patterns

#### Boolean Flags
\`\`\`c
bool verbose = false;
bool debug = false;

while ((c = getopt(argc, argv, "vd")) != -1) {
    switch (c) {
    case 'v': verbose = true; break;
    case 'd': debug = true; break;
    }
}
\`\`\`

#### String Options
\`\`\`c
char* input_file = NULL;
char* output_file = NULL;

while ((c = getopt(argc, argv, "i:o:")) != -1) {
    switch (c) {
    case 'i': input_file = optarg; break;
    case 'o': output_file = optarg; break;
    }
}
\`\`\`

#### Integer Options
\`\`\`c
int port = 8080;  // Default

while ((c = getopt(argc, argv, "p:")) != -1) {
    switch (c) {
    case 'p':
        port = atoi(optarg);  // Convert string to int
        if (port <= 0) {
            fprintf(stderr, "Invalid port number\\n");
            return 1;
        }
        break;
    }
}
\`\`\`

#### Mutually Exclusive Options
\`\`\`c
enum mode { MODE_NONE, MODE_CREATE, MODE_READ, MODE_UPDATE };
enum mode operation = MODE_NONE;

while ((c = getopt(argc, argv, "cru")) != -1) {
    switch (c) {
    case 'c':
        if (operation != MODE_NONE) {
            fprintf(stderr, "Only one operation allowed\\n");
            return 1;
        }
        operation = MODE_CREATE;
        break;
    case 'r': /* similar check */ break;
    case 'u': /* similar check */ break;
    }
}
\`\`\`

### Advanced: Long Options with \`getopt_long()\`

For GNU-style long options (\`--help\`, \`--file=name\`), use \`getopt_long()\`:

\`\`\`c
#include <getopt.h>

static struct option long_options[] = {
    {"help",    no_argument,       0, 'h'},
    {"file",    required_argument, 0, 'f'},
    {"new",     no_argument,       0, 'n'},
    {"add",     required_argument, 0, 'a'},
    {0,         0,                 0,  0 }
};

int option_index = 0;
while ((c = getopt_long(argc, argv, "hf:na:", 
                        long_options, &option_index)) != -1) {
    // Same switch statement as before
}
\`\`\`

Usage:
\`\`\`bash
./program --help
./program --file database.db --new --add "John,NYC,40"
./program -f database.db -n  # Short options still work
\`\`\`

### Summary

**Key Steps:**
1. Include \`<getopt.h>\`
2. Declare variables for each option
3. Loop with \`getopt(argc, argv, "option_string")\`
4. Use \`switch\` on returned character
5. Access values via \`optarg\` for options with \`:\`
6. Validate required arguments after parsing
7. Provide helpful error messages and usage info

**Remember:**
- Options without \`:\` are flags (no argument)
- Options with \`:\` require an argument (use \`optarg\`)
- Always validate required options after parsing
- Use \`fprintf(stderr, ...)\` for error messages
- Provide a \`-h\` help option

`;export{n as default};
