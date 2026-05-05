const n=`---
title: Two kinds of Side Effects in JPA
date: 2025-06-28
id: blog0403
tag: jpa, event-driven, springboot
toc: true
intro: "We mention two common patterns in event-driven design for Spring boot that handles side effects due to domain events"
img: spring
---

### When Atomic Behaviour Needed

- Transactional context will be held to the following function scope
- When any step here **_failed_**, the main transaction will be **_failed_** as well

\`\`\`kotlin
@TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
fun somethingHappenOn(event: SomeEvent)
\`\`\`

### When It can Fail Independently

- The following will be executed only when the transaction is committed
- Not only that, the \`@Transactional\` annotation provides next transactional context
- When we don't need any transaction (like sending email to the subscribed users), we can omit \`@Transactional\`

\`\`\`kotlin
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.event.TransactionalEventListener

@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
@Transactional(propagation = Propagation.REQUIRES_NEW)
fun somethingHappenOn(event: SomeEvent)
\`\`\`
`;export{n as default};
