import * as fs from "fs";

// load env
const env = fs.readFileSync(".env.local", "utf-8");
const keyMatch = env.match(/GEMINI_API_KEY=(.*)/);
const key = keyMatch ? keyMatch[1].trim() : "";

async function run() {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + key);
    const data = await res.json();
    console.log(data.models.map((m: any) => m.name).filter((name: string) => name.includes("embed")));
  } catch (e: any) {
    console.error(e.message);
  }
}

run();
