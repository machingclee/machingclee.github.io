---
title: Agents
date: 2025-11-17
id: blog0437
tag: python, llm, ai
toc: true
intro: Record the openai package api for using openai models via azure endpoints
img: python
wip: true
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


```py
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

# Create agent with Azure model
agent = Agent(
    name="Jokester", 
    instructions="You are a joke teller", 
    model=azure_model
)

with trace("Telling a joke"):
    result = await Runner.run(agent, "Tell a joke about Autonomous AI Agents")
    print(result.final_output)
```
`instructions` is in essence the system prompt.


Stream results from agent:

```py
result = Runner.run_streamed(sales_agent1, input="Write a cold sales email")
async for event in result.stream_events():
    if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
        print(event.data.delta, end="", flush=True)
```        