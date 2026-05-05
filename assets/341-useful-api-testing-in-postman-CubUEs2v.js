const e=`---
title: "Postman Scripts for Testing and Setting Results into Environment Variables"
date: 2024-11-17
id: blog0341
tag: test, postman
toc: true
intro: "We record useful postman script in manual testing."
---

<style>
  img {
    max-width: 660px;
  }
</style>


### Where to write postman script

For any request, just click \`Scripts\` and chooes \`response\`:

![](/assets/img/2024-11-17-18-16-51.png)

### Standard Scripts

Suppose that a login API responses the following on successful attempt:

\`\`\`js
{
    "success": true,
    "result": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkyOTg5OS0xOTdkLTA3ZTctOWNhOC0zNDMyMTQ1YjM1MzUiLCJuYW1lIjoiMTEgMTEiLCJlbWFpbCI6Im1pa2UuY2hlbkB3b25kZXJicmlja3MuY29tIiwiY29tcE5hbWUiOiIxMSIsImNvbXBJZCI6IjAxOTI0MjA3LTBhOGYtODkxZS00MjAyLWE1Yjg3ZGMwNTlhMSIsImlzQWRtaW4iOmZhbHNlLCJyb2xlSW5Db21wYW55IjoiMTEiLCJhdmF0YXJVUkwiOiJodHRwczovL2F1ZGlvYXNyLmJsb2IuY29yZS53aW5kb3dzLm5ldC91YXQtaW1hZ2VzL2F2YXRhcl9pbWFnZV9taWtlLmNoZW5Ad29uZGVyYnJpY2tzLmNvbV9kYXlfMjAyNC0xMC0xOF90aW1lXzA5LTQ1LTEzXzk1MTQ2MC5qcGVnIiwicGhvbmUiOiIiLCJzdHJpcGVDdXN0b21lcklkIjoiIiwic3RyaXBlVGVzdGNsb2NrSWQiOiIiLCJzdHJpcGVUZXN0Q3VzdG9tZXJJZCI6IiIsImlhdCI6MTcyOTU1NjUyNCwiZXhwIjoxNzM1NjA4MTI0fQ.8GcvY7TeNUMu0zjSduqFXw2Eoyg-MnQ-qlxVttiGrmg",
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMTkyOTg5OS0xOTdkLTA3ZTctOWNhOC0zNDMyMTQ1YjM1MzUiLCJuYW1lIjoiMTEgMTEiLCJlbWFpbCI6Im1pa2UuY2hlbkB3b25kZXJicmlja3MuY29tIiwiY29tcE5hbWUiOiIxMSIsImNvbXBJZCI6IjAxOTI0MjA3LTBhOGYtODkxZS00MjAyLWE1Yjg3ZGMwNTlhMSIsImlzQWRtaW4iOmZhbHNlLCJyb2xlSW5Db21wYW55IjoiMTEiLCJhdmF0YXJVUkwiOiJodHRwczovL2F1ZGlvYXNyLmJsb2IuY29yZS53aW5kb3dzLm5ldC91YXQtaW1hZ2VzL2F2YXRhcl9pbWFnZV9taWtlLmNoZW5Ad29uZGVyYnJpY2tzLmNvbV9kYXlfMjAyNC0xMC0xOF90aW1lXzA5LTQ1LTEzXzk1MTQ2MC5qcGVnIiwicGhvbmUiOiIiLCJzdHJpcGVDdXN0b21lcklkIjoiIiwic3RyaXBlVGVzdGNsb2NrSWQiOiIiLCJzdHJpcGVUZXN0Q3VzdG9tZXJJZCI6IiIsInV1aWQiOiI5OTBkODI5ZC1lYmIzLTQ1YmQtYjg0OS0yMzY2MTJkM2ExMDgiLCJpYXQiOjE3Mjk1NTY1MjQsImV4cCI6MTczNTYwODEyNH0.loIoOQ4YUh8jYMsWQHHfcSFk4Bbg0UULFVziwA58YRU",
        "user": {
            "userId": "01929899-197d-07e7-9ca8-3432145b3535",
            "name": "11 11",
            "email": "mike.chen@wonderbricks.com",
            "compName": "11",
            "compId": "01924207-0a8f-891e-4202-a5b87dc059a1",
            "isAdmin": false,
            "roleInCompany": "11",
            "avatarURL": "https://audioasr.blob.core.windows.net/uat-images/avatar_image_mike.chen@wonderbricks.com_day_2024-10-18_time_09-45-13_951460.jpeg",
            "phone": "",
            "stripeCustomerId": "",
            "stripeTestclockId": "",
            "stripeTestCustomerId": ""
        }
    }
}
\`\`\`
#### Save the result in memory

\`\`\`js
var responseJSON = pm.response.json();
var result = responseJSON.result;
\`\`\`

#### Set access token into env
\`\`\`js
pm.environment.set("userId", result.user.userId);
pm.environment.set("authorization", result.accessToken);
pm.environment.set("refreshToken", result.refreshToken);
\`\`\`
This will set \`authorization\` into you environment variable. If you have not set them here:

[![](/assets/img/2024-11-17-18-22-20.png)](/assets/img/2024-11-17-18-22-20.png)

Postman we create one and set it for you. The predefined environment variables help auto-completion.

#### Parse a JWT token

\`\`\`js
function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}
\`\`\`

#### Testing Structure

\`\`\`js
pm.test("test name", function () {
    pm.expect(result.accessToken).to.not.be.null;
    pm.expect(result.refreshToken).to.not.be.null;
    ...
});
\`\`\`

#### Common Tests

##### Assert not null
\`\`\`js
pm.expect(result.accessToken).to.not.be.null
\`\`\`
##### Assert value is $<$, $\\leq$, $>$, $\\geq$ or $=$
\`\`\`js
pm.expect(value).to.be.below(7);
pm.expect(value).to.be.at.most(7);
pm.expect(value).to.be.above(7);
pm.expect(value).to.be.at.least(7);
pm.expect(value).to.equal(1)
\`\`\`
##### Assert existence of an attribute
\`\`\`js
pm.expect(result).to.have.property('accessToken'); 
// this checkts that the value is not undefined or null:
// pm.expect(result.accessToken).to.exist
\`\`\`
##### Assert status code
\`\`\`js
pm.response.to.have.status(200);
\`\`\`

##### Assert header includes specific value
Let's say we verify the response header has \`Content-Type: "application/json"\`:
\`\`\`js
pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");
// if we want exact match:
// pm.expect(pm.response.headers.get("Content-Type")).to.eql('application/json');
\`\`\`
##### Assert a value type
\`\`\`js
  pm.expect(jsonData).to.be.an("object");
  pm.expect(jsonData.name).to.be.a("string");
  pm.expect(jsonData.age).to.be.a("number");
  pm.expect(jsonData.hobbies).to.be.an("array");
  pm.expect(jsonData.website).to.be.undefined;
  pm.expect(jsonData.email).to.be.null;
\`\`\`
##### Assert that a value is in a set
\`\`\`js
  pm.expect(pm.response.json().type)
    .to.be.oneOf(["Subscriber", "Customer", "User"]);
\`\`\`
##### Assert a boolean is true
\`\`\`js
pm.expect(pm.response.json().accessToken !== null).to.be.true;
\`\`\`

### References

- [Postman Documentation on All Available Tests](https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-examples/)`;export{e as default};
