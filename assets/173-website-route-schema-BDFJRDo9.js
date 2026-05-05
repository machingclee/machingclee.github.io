const t=`---
title: "Routing Schema for Frontend Project"
date: 2023-09-05
id: blog0173
tag: react
intro: "In the browser our route consist of many information, like \`messageId\`, \`emailId\`, etc, which enables our web page to select correct data based on the route. 

In this post we discuss how to effectively construct such \`url\` with type safty under a \`RouteSchema\`."
toc: true
---

<style>
  img {
    max-width: 100%
  }
</style>

### Routing Schema as a Type Variable

Let's define a routing schema by defining, sequentially, which value is possible to appear:

\`\`\`js
export type NavigationRouteSchema = {
	value: "/buyer" | "/supplier",
	next: {
		value: "order",
		next: {
			value: Oid
			next: {
				value: "" | "requirements" | "quotation" | "sampling" | "freight"
			} |
			{
				value: "contract",
				next: {
					value: Oid
				}
			}
		}
	} |
	{
		value: "projects",
	} |
	{
		value: "correspondence-dashboard",
		next:
		{
			value: "mailchains",
			next: {
				value: "mailchainOid",
				next: {
					value: Oid
				}
			}
		} |
		{
			value: "unlinked-emails",
			next: {
				value: "emailOid",
				next: {
					value: Oid
				}
			}
		}
	}
};
\`\`\`

For example,

\`\`\`none
/buyer/order/abcdsfds123123/contract/6dsf456sd6f4s
\`\`\`

is among the possible choices.

Let's define the following \`type\`:

### Define Custom Type of Tuples from the Schema

\`\`\`js
type RouteBreakdown<T> =
	T extends { value: infer U, next: infer V } ? [U, ...RouteBreakdown<V>] :
	T extends { value: infer U } ? [U] :
	never

export type ClientNavigation = RouteBreakdown<NavigationRouteSchema>;
\`\`\`

Then by hovering \`ClientNavigation\`:

\`\`\`none
type ClientNavigation = ["/buyer" | "/supplier", "order", string, "" | "requirements" |
"quotation" | "sampling" | "freight"] | ["/buyer" | "/supplier", "order", string, "contract",
string] | [...] | [...] | [...]
\`\`\`

which consists of all possible tuples of \`values\` in our \`NavigationRouteSchema\` with correct sequential order.

### Construct Navigation Route with ZERO Chance of Making Mistake

Now we define

\`\`\`js
const getNavigationRoute = (...args: ClientNavigation) => {
  return args.join("/");
};
\`\`\`

which simply assembles the values into a correct URL for navigation.

- We are 100% confident that our path is correct without hard-coding. Why?
- First all value can be auto-completed:

  ![](/assets/tech/173/002.png)

- Any route that is not among our **_tuple of string-types_** will trigger an error:

  ![](/assets/tech/173/003.png)

- Apart from auto-complete suggestions, there will also be a pop-up indicating the type at the current positional argument:

  ![](/assets/tech/173/004.png)

- From now on any **_change of routes_** requirement becomes extremely trivial!
`;export{t as default};
