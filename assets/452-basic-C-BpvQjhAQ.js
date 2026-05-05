const e=`---
title: "C Fundamentals"
date: 2026-01-09
id: blog0452
tag: C
toc: true
intro: "Fundamentals of C Programming"
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


### Permissions via Bitwise Flags

First we need to know the meaning of the following ***bitwise flags***:

\`\`\`text
4 = read (r)
2 = write (w)
1 = execute (x)
\`\`\`
So a number \`6 = 4 + 2\` means READ and WRITE, which is also represented by \`O_RDWR\` in C.


Usually a permission to a file is represented by the combination \`owner-group-usr\` format, for example:

\`\`\`text
0644  // rw-r--r--  (files: owner writes, everyone reads)
0755  // rwxr-xr-x  (executables: owner full, others read+execute)
0600  // rw-------  (private files: only owner can access)
0777  // rwxrwxrwx  (everyone can do everything - rarely used)
\`\`\`
In mac this number is actually \`owner-staff-others\`, we can check all the groups in our system via command \`groups\`, by which I get 

\`\`\`text
staff everyone localaccounts _appserverusr admin _appserveradm 
_lpadmin _appstore _lpoperator _developer _analyticsusers 
com.apple.access_ftp com.apple.access_screensharing 
com.apple.access_ssh com.apple.access_remote_ae
\`\`\`
All the users that can log into this mac machine are classified into \`staff\`. The following are not of group \`staff\`:


- \`root\` (superuser) - in wheel group
- \`nobody\` - unprivileged account
- \`_www\` - web server user
- \`_mysql\` - database user
- \`_spotlight\` - spotlight indexing
- \`_windowserver\` - window server process
- And many other \`_\` prefixed system accounts

### \`ls -l\`

Now an \`ls -l\` (\`l\` stands for long format) command to a file gives 

\`\`\`text
-rw-r--r--  1 chingcheonglee  staff  1024 Jan 9 12:00 main.c
│          │ │                │      │    │         │
│          │ │                │      │    │         └─ filename
│          │ │                │      │    └─────────── timestamp
│          │ │                │      └──────────────── size (bytes)
│          │ │                └─────────────────────── group
│          │ └──────────────────────────────────────── owner
│          └───────────────────────────────────────── number of links
└──────────────────────────────────────────────────── permissions
\`\`\`

Which shows that this file has mode number \`0644\`, with the group \`staff\` being \`4\` and with other matadata.

In C we cannot omit \`0\` as it tells the compiler this number is in octal format. 

But in other linux command such as \`chmod 644 some_file.sh\` the omission is ***acceptable*** because the command is written smart enough to assume octal when you give it a 3-digit number.

Files downloaded from the internet are by default \`0644\`. That's why sometimes we need to explicitly execute \`chmod 0744\` to make a script executable.

### Formatting in VSCode

In \`settings.json\`:

\`\`\`json
    "C_Cpp.clang_format_fallbackStyle": "{ BasedOnStyle: LLVM, UseTab: Never, IndentWidth: 4, TabWidth: 4, BreakBeforeBraces: Attach, AllowShortIfStatementsOnASingleLine: false, IndentCaseLabels: false, ColumnLimit: 0, AccessModifierOffset: -4, PointerAlignment: Left, SortIncludes: false, Cpp11BracedListStyle: false, NamespaceIndentation: All, AlignAfterOpenBracket: DontAlign, AlignConsecutiveAssignments: Consecutive}",
\`\`\`


### List in C

We can declare an array in either way:

\`\`\`c
int* list = malloc(10 * sizeof(int));
int list[10];
\`\`\`

In mose cases \`list\` (an array in the second line) will be decayed to a pointer, the commonly used expression \`list[2]\` actually means:

\`\`\`c
list[2] == *(list + 2) 
\`\`\`

### Compile Modules 

#### Intermediate Object Files

Consider the following project structure:

![](/assets/img/2026-02-01-19-51-41.png)

We compile ***intermediate object file*** one by one by:

\`\`\`text
gcc -o file.o -I$(pwd)/include src/file.c -c
    │         │                 │          │
    │         │                 │          └─ flag: compile only
    │         │                 └─ INPUT: source file to compile
    │         └─ where to search for #include files
    └─ OUTPUT: name of the object file
\`\`\`

Here by the flag \`-c\` (compile only), we ask \`gcc\` to stop after compilation stage and don't do the ***linking***.

<Example>

By ***linking*** we mean: The final stage that combines multiple object files (\`.o\`) and resolves all references to create an executable.

What linking does:

1. Combines object files - merges \`main.o\`, \`utils.o\`, \`logger.o\` into one executable

2. Resolves symbols - connects function calls to their actual implementations
3. Includes libraries - links standard library functions (printf, malloc, etc.)
4. Fixes addresses - determines final memory addresses for functions and variables


</Example>

#### Compile Modules into an Executable {#compilation}

We repeated the step above 3 times:
\`\`\`text
gcc -o file.o -I$(pwd)/include src/file.c -c
gcc -o parse.o -I$(pwd)/include src/parse.c -c
gcc -o main.o -I$(pwd)/include src/main.c -c
\`\`\`
Then we obtain all object files:

![](/assets/img/2026-02-01-19-56-01.png)

Create a \`bin/\` directory and combine all the object files into one binary: 

\`\`\`text
gcc *.o -o bin/newout
\`\`\`

Now we test the binary and obtain:

![](/assets/img/2026-02-01-19-59-41.png)

### Makefile 

The steps in [#compilation] can be further simplified by \`Makefile\` and ***Pattern Rules***.


\`\`\`makefile
TARGET = bin/final
SRC = $(wildcard src/*.c)
OBJ = $(patsubst src/%.c, obj/%.o, $(SRC))

default: $(TARGET)

clean:
	rm -f obj/*.o
	rm -f bin/*

$(TARGET): $(OBJ)
	gcc -o $@ $?

obj/%.o : src/%.c
	gcc -c $< -o $@ -Iinclude
\`\`\`

- \`default\`, \`clean\`,  etc are called ***rules***, they are executed via \`make\` (equivalent to \`make default\`), \`make clean\` etc

- \`$(TARGET)\` is called a ***make variable***
- \`default\` rule is now asked to execute the \`$(TARGET)\` rule, this is simply a rule that has a variable name

- When \`$(TARGET)\` rule is being executed:

  1. By definition \`$(TARGET): $(OBJ)\` means \`$(OBJ)\` is a dependency (list) of \`$(TARGET)\` rule;

  2. It tries to find whether the object file in \`$(OBJ)\` exists, if not it tries to find any pattern rule that match files in \`$(OBJ)\`;
  3. Pattern rule \`obj/%.o\` gets executed repeatedly;
  4. When all pattern rules are done, \`$(TARGET)\` rule goes further to \`gcc -o $@ $?\`, where \`$@\` is the target name, and \`$?$\` is a name in \`$(OBJ)\`;

  ![](/assets/img/2026-02-01-23-20-59.png)
`;export{e as default};
