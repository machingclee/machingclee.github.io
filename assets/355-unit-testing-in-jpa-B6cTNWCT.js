const e=`---
title: "Unit Testing in Kotlin with MockK"
date: 2024-12-31
id: blog0355
tag: springboot, test, mockk
toc: true
intro: "Let's get rid of the deprecated react beautiful dnd."
img: spring
---

<style>
  img {
    max-width: 660px;
  }
</style>

### Mock Any Instance

\`\`\`kotlin
mockkConstructor(StudentPackage::class)
every { anyConstructed<StudentPackage>().getNumOfClasses() } returns 42
every { anyConstructed<StudentPackage>().getCourseId() } returns 123
\`\`\`

A more practical example is to mock the Joda \`DateTime\` object:

\`\`\`kotlin
val fixedTime = 1640995200000L
mockkConstructor(DateTime::class)
every { anyConstructed<DateTime>().millis } returns fixedTime
\`\`\`

Now we can unit-test any "current time" related logic, any instance of

\`\`\`kotlin
DateTime().millis
\`\`\`

will return \`fixedTime\`.

### Partially Mock an Object

Sometimes we wish to keep the real implementation of an object with only some methods / attributes being faked. Then:

\`\`\`kotlin
val studentPackage = spyk<StudentPackage>(StudentPackage(
    startDate = 0L.toDouble(),  // Use dummy values for constructor
    paidAt = 0L.toDouble(),
    officialEndDate = 0L.toDouble(),
    expiryDate = 0L.toDouble(),
    min = 0,
    courseId = 0,
    createdAt = 0L.toDouble(),
    createdAtHk = "",
    numOfClasses = 0,
    defaultClassroom = Classroom.CAUSEWAY_BAY,
    uuid = UUID.randomUUID(),
    id = 0
))

\`\`\`

Now we can override \`studentPackage\` partially by:

\`\`\`kotlin
every { spyPackage.getNumOfClasses() } returns 42
\`\`\`

### When can we use \`every {}\`?

Note that \`every {}\` can only be applied on objects created through \`MockK\` methods:

1. \`mockk()\` - fully mocked object
2. \`spyk()\` - real object with mocking capabilities
3. \`mockkConstructor()\` - mocks all instances of a class
4. \`mockkObject()\` - for mocking Kotlin object (singleton)
5. \`mockkStatic()\` - for mocking static methods

### Mock an object with all default dummy implementation

Sometimes we are simply interested in how some attributes of an object affect the result:

\`\`\`kotlin
// relaxed = true => every method/field have default dummy value
val mockClass: Class = mockk(relaxed = true)
every { mockClass.id } returns 1
every { mockClass.hourUnixTimestamp } returns (fixedTime - 3600000L).toDouble()
\`\`\`

### Complete Test Example

\`\`\`kotlin
@Test
fun \`no class in the past can be added\`() {
    val fixedTime = 1640995200000L // 2022-01-01 00:00:00
    mockkConstructor(DateTime::class)
    every { anyConstructed<DateTime>().millis } returns fixedTime

    val studentPackage = StudentPackage(
        startDate = 0L.toDouble(),
        paidAt = 0L.toDouble(),
        officialEndDate = 0L.toDouble(),
        expiryDate = 0L.toDouble(),
        min = 0,
        courseId = 0,
        createdAt = 0L.toDouble(),
        createdAtHk = "",
        numOfClasses = 0,
        defaultClassroom = Classroom.CAUSEWAY_BAY,
        uuid = UUID.randomUUID(),
        id = 0
    )

    val mockClass: Class = mockk(relaxed = true)
    every { mockClass.id } returns 1
    every { mockClass.hourUnixTimestamp } returns (fixedTime - 3600000L).toDouble()

    val exception = assertThrows<TimetableException> {
        studentPackage.addClasses(listOf(mockClass))
    }
    assertEquals("Only classes in the future can be created.", exception.message)
}
\`\`\`
`;export{e as default};
