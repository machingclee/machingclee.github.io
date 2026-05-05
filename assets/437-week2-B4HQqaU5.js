const e=`---
title: "MCP Course Week 2: Agents, Tools, Handoff and Guardrails"
date: 2025-11-22
id: blog0437
tag: python, llm, ai
toc: true
intro: Record the openai package api for using openai models via azure endpoints
img: /assets/img/2025-11-30-10-52-40.png
scale: 1
offsety: -10
---

<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
</style>

### Agents in Place of Client API
#### What we did in the past ...
\`openai\` has abstracted the \`client\` API model and enriched many functionalities into the original LLM API, which is now known as \`Agent\`. 



Nowadays we ***don't*** do the following any more:
\`\`\`py
client.chat.completions.create(model="gpt-4.1-mini", 
                               messages=messages,  
                               tools=tools)
\`\`\`
where \`messages\` are composed of 
1. System prompt
2. Chat history
3. User prompt


#### Define an Agent Instead

For this, we first define the underlying azure LLM model (note that the following code can be highly simplified if we use \`OpenAI\` api key instead of azure):
\`\`\`py
from dotenv import load_dotenv
from agents import Agent, Runner, trace

load_dotenv(override=True)

from openai import AsyncAzureOpenAI
from agents import Agent, OpenAIChatCompletionsModel
import os

# Configure Azure OpenAI client (use Async version)
azure_client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_API_VERSION", "2024-10-21"),  # Use the latest API version
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

# Create a model instance
azure_model = OpenAIChatCompletionsModel(
    model=os.getenv("AZURE_OPENAI_MODEL"),  # Your Azure deployment name
    openai_client=azure_client
)
\`\`\`
Then we can define the \`Agent\`:
\`\`\`py
agent = Agent(
    name="Jokester", 
    instructions="You are a joke teller", 
    model=azure_model
)

with trace("Telling a joke"):
    result = await Runner.run(agent, "Tell a joke about Autonomous AI Agents")
    print(result.final_output)
\`\`\`
- \`instructions\` is in essence the ***system prompt***.
- The argument in \`Runner.run\` is now our ***user prompt***.


#### Results from Agents

##### Streaming Response 


\`\`\`py
result = Runner.run_streamed(sales_agent1, input="Write a cold sales email")

async for event in result.stream_events():
    if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
        print(event.data.delta, end="", flush=True)
\`\`\`        
##### Ordinary Coroutine Response


\`\`\`py
result = await Runner.run(sales_agent1, input="Write a cold sales email")
result.final_output
\`\`\`

### Tools

#### What we did in the past ...

In the past we need to:

1. Define a function
2. Define the metadata of this function in json
3. Provide the metadata to LLM model as \`tools\`
4. According to the result from LLM model, get the right tools, apply the arguments from LLM response

For more detail, please revisit our previous article:
- [3. Apply the Tools](/blog/article/MCP-Course-Week-1-OpenAI-Model-via-Azure-Clients-and-Tools#3.-agents-and-tools)

OpenAI has later provided a simplified solution via a special annotation: 

#### \`@function_tool\`

##### Applied to functions


Assume that we have registered an account in Sendgrid, then we define a simple tool:

\`\`\`py
import sendgrid
import os
from sendgrid.helpers.mail import Mail, Email, To, Content
from agents import Agent, Runner, trace, function_tool

@function_tool
def send_email():
    sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
    from_email = Email("james.lee@wonderbricks.com")  # Change to your verified sender
    to_email = To("machingclee@gmail.com")  # Change to your recipient
    content = Content("text/plain", "This is an important test email")
    mail = Mail(from_email, to_email, "Test email", content).get()
    response = sg.client.mail.send.post(request_body=mail)
    print(response.status_code)
\`\`\`

\`@function_tool\` turns the function \`send_test_egmail\` into something called a \`DataClass\`. Let's plug the  \`send_email\` function into the following:
\`\`\`py-1{4,11}
from dataclasses import is_dataclass, asdict
import json

print(f"Is dataclass? {is_dataclass(send_email)}")

if is_dataclass(send_email):
    # excluding the function for readability
    send_email_dict = asdict(send_email)
    clean_dict = {k: v for k, v in send_email_dict.items() 
              if k != 'on_invoke_tool'}
    print(json.dumps(clean_dict, indent=2))
\`\`\`

For \`print\` on line-4:

\`\`\`text
Is dataclass? True
\`\`\`
For \`print\` on line-11:
\`\`\`json
{
  "name": "send_email",
  "description": "Send out an email with the given body to all sales prospects",
  "params_json_schema": {
    "properties": {
      "body": {
        "title": "Body",
        "type": "string"
      }
    },
    "required": [
      "body"
    ],
    "title": "send_email_args",
    "type": "object",
    "additionalProperties": false
  },
  "strict_json_schema": true,
  "is_enabled": true
}
\`\`\`
This is exactly what we have written in [3. Apply the Tools](/blog/article/MCP-Course-Week-1-OpenAI-Model-via-Azure-Clients-and-Tools#3.-agents-and-tools), and now we can bypass this tedious step as the annotation has done it for us.


##### Applied to agents {#agent_tools_here}

We use tools to let agent inject arguments and get a result. 

We can also inject arguments into an agent (as a user prompt) and get a result, so can an agent be a tool as well?

YES! Let's define 3 agents separately:

\`\`\`python
instructions1 = """
You are a sales agent working for ComplAI,
a company that provides a SaaS tool for ensuring SOC2 compliance and preparing for audits, powered by AI. 
You write professional, serious cold emails.
"""

instructions2 = """
You are a humorous, engaging sales agent working for ComplAI,
a company that provides a SaaS tool for ensuring SOC2 compliance and preparing for audits, powered by AI.
You write witty, engaging cold emails that are likely to get a response.
"""

instructions3 = """
You are a busy sales agent working for ComplAI,
a company that provides a SaaS tool for ensuring SOC2 compliance and preparing for audits, powered by AI.
You write concise, to the point cold emails.
"""

sales_agent1 = Agent(
    name="Professional Sales Agent",
    instructions=instructions1,
    model=azure_model
)       
sales_agent2 = Agent(
    name="Engaging Sales Agent",
    instructions=instructions2,
    model=azure_model
)

sales_agent3 = Agent(
    name="Busy Sales Agent",
    instructions=instructions3,
    model=azure_model
)
\`\`\`

Turn the agents into tools:

\`\`\`py
description = "Write a cold sales email"

agent1_tool = sales_agent1.as_tool(tool_name="sales_agent1", tool_description=description)
agent2_tool = sales_agent2.as_tool(tool_name="sales_agent2", tool_description=description)
agent3_tool = sales_agent3.as_tool(tool_name="sales_agent3", tool_description=description)

agent_tools_to_write_letters = [agent1_tool, agent2_tool, agent3_tool, send_email]
\`\`\`
And finally define another agent to apply these tools:

\`\`\`python
instructions = """
You are a Sales Manager at ComplAI. Your goal is to find the single best cold sales email using the sales_agent tools.
 
Follow these steps carefully:
1. Generate Drafts: Use all three sales_agent tools to generate three different email drafts. Do not proceed until all three drafts are ready.
 
2. Evaluate and Select: Review the drafts and choose the single best email using your judgment of which one is most effective.
 
3. Use the send_email tool to send the best email (and only the best email) to the user.
 
Crucial Rules:
- You must use the sales agent tools to generate the drafts — do not write them yourself.
- You must send ONE email using the send_email tool — never more than one.
"""

sales_manager = Agent(name="Sales Manager",
                      instructions=instructions, 
                      tools=agent_tools_to_write_letters, 
                      model=azure_model)

message = "Send a cold sales email addressed to 'Dear James Lee'"

result = await Runner.run(sales_manager, message)
\`\`\`


### Handoffs

A \`handoff\` is a mechanism to delegate the workflow (with result) to another agent.

Handoffs and Agents-as-tools are similar:

- In both cases, an \`Agent\` can collaborate with another Agent
- With tools, control ***responses back***
- With handoffs, control ***passes forward***

Let's describe a usecase using handoff:

#### Handoff Agent

##### Tools from Agents

\`\`\`py
subject_instructions = """
You can write a subject for a cold sales email.
You are given a message and you need to write a subject for an email that is likely to get a response.
"""

html_instructions = """
You can convert a text email body to an HTML email body.
You are given a text email body which might have some markdown
and you need to convert it to an HTML email body with simple, clear, compelling layout and design.
"""

subject_writer = Agent(name="Email subject writer", instructions=subject_instructions, model=azure_model)
subject_tool = subject_writer.as_tool(tool_name="subject_writer", tool_description="Write a subject for a cold sales email")

html_converter = Agent(name="HTML email body converter", instructions=html_instructions, model=azure_model)
html_tool = html_converter.as_tool(tool_name="html_converter",tool_description="Convert a text email body to an HTML email body")
\`\`\`
##### Tools from Sendgrid
\`\`\`py
@function_tool
def send_html_email(subject: str, html_body: str) -> Dict[str, str]:
    """ Send out an email with the given subject and HTML body to all sales prospects """
    sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
    from_email = Email("james.lee@wonderbricks.com")  # Change to your verified sender
    to_email = To("machingclee@gmail.com")  # Change to your recipient
    content = Content("text/html", html_body)
    mail = Mail(from_email, to_email, subject, content).get()
    sg.client.mail.send.post(request_body=mail)
    return {"status": "success"}
\`\`\`
##### Declare Handoff Agent

\`handoff_description\` is how agent announce itself to the world in case another agent wants to use it.

\`\`\`py
instructions ="""
You are an email formatter and sender. You receive the body of an email to be sent.
You first use the subject_writer tool to write a subject for the email, then use the html_converter tool to convert the body to HTML.
Finally, you use the send_html_email tool to send the email with the subject and HTML body.
"""

emailer_agent = Agent(
    name="Email Manager",
    instructions=instructions,
    tools=[subject_tool, html_tool, send_html_email],
    model=azure_model,
    handoff_description="Convert an email to HTML and send it")
\`\`\`

#### Combine the above, From Agent1 to Handoff Agent
Combining everything above, we have (recall also that we have defined \`agent1_tool\`, \`agent2_tool\` and \`agent3_tool\` in [#agent_tools_here]):

\`\`\`py
sales_manager_instructions = """
You are a Sales Manager at ComplAI. Your goal is to find the single best cold sales email using the sales_agent tools.
 
Follow these steps carefully:
1. Generate Drafts: Use all three sales_agent tools to generate three different email drafts. Do not proceed until all three drafts are ready.
 
2. Evaluate and Select: Review the drafts and choose the single best email using your judgment of which one is most effective.
You can use the tools multiple times if you're not satisfied with the results from the first try.
 
3. Handoff for Sending: Pass ONLY the winning email draft to the 'Email Manager' agent. The Email Manager will take care of formatting and sending.
 
Crucial Rules:
- You must use the sales agent tools to generate the drafts — do not write them yourself.
- You must hand off exactly ONE email to the Email Manager — never more than one.
"""

new_sales_manager = Agent(
    name="Sales Manager",
    instructions=sales_manager_instructions,
    tools=[agent1_tool, agent2_tool, agent3_tool],
    handoffs=[emailer_agent],
    model=azure_model)

message = "Send out a cold sales email addressed to Dear James Lee"

await Runner.run(new_sales_manager, message)
\`\`\`


### Guardrails
#### What is it?
\`Guardrail\` severes as a guard to validate our input and output, which determines whether our flow should continue given an input/output is obtained.

If the answer is no, it will throw an exception to stop our program from proceeding any further.

#### Define Guardrail Agent


\`\`\`py
from agents import Agent, Runner, trace, function_tool, \\
  OpenAIChatCompletionsModel, input_guardrail, GuardrailFunctionOutput

class NameCheckOutput(BaseModel):
    is_name_in_message: bool
    name: str

guardrail_agent = Agent( 
    name="Name check",
    instructions="Check if the user is including someone's personal name in what they want you to do.",
    output_type=NameCheckOutput,
    model="gpt-4o-mini"
)
\`\`\`
#### \`@input_guardrail\`
\`\`\`py
@input_guardrail
async def guardrail_against_name(ctx, agent, message):
    result = await Runner.run(guardrail_agent, message, context=ctx.context)
    is_name_in_message = result.final_output.is_name_in_message
    return GuardrailFunctionOutput(
        output_info={"found_name": result.final_output},
        tripwire_triggered=is_name_in_message
    )
\`\`\`
- \`output_info\` is a custom dictionary output;

- Whereas \`tripwire_triggered\` is the boolean that:
  $$
  \\begin{cases}
  \\texttt{True} & \\text{has problem!}\\\\
  \\texttt{False} & \\text{that's fine}
  \\end{cases}
  $$

#### Apply Guardrail Agent in Input

\`\`\`py{7}
careful_sales_manager = Agent(
    name="Sales Manager",
    instructions=sales_manager_instructions,
    tools=tools,
    handoffs=[emailer_agent],
    model="gpt-4o-mini",
    input_guardrails=[guardrail_against_name]
)

message = "Send out a cold sales email addressed to Dear CEO from Alice"

with trace("Protected Automated SDR"):
    result = await Runner.run(careful_sales_manager, message)
\`\`\`



### Reference

- Ed Donner, [*AI Engineer Agentic Track: The Complete Agent & MCP Course*](https://www.udemy.com/course/the-complete-agentic-ai-engineering-course), Udemy`;export{e as default};
