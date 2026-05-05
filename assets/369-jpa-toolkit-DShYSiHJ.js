const e=`---
title: "Toolkits and Caveats Working with Spring Boot and JPA"
date: 2025-03-13
id: blog0369
tag: springboot, jpa
toc: true
intro: "This is a record of machineries in a springboot project for my own convenience."
---

<style>
  video {
    border-radius: 4px
  }
  img {
    max-width: 660px;
  }
</style>

### RestTemplate

\`\`\`kotlin
@Service
class ExpoPushNotificationService(
    private val restTemplate: RestTemplate = RestTemplate(),
) {
	...
}
\`\`\`

Then the following can make a post request:

\`\`\`kotlin
	val headers = HttpHeaders().apply {
		contentType = MediaType.APPLICATION_JSON
	}
	val requestBody = SomeDataClass(...)
	val request = HttpEntity(requestBody, headers)
	val response = restTemplate.postForObject(url, request, Response::class.java)
\`\`\`

### Join Table Without Intermediate Relation Table

#### OneToMany Case

##### The Parent

When we start from parent we don't need to specify the id used for the linkage.

\`\`\`kotlin
import org.hibernate.annotations.Cascade
import org.hibernate.annotations.CascadeType

class Team {
	@OneToMany(
		fetch = FetchType.LAZY,
		mappedBy = "team",
		cascade = [CascadeType.ALL],
		orphanRemoval = true
	)
	@Cascade(CascadeType.ALL)
	var tags: MutableList<Tag> = mutableListOf()
}
\`\`\`

##### The Children

When we start from children we specify the column that is used to forward the reference to target entity.

\`\`\`kotlin
class Tag(
    @Id
    @Column(name = "id")
    @GeneratedValue(generator = "ulid_as_uuid")
    var id: UUID? = null,
    @Column(name = "team_id", nullable = false)
    var teamId: UUID,
	...
) {
    @ManyToOne
    @JoinColumn(name = "team_id", insertable = false, updatable = false)
    var team: Team? = null
}
\`\`\`

##### \`orphanRemoval = true\`

In \`@OneToMany\` condition above we have set \`orphanRemoval = true\` to make sure a child entity gets deleted after we have removed that entity from the child list of the parent class.

> \`orphanRemoval = true\`: Automatically removes child entities that are no longer referenced by the parent. For example, if you remove a child from the collection in the parent entity, that child will be deleted from the database.

#### OneToOne Case

This is same as \`@ManyToOne\` case, in an entity class we simply write:

\`\`\`kotlin
@OneToOne
@JoinColumn(name = "static_plan_id", updatable = false, insertable = false)
var plan: StaticPlan? = null
\`\`\`

### Join Table with Relation Table

#### OneToMany Case

It suffices to study the OneToMany case (1-1 and many-to-1 are the same in using relation table)

\`\`\`kotlin
class Team(
	@Column(name="id")
	val id: UUID?= null
) {
	@OneToMany(fetch = FetchType.LAZY, orphanRemoval = true)
	@Cascade(CascadeType.ALL)
	@JoinTable(
		name = "Tagging_Rel_Team_tag",
		// from relation table --> current (Team) entity:
		joinColumns = [JoinColumn(name = "team_id", referencedColumnName = "id")],
		// from relation table --> remote (Tag) entity:
		inverseJoinColumns = [JoinColumn(name = "tag_id", referencedColumnName = "id")]
	)
	var tags: MutableList<Tag> = mutableListOf()
}
\`\`\`

#### \`orphanRemoval = true\` and Soft-Deletion

For a **_complete deletion_** we set \`orphanRemoval = true\`. Otherwise when we remove an entity from a child list, the dirty check mechanism at the end of transactional session simply remove the record in **_relation table_**, but the \`Tag\` entity will remain there.

If we want to retain the object and simply break the relation, we set \`orphanRemoval = false\`, this will result in a soft-deletion.

### Not Everyone of @OneToOne, @OneToMany, @ManyToOne, @ManyToOne is Lazy-Loading by Default

- **_EAGER_** by default:
  - @OneToOne
  - @ManyToOne
- **_LAZY_** by default:
  - @OneToMany
  - @ManyToMany

To play safe we might annotate **_each of them_** by fetch-mode lazy!
`;export{e as default};
