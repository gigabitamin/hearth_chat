from openai import OpenAI
import os
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

models = client.models.list()
for m in models.data:
    print(m.id)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "테스트"}]
)
print(response.choices[0].message.content)


