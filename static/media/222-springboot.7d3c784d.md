---
title: "Springboot Revisit"
date: 2023-12-08
id: blog0222
tag: java, springboot
intro: "Revisit the basic of springboot application."
toc: true
wip: true
---

#### Maven and Starters

Springboot is a web application that servers as an entry point to the whole spring ecosystem.

When we start from `maven`, the required spring components are usually named as `*-starter`.

##### POM.xml

A minimal working springboot project has the following `pom.xml` that indicates all the dependencies used:

###### `<parent/>`

The following `pom.xml` includes the most basic dependencies to start up a `hello world` web application:

#### Annotations

##### @Configuration

For configuration, is also an instance of `@Component`.

##### @EnableAutoConfiguration
