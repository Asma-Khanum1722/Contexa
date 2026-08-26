import urllib.request
import json
import re

with open(".env.local", "r") as f:
    env = f.read()

key_match = re.search(r"GEMINI_API_KEY=(.*)", env)
key = key_match.group(1).strip() if key_match else ""

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    models = [m['name'] for m in data['models']]
    print("All models:", ", ".join(models))
    print("text-embedding models:", ", ".join([n for n in models if "text-embedding" in n]))
