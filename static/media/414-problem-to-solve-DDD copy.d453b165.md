---
title: "Problems in Controller-Service-Repostory That is Solvable by Strategic Design in DDD (Domain Driven Design)"
date: 2025-09-16
id: blog0414
tag: DDD, kotlin
toc: true
intro: Traditional controller-service-repository is known as the most easiest architecture in backend development, however,  it comes with a cost.
---

<style>
  video {
    border-radius: 4px;
  }
  img {
    max-width: 660px;
  }
</style>


#### Problems of Controller-Service-Repository (CSR) Architecture



In the course of development several backend problems in CSR-architecture pop up easily that I always feel painful:

<Example>

**Problem 1 (Not easy to have clear separation of responsibility among services).**  From CSR point of view, a service is just an interface to handle a  request, and *nothing more*, that causes the problem.

As time goes by, developer is easy to build *multiple services* serving a similar purpose. 

Suppose I have a project system, now I want to design a service to let project owner add someone as a member. You can go either way:

- `ProjectService.addMember`

- `MemberService.joinProject`

There is no true or false among the choices, but our domain logic now *can go anywhere*, or even *repeatedly defined* like the `join-project` example above. 

</Example>

<Example>

**Problem 2.1 (Side Effects Become a Mess).** When dealing with side effects, namely:
- Some change in a table will cause other events to happen, such as another change in another table or sending notification, etc.

The only way the CSR-architecture can handle it is to add the handling of extra logics at the end or even at the middle of *ALL existing related services*.  Problems arise:

- First, the Open-Closed principle is easy to break and maintaining this chain of side effects is exhausting. 

- Second, this kind of side effect is *not easy to be documented*, the domain logic involved is hard to be traced and hard to be understood by new team members trying to participate in adjusting that domain logic.

</Example>


Worse still:

<Example>

**Problem 2.2 (Side Effect can be Transactional).** There are two kinds of side effects:

- Atomic

- Non-atomic

Do you want the whole successful transaction be ruined and rollbacked by the failure of sending an email notification? 

It is not trivial to implement a "transactional" side effect (e.g., send the email only when a transaction has been commited), especially when that side effect is dispatched in the middle of a chain of transaction script.

</Example>

#### How does DDD help?

Both problem can be easily solved by the methodology in DDD. 

- **For problem 1 (Spread of Domain Logic)**, we handle all the state change from the domain behaviour of an aggregate root. We do all the data modification within the same ***consistency boundary***. 

  If we want to kick a member out of a project, let's fetch the project, and execute 
  ```kotlin
  project.kickMember(member)
  ```
  it is ***impossible*** to do it in the reverse way: `member.leave(project)`, because `member` does not contain enough information to do ***domain logic validation*** (which we call ***invariance*** in DDD). 
  
  For example, assume a project cannot have fewer than 3 persons. A single member does not contain the information of other members, however, a project *does*, which is possible to keep the invariance within itself.

- **For problem 2 (Messy Side Effect)**, we simply use an event-driven architecture, and DDD is inherently based on ***events***.  DDD's `Command` and `Event` are a good fit for handling side effects.

  - To solve problem 2.1, the tight coupling of logic can now be decoupled by event and event-handler. 

  
  - To solve problem 2.2, using JPA from the ecosystem of Spring Boot,  atomic side effect can be handled by 
    `@Eventlistener`, and side effect after succeeded transaction can now be handled by `@TransactionalEventListener`.

  Event-Driven architecture can also be a mess ***without documentation*** because `eventHandler` handles the side effect silently. However, if we do documentation properly, then ***everything is explicit***:


  [![](/assets/img/2025-09-06-18-44-57.png)](/assets/img/2025-09-06-18-44-57.png)

  Now we have a good place to record the complex domain requirement. 
  
  We will discuss how we operate with these `Command`, `Event` and `Policy` in depth in the next section.