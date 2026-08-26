import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";

// load env
const env = fs.readFileSync(".env.local", "utf-8");
const keyMatch = env.match(/GEMINI_API_KEY=(.*)/);
const key = keyMatch ? keyMatch[1].trim() : "";

const genAI = new GoogleGenerativeAI(key);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const res = await model.embedContent("Hello world");
    console.log("Success:", res.embedding.values.slice(0, 5));
  } catch (e: any) {
    console.error("Error gemini-embedding-2:", e.message);
  }
}

run();
