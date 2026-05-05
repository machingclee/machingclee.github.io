const e=`---
title: "MCP Course Week 1: OpenAI Model via Azure, Clients and \\"Raw\\" Tools"
date: 2025-11-19
id: blog0436
tag: python, llm, ai
toc: true
intro: Record the openai package api for using openai models via azure endpoints
img: /assets/img/2025-11-30-11-00-27.png
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

### \`openai.AzureOpenAI\`: Deploy an LLM Model via Azure 
#### Signature to Instantiate an \`AzureOpenAI\` model
To instantiate an \`openai\` instance we need:

\`\`\`python
from dotenv import load_dotenv
from openai import AzureOpenAI
import os

load_dotenv(override=True)

client = AzureOpenAI(
    api_key=os.getenv("AZURE_API_KEY"),
    api_version=,
    azure_endpoint=,
)
\`\`\`
both \`api_version\` and \`azure_endpoint\` can be obtained after deploying a model successfully, let's see how we do it:


#### Steps to Obtain Deployed Model and Necessary Credentials

We go through the following steps:

1. Go to azure cloud service portal
2. Select ***Azure OpenAI*** service:

    ![](/assets/img/2025-11-16-22-03-34.png)
3. Click on the newly created project, and then go to Overview:

    ![](/assets/img/2025-11-16-22-04-35.png)
4. Click on ***Explore Azure AI Foundry Portal*** for a complete list of models:

    [![](/assets/img/2025-11-16-22-05-23.png)](/assets/img/2025-11-16-22-05-23.png)

5. We get a bunch of models:

    [![](/assets/img/2025-11-15-23-17-28.png)](/assets/img/2025-11-15-23-17-28.png)

6. Choose a model and click ***Use this model***:

    ![](/assets/img/2025-11-15-23-19-47.png)

7. Now deploy a model (the charging scheme bases on \`Deployment type\`, in standard type you cost nothing after deployment if you never use it):

    ![](/assets/img/2025-11-15-23-20-37.png)

8. After deployment we are provided a target URI 

    ![](/assets/img/2025-11-15-23-30-05.png)

    the full value is:

    <Example>

    https://shellscriptmanager.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview

    </Example>

    From this we can fill up our client definition:

    \`\`\`py
    import os
    from openai import AzureOpenAI
    from dotenv import load_dotenv

    load_dotenv(override=True)

    client = AzureOpenAI(
        api_key=os.getenv("AZURE_API_KEY"),
        api_version="2025-01-01-preview",
        azure_endpoint="https://shellscriptmanager.openai.azure.com"
    )
    \`\`\`

9. By the way we can get the \`AZURE_API_KEY\` from the ***Home*** page.

    [![](/assets/img/2025-11-16-22-10-24.png)](/assets/img/2025-11-16-22-10-24.png)



### Chat Client
#### Simple Chat Demonstration
Let's test a simple conversation with our chat model:

\`\`\`py
messages = [{"role": "user", "content": "What is 2+2?"}]
response = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=messages
)
print(response.choices[0].message.content)
\`\`\`
From this we get:

![](/assets/img/2025-11-15-23-45-18.png)

#### System Prompt and User Prompt

For a chat client there are two kinds of prompt to control the behaviour of a chat model:

- The ***system prompt*** is intended to be more the overall instructions that sets the context for the task.

- The ***user prompt*** is the actual question coming from the user.


#### Example: Read my Resume (pdf format) and answer the Question in that Resume
##### Preparation for Background Data 
Let's load our resume (in pdf format) into texts:

\`\`\`py
from pypdf import PdfReader

reader = PdfReader("me/james_lee.pdf")
linkedin = ""
for page in reader.pages:
    text = page.extract_text()
    if text:
        linkedin += text

with open("me/summary.txt", "r", encoding="utf-8") as f:
    summary = f.read()

name = "James Lee"
\`\`\`
This prepares the varibles \`linkedin\`, \`summary\` and \`name\`.

##### Preparation for System Prompt
\`\`\`py
system_prompt = f"""
You are acting as {name}. You are answering questions on {name}'s website,
particularly questions related to {name}'s career, background, skills and experience.
Your responsibility is to represent {name} for interactions on the website as faithfully as possible.
You are given a summary of {name}'s background and LinkedIn profile which you can use to answer questions.
Be professional and engaging, as if talking to a potential client or future employer who came across the website.
If you don't know the answer, say so.
"""

system_prompt += f"\\n\\n## Summary:\\n{summary}\\n\\n## LinkedIn Profile:\\n{linkedin}\\n\\n"
system_prompt += f"With this context, please chat with the user, always staying in character as {name}."
\`\`\`


##### Inject User chat Message as a User Prompt {#injection}

\`\`\`py
def chat_to_gpt4mini(messages):
    client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=messages
    )

def chat(message, history):
    messages = [{"role": "system", "content": system_prompt}] \\
                + history \\
                + [{"role": "user", "content": message}]
    response = chat_to_gpt4mini(messages)
    return response.choices[0].message.content
\`\`\`

##### Chat UI via \`gradio\` {#gradio}


\`\`\`python
import gradio as gr

gr.ChatInterface(chat, type="messages").launch()
\`\`\`
We got a chat interface:

![](/assets/img/2025-11-16-15-40-06.png)


\`gradio\` will instantiate an empty list \`history = []\` for us and update the history of our conversation by mutating the \`history object\`.


##### Example of Asking the Detail in my CV:

[![](/assets/img/2025-11-16-15-46-31.png)](/assets/img/2025-11-16-15-46-31.png)


#### Define Schema for Chat Client's Response via \`pydantic\`

We can define the schema of the response from LLM using \`response_format\` (which we also use extensively in \`FastAPI\`):
\`\`\`py
from pydantic import BaseModel

class Evaluation(BaseModel):
    is_acceptable: bool
    feedback: str
\`\`\`

Now we can put constraint on the response schema via:

\`\`\`py{5}
# note it is parse(), not create()
response = client.chat.completions.parse(
    model="gpt-4.1-mini",
    messages=messages,
    response_format=Evaluation
)
result = response.fhoices[0].message.parsed
\`\`\`


#### System Prompt can be Dynamic



Note that system prompt can be changed according to the incoming message before we push the data to  the LLM for answer:

\`\`\`python
def chat(message, history):
    if "patent" in message:
        system = system_prompt + "\\n\\nEverything in your reply needs to be in pig latin - \\
              it is mandatory that you respond only and entirely in pig latin"
    else:
        system = system_prompt
    // the updated system prompt:
    messages = [{"role": "system", "content": system}] \\
                + history \\
                + [{"role": "user", "content": message}]
    response = openai.chat.completions.create(model="gpt-4o-mini", messages=messages)
    reply =response.choices[0].message.content

    # we evalute the resposne via another model:
    evaluation = evaluate(reply, message, history)
    
    if evaluation.is_acceptable:
        print("Passed evaluation - returning reply")
    else:
        print("Failed evaluation - retrying")
        print(evaluation.feedback)
        reply = rerun(reply, message, history, evaluation.feedback)       
    return reply
\`\`\`
We are free the ***prepend*** any adjusted system prompt to \`messages\` and inject it into our chat client.

When we need to \`rerun\` the flow, we adjust the system prompt again in \`rerun\`:
\`\`\`py
def evaluate(reply, message, history) -> Evaluation:
    # sytesm prompt: provide the rule for the evluation:
    messages = [{"role": "system", "content": evaluator_system_prompt}] \\
    # user prompt: provide the data for the evaluation, ask the chat client to evalute this as well
    + [{"role": "user", "content": evaluator_user_prompt(reply, message, history)}]
    response = gemini.beta.chat.completions.parse(model="gemini-2.0-flash", messages=messages, response_format=Evaluation)
    return response.choices[0].message.parsed

def rerun(reply, message, history, feedback):
    updated_system_prompt = system_prompt + "\\n\\n## Previous answer rejected\\nYou just tried to reply, but the quality control rejected your reply\\n"
    updated_system_prompt += f"## Your attempted answer:\\n{reply}\\n\\n"
    updated_system_prompt += f"## Reason for rejection:\\n{feedback}\\n\\n"
    messages = [{"role": "system", "content": updated_system_prompt}] + history + [{"role": "user", "content": message}]
    response = openai.chat.completions.create(model="gpt-4o-mini", messages=messages)
    return response.choices[0].message.content
\`\`\`


### Agents and Tools


This part is now replaced my \`MCP\`, but we leave a record here to understand what's happening under the hood.

The purpose of this section is to explain how complex is bringing tools into the applications and thus why we need MCP for the abstraction.

#### Define Tools
Usually we define \`tool\`s as ordinary functions:

\`\`\`py
def record_user_details(email, name="Name not provided", notes="not provided"):
    push(f"Recording interest from {name} with email {email} and notes {notes}")
    return {"recorded": "ok"}

def record_unknown_question(question):
    push(f"Recording {question} asked that I couldn't answer")
    return {"recorded": "ok"}
\`\`\`

Next we define the \`metadata\` for the tools so that our chat client can  grab the right choice(s) based on their descriptions and the user prompt (i.e., user message):

\`\`\`py
record_user_details_json = {
    "name": "record_user_details",
    "description": "Use this tool to record that a user is interested in being in touch and provided an email address",
    "parameters": {
        "type": "object",
        "properties": {
            "email": {
                "type": "string",
                "description": "The email address of this user"
            },
            "name": {
                "type": "string",
                "description": "The user's name, if they provided it"
            }
            ,
            "notes": {
                "type": "string",
                "description": "Any additional information about the conversation that's worth recording to give context"
            }
        },
        "required": ["email"],
        "additionalProperties": False
    }
}

record_unknown_question_json = {
    "name": "record_unknown_question",
    "description": "Always use this tool to record any question that couldn't be answered as you didn't know the answer",
    "parameters": {
        "type": "object",
        "properties": {
            "question": {
                "type": "string",
                "description": "The question that couldn't be answered"
            },
        },
        "required": ["question"],
        "additionalProperties": False
    }
}
\`\`\`

We combine the definitions to get:
\`\`\`py
tools = [{"type": "function", "function": record_user_details_json},
        {"type": "function", "function": record_unknown_question_json}]
\`\`\`

#### Apply the Tools

And finally we apply the tools via the following code executions.

Be sure to understand 
- [#injection] and 
- [#gradio]

as we apply the same chat UI:

\`\`\`py
def handle_tool_calls(tool_calls):
    results = []
    for tool_call in tool_calls:
        tool_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)
        print(f"Tool called: {tool_name}", flush=True)
        tool = globals().get(tool_name)
        result = tool(**arguments) if tool else {}
        results.append({"role": "tool","content": json.dumps(result),"tool_call_id": tool_call.id})
    return results

def chat(message, history):
    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]
    done = False
    while not done:

        # This is the call to the LLM - see that we pass in the tools json
        response = client.chat.completions.create(
            model="gpt-4.1-mini", messages=messages, tools=tools)

        finish_reason = response.choices[0].finish_reason
        
        # If the LLM wants to call a tool, we do that!
        if finish_reason=="tool_calls":
            message = response.choices[0].message
            tool_calls = message.tool_calls
            results = handle_tool_calls(tool_calls)
            messages.append(message)
            messages.extend(results)
        else:
            done = True
    return response.choices[0].message.content
\`\`\`

Bringing tools into chat client is so tedious, complex and not maintainable, and the advent of MCP now simplifies the tooling process.


### Reference

- Ed Donner, [*AI Engineer Agentic Track: The Complete Agent & MCP Course*](https://www.udemy.com/course/the-complete-agentic-ai-engineering-course), Udemy`;export{e as default};
