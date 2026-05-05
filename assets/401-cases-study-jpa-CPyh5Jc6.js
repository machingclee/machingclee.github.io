const e=`---
title: "JPA Case Study: When repository.delete(someEntity) failed in a transaction *silently*"
date: 2025-06-30
id: blog0401
tag: jpa, event-driven, springboot
toc: true
intro: We study a special case where the repository.delete() can fail silently
img: spring
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px
  }
</style>

### Case Encountered

In my timetable system I need to ***add*** an "extended" class when  a status is changed from \`STATUS_A\` to \`STATUS_B\`.

On the contrary, that "extended" class needs to be ***removed*** when we switch from \`STATUS_B\` back to \`STATUS_A\`


The forward path is smooth (adding an extended class), but removing an entity by 
\`\`\`kotlin
someRespositove.delete(someEntity)
\`\`\`
***can fail*** in some cases when JPA ***don't know*** the correct deletion order of entities in a set of relation tables (i.e., when there are many \`@OneToOne\`, \`@OneToMany\`, etc, involved).




### The Problem
#### Tables Involved: The ordinary class and the extended class

[![](/assets/img/2025-06-29-23-48-33.png)](/assets/img/2025-06-29-23-48-33.png)

- A package has many classes, governed by \`rel_class_studentpackage\`

- A special type of class is called ***Extended Class***.  Which is also treated as a class, with the additional attributes listed in \`extended_class\` table (and associated by \`extended_class."classId"\`).
- In the future if we have another special class, like "Trial Class", we will create another \`trial_class\` table and let it refers to  \`class\` table. We achieve polymorphism by ***equipping*** \`class\` table with additional table.

#### What confuses JPA when deleting a class that is an extended class?

The problem arises when we try to execute the following code written in kotlin:


\`\`\`kotlin{11}
@TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
fun manageMakeupClassesOn(event: TimetableEvents.ClassInfoUpdated) {
    val targetClassId = event.reqBody.classId
    val targetClass = classRepository.findByIdOrNull(targetClassId) ?: throw TimetableException("Class not found")
    val pkg = targetClass.studentPackage ?: throw TimetableException("Student package not found")

    if (/* when targetClass switch from STATUS_B to STATUS A */) {
        // this is also a \`Class\` entity:
        val extendedClass = targetClass.extensionToRecord?.toClass 
        if (extendedClass != null) {
            classRepository.delete(extendedClass)
        }
        ...
    }
\`\`\`

**Problem.** After the transaction is completed, our \`Class\` entity \`extendedClass\` entity ***has not been removed***.


#### What is the blocker for the failed deletion of an entity?

Deletion of an "Extended Class" (namely, a class that has a reference from  \`entended_class\` table)  entity involves the following:

Let's use \`A\` $\\to$ \`B\` to mean \`A\` refers to \`B\` (i.e., \`A\` has a column referencing to the id column of \`B\`).

We have the following:

- \`extended_class\` $\\to$ \`Class\`
- \`rel_class_studentpackage\`  $\\to$ \`Class\`

Upon deleting the \`Class\` object, JPA doesn't know which one of \`{ extended_class, rel_class_studentpackage }\` should be deleted first, which ends up ***deleting nothing*** and completes the transaction silently.


#### A fix in JPA: First Delete \`rel_class_studentpackage\` → \`Class\`

\`\`\`kotlin-{11}
@TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
fun manageMakeupClassesOn(event: TimetableEvents.ClassInfoUpdated) {
    val targetClassId = event.reqBody.classId
    val targetClass = classRepository.findByIdOrNull(targetClassId) ?: throw TimetableException("Class not found")
    val pkg = targetClass.studentPackage ?: throw TimetableException("Student package not found")

    if (/* when targetClass switch from STATUS_B to STATUS A */) {
        // this is also a \`Class\` entity:
        val extendedClass = targetClass.extensionToRecord?.toClass 
        if (extendedClass != null) {
            pkg.classes.remove(extendedClass)
            classRepository.delete(extendedClass)
        }
        ...
    }
\`\`\`

Now we explicitly tell JPA:
> Hey, let's delete the entity from \`rel_class_studentpackage\` first, then deleting the remaining

#### Can deleting \`extended_class\` → \`Class\` help?

Unfortunately ***NO***, deleting all the relations between \`extended_class\` and \`Class\` does not solve the problem from experiement. In JPA a \`@OneToMany\` relation is usually the ***major*** blocker that makes the deletion failed.


### General Solution to Delete an Entity Safely

1. We break the \`@OneToMany\` relation  by \`A.entities.remove(entity)\`

2. Then we delete the entity by \`repository.delete(entity)\`

`;export{e as default};
