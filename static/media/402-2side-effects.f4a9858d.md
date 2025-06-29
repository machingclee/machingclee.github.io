---
title: Two kinds of Side Effects in JPA
date: 2025-06-28
id: blog0402
tag: jpa, event-driven, springboot
toc: true
intro: "We record a method on how to reorder folders based on our predefined pattern"
---

#### When Atomic Behaviour Needed

- Transactional context will be held to the following function scope
- When any step here **_failed_**, the main transaction will be **_failed_** as well

```kotlin
@TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
fun somethingHappenOn(event: SomeEvent)
```

#### When It can Fail Independently

- The following will be executed only when the transaction is committed
- Not only that, the `@Transactional` annotation provides next transactional context
- When we don't need any transaction (like sending email to the subscribed users), we can omit `@Transactional`

```kotlin
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
@Transactional(propagation = Propagation.REQUIRES_NEW)
fun somethingHappenOn(event: SomeEvent)
```
