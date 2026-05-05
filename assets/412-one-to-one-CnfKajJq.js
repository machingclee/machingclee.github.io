const n=`---
title: Use Bytecode Enhancement to Solve the Problem that @JoinColumn and @OneToOne Cannot be Truely Lazy
date: 2025-09-11
id: blog0412
tag: kotlin, springboot
toc: true
intro: An \`application.yml\` config to turn on bytecode enhancement in order to prevent @JoinColumn or @OneToOne annotated column from being always eagerly loading.
img: spring
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>


### Enable Bytecode Enhancement

\`\`\`kotlin
plugins {
    id("org.hibernate.orm") version "6.4.4.Final"
}

hibernate {
    enhancement {
        enableLazyInitialization = true      // Makes @OneToOne truly lazy
        enableDirtyTracking = true          
        enableAssociationManagement = true   // Automatic bidirectional association management
    }
}
\`\`\`
<!-- 
1. The Null vs Non-Null Dilemma

\`\`\`kotlin
@OneToOne(mappedBy = "fromClass", fetch = FetchType.LAZY)
var comingExtensionClass: ExtendedClass? = null
\`\`\`

The Issue:
- Hibernate needs to know if this field should be null or contain a proxy object
- Unlike collections (which can be empty), @OneToOne is binary: either null or an object
- To determine this, Hibernate must check the database

2. Different Scenarios and Their Problems

Scenario A: @OneToOne with mappedBy (Your Case)

\`\`\`kotlin
// In Class entity
@OneToOne(mappedBy = "fromClass", fetch = FetchType.LAZY)
var comingExtensionClass: ExtendedClass? = null

// In ExtendedClass entity  
@OneToOne
@JoinColumn(name = "extend_from_class_id")
var fromClass: Class? = null
\`\`\`

Problem:
- The Class entity doesn't own the foreign key
- To know if comingExtensionClass exists, Hibernate must query: SELECT * FROM extended_class WHERE extend_from_class_id = ?
- When you load multiple classes → N+1 queries

Scenario B: @OneToOne with @JoinColumn (Owning Side)

\`\`\`kotlin
@OneToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "extended_class_id")
var comingExtensionClass: ExtendedClass? = null
\`\`\`

Problem:
- Even though this side owns the foreign key, Hibernate still struggles
- If extended_class_id is NULL → field should be null
- If extended_class_id has a value → field should be a proxy
- Hibernate often loads the related entity to create the proxy properly

3. Why Other Relationships Don't Have This Problem

| Relationship | Lazy Loading Behavior | Why It Works |
|-------------|---------------------|--------------|
| @OneToMany | ✅ Works well | Collections can be empty; Hibernate uses lazy collections |
| @ManyToOne | ✅ Usually works | Can create proxy without checking existence |
| @OneToOne | ❌ Often fails | Must determine null vs non-null upfront | -->`;export{n as default};
