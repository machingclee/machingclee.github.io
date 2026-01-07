---
title: "insertable=false and updatable=false in JPA"
date: 2026-01-07
id: blog0450
tag: springboot
toc: true
intro: "In JPA insertable=false and updatable=false is super confusing when it is OneToOne and OneToMany, we clarify the two cases to avoid the misuse of weird patterns that make things work unexpectedly."
---




### With Join Table

Consider the following example:

```kotlin{71-72}
// The owner side
@Entity
@GenerateDTO
@DynamicInsert
@Table(name = "workspace", indexes = [Index(columnList = "id")])
class Workspace(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int? = null,

    @Embedded
    var name: Name,

    @Column(name = "ordering", nullable = false)
    var ordering: Int = 0,

    @Column(name = "created_at")
    val createdAt: Double? = null,

    @Column(name = "created_at_hk")
    val createdAtHk: String? = null
) {
    @Embeddable
    class Name(
        @Column(name = "name", nullable = false)
        var value: String,
    ) {
        init {
            require(value.isNotBlank()) { "Workspace name cannot be blank" }
            require(value.length >= 3) { "Workspace name must be at least 3 characters long" }
        }
    }

    @OneToMany(fetch = FetchType.LAZY)
    @Cascade(CascadeType.ALL)
    @JoinTable(
        name = "rel_workspace_folder",
        joinColumns = [JoinColumn(name = "workspace_id", referencedColumnName = "id")],
        inverseJoinColumns = [JoinColumn(name = "folder_id", referencedColumnName = "id")]
    )
    var folders: MutableSet<ScriptsFolder> = mutableSetOf()
}

// The child side
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
        joinColumns = [JoinColumn(name = "folder_id", referencedColumnName = "id", insertable = false, updatable = false)],
        inverseJoinColumns = [JoinColumn(name = "workspace_id", referencedColumnName = "id", insertable = false, updatable = false)]
    )
    var parentWorkspace: Workspace? = null
}
```

Note that we have marked both `JoinColumn` to use 
- `insertable = false`
- `updatable = false`

which makes the child side completely `ready-only`. Marking them `false` means that the dirty check for the assignement
```kotlin
folder.parentWorkspace = otherWorkspace
```

- ***will not*** ***insert*** a relation into the join table
- ***will not*** ***update*** the relation in the join table

Now the relation is completely controlled by the parent, which is usually an aggregate.

### Without Join Table

Which means that a table has a column that directly points to the primary key of another column. For example:

```kotlin{27}
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
```
By this the assignment 

```kotlin
aiScriptedTool.shellScript = someShellScript
```
- ***will not include*** `shell_script_id` in the insert statement of persisting `aiScriptedTool`
- ***will not update*** `shell_script_id` in the update statement of modifying `aiScriptedTool` 

But then how to set the relation properly? We strictly follow the following steps:

1. Persist the parent and get `parentId`.
2. Persist the children and assign that `parentId`.


### When do we want `insertable=true` and `updatable=true`?
#### Enforce Domian Logic by Privating Constructor
It is not rare but one common occasion is:
> You want to ***private out*** the constructor of an aggregate and create factory method for your entity objects to enforce domain logics.


For example, a `Message` entity must be one of `TextMessage`, `ImageMessage` and `VoiceMessage`, therefore creating and persisting the `Message` object alone in the database will ***violate*** the domain logic.

In other words, `Message` and one of the remaining classes must appear in pair.

By privating the constructor we can write


```kotlin
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
```
Now no one can create `Message` entity alone, prohibiting invalid domain logic from the prospective of data integrity.

#### Caveat

The `save` behaviour for the above bidirectionally-bound entities can vary in different databases.

Takes these lines for example:

```kotlin
// inside of factory method:
val message = Message()
val audioMessage = AudioMessage(audioUrl, transcriptionText)
message.audioMessage = audioMessage
textMessage.parentMessage = message

// eventually:
messageRepository.save(message)
```
- SQLite enforces foreign key constraints ***immediately*** during each `INSERT`
- It does ***not*** support deferred constraint checking
- Other databases (PostgreSQL, MySQL) can defer FK checks until transaction commit

and JPA does not change its persistence strategy (order of persistence) based on different dialects. 

If your choice of database support the above operation, just go ahead, otherwise the "persist parent first, then child" approach is the most reliable.