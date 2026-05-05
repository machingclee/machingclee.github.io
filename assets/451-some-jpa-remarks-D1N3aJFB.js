const e=`---
title: "What does it mean by \`insertable=false\` and \`updatable=false\` in \`JoinTable\` and \`JoinColumn\` of JPA"
date: 2026-01-07
id: blog0451
tag: springboot
toc: true
intro: "In JPA insertable=false and updatable=false is super confusing when it is OneToOne and OneToMany, we clarify the two cases to avoid the misuse of weird patterns that make things work unexpectedly."
---

### On Parent Side

Since we always mark \`insertable=true\` and \`updatable=true\` in \`@JoinTable\` of parent side ***by default***, we only discuss the child side:


### On Child Side


#### With Join Table (Using \`@JoinTable\`)

##### The Children
\`\`\`kotlin{27,28}
@Entity
@GenerateDTO
@DynamicInsert
@Table(name = "scripts_folder", indexes = [Index(columnList = "id")])
class ScriptsFolder(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int? = null,

    @Column(name = "name", nullable = false)
    var name: String = "",

    @Column(name = "ordering", nullable = false)
    var ordering: Int = 0,

    @Column(name = "created_at")
    @Generated
    val createdAt: Double? = null,

    @Column(name = "created_at_hk")
    @Generated
    val createdAtHk: String? = null
) {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinTable(
        name = "rel_workspace_folder",
        joinColumns = [JoinColumn(insertable = false, updatable = false, name = "folder_id", referencedColumnName = "id")],
        inverseJoinColumns = [JoinColumn(insertable = false, updatable = false, name = "workspace_id", referencedColumnName = "id")]
    )
    var parentWorkspace: Workspace? = null
}
\`\`\`
##### What does \`insertable = updatable = false\` mean?
Note that we have made both \`JoinColumn\`'s to have attributes:

- \`insertable = false\`
- \`updatable = false\`

which makes the child side completely \`ready-only\`.  

For \`@JoinTable\` the ***dirty check*** for the assignement
\`\`\`kotlin
folder.parentWorkspace = otherWorkspace
\`\`\`

- \`insertable = false\` $\\implies$ ***will not*** ***insert*** a relation into the join table
- \`updatable = false\` $\\implies$ ***will not*** ***update*** the relation in the join table

Now the relation is completely controlled by the parent, which is usually an aggregate, via as simply as 
\`\`\`kotlin
workspace.folders.add(folder)
\`\`\`

#### Without Join Table (Using \`@JoinColumn\`)

Which means that a table has a column that directly points to the primary key of another column. For example:
##### The Children
\`\`\`kotlin{27}
class AiScriptedTool(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int? = null,

    @Column(name = "name", nullable = false)
    var name: String = "",

    @Column(name = "tool_description", nullable = false)
    var toolDescription: String = "",

    @Column(name = "is_enabled", nullable = false)
    var isEnabled: Boolean = true,

    @Column(name = "shell_script_id", nullable = false)
    var shellScriptId: Int = 0,

    @Column(name = "created_at")
    @Generated
    val createdAt: Double? = null,

    @Column(name = "created_at_hk")
    @Generated
    val createdAtHk: String? = null
) {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shell_script_id", insertable = false, updatable = false)
    var shellScript: ShellScript? = null
}
\`\`\`
##### What does \`insertable = updatable = false\` mean?

For \`@JoinColumn\` now the dirty check for the assignment 

\`\`\`kotlin
aiScriptedTool.shellScript = someShellScript
\`\`\`
- \`insertable = false\` $\\implies$ ***will not include*** \`shell_script_id\` in the \`INSERT\` statement of persisting \`aiScriptedTool\`
- \`updatable = false\` $\\implies$ ***will not update*** \`shell_script_id\` in the \`UPDATE\` statement of modifying \`aiScriptedTool\` 

But then how to set the relation properly? We strictly follow the following steps:

1. Persist the parent and get \`parentId\`.
2. Persist the children and assign that \`parentId\`.


### When do we want \`insertable=true\` and \`updatable=true\`?
#### Enforce Domain Logic by Making Constructor Private

##### Scenario

It is not rare and one common scenario is:

> You want to ***private out*** the constructor of an aggregate and create factory method for your entity objects to enforce domain logics.


For example, a \`Message\` entity must be one of \`TextMessage\`, \`ImageMessage\` and \`VoiceMessage\`, therefore creating and persisting the \`Message\` object alone in the database will ***violate*** the domain logic.

In other words, \`Message\` and one of the remaining classes must appear in pair.

##### Code Example (Factory Pattern)

By privating the constructor we can write


\`\`\`kotlin
@Entity
class Message private constructor(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int? = null,

    @Column(name = "created_at")
    @Generated
    val createdAt: Double? = null,
    ...
) {
    companion object {
        fun createTextMessage(msg: String) {
            val message = Message()
            val textMessage = TextMessage(msg)
            message.textMessage = textMessage
            textMessage.parentMessage = message
        }

        fun createImageMessage(url: String) {
            val message = Message()
            val imageMessage = ImageMessage(url)
            message.imageMessage = imageMessage
            textMessage.parentMessage = message
        }

        fun createAudioMessage(audioUrl: String, transcriptionText: String) {
            val message = Message()
            val audioMessage = AudioMessage(audioUrl, transcriptionText)
            message.audioMessage = audioMessage
            textMessage.parentMessage = message
        }
    }
}
\`\`\`

This is known as ***Factory Pattern*** and widely used in Domain Driven Design.

Now no one can create \`Message\` entity alone, prohibiting invalid domain logic from the prospective of data integrity ***in coding level***.

#### Caveat for Different Choices of Databases
##### Failure in SQLite
The \`save\` behaviour for the above bidirectionally-bound entities can vary in different databases.

Takes these lines for example:

\`\`\`kotlin
// inside of factory method:
val message = Message()
val audioMessage = AudioMessage(audioUrl, transcriptionText)
message.audioMessage = audioMessage
audioMessage.parentMessage = message

// eventually:
messageRepository.save(message)
\`\`\`

- The above throws an exception for SQLite because SQLite enforces foreign key constraints ***immediately*** during each \`INSERT\`, which 
  - Tries to persist \`audioMessage\` first (without our control); However
  - No available \`id\` can be assigned to \`AudioMessage.messageId\` at that time.

- Other databases (such as PostgreSQL, MySQL) can ***defer*** Foreign-Key checks until transaction commit, unforturnately SQLite does not.
- JPA does not change its persistence strategy (order of persistence) based on different dialects. 

##### For Database that Supports Deferred Constraint Checking

If our choice of database supports the above operations, just go ahead. Otherwise the *persist parent first, then persist child* rule is the most reliable.`;export{e as default};
