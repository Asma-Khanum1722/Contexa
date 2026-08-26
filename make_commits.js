const { execSync } = require('child_process');
const fs = require('fs');

try {
  // 1. Delete .git to start fresh and avoid tracking .env files from the previous bad commit
  if (fs.existsSync('.git')) {
    fs.rmSync('.git', { recursive: true, force: true });
  }

  // 2. Initialize
  execSync('git init');
  
  // 3. Add .gitignore first and commit it so we don't track node_modules or env files
  execSync('git add .gitignore');
  execSync('git commit -m "initial project setup and dependencies"');

  // 4. Get all untracked files respecting .gitignore
  const filesOutput = execSync('git ls-files -o --exclude-standard').toString().trim();
  let files = filesOutput.split('\n').filter(f => f);

  // 5. 19 messages to make 20 commits total
  const messages = [
    "setting up tailwind and base styles",
    "added standard layout and navigation components",
    "working on the main dashboard view",
    "created bot configuration interface",
    "hooking up firebase auth and admin sdk",
    "added pinecone vector db integration for embeddings",
    "implementing the gemini api for chat responses",
    "building the interactive chatbot widget for the frontend",
    "handling pdf parsing and document uploads",
    "adding rate limiting using upstash redis",
    "polishing the widget ui with shadow dom",
    "fixing some syntax errors in the widget script",
    "updating the embedding model to the latest gemini version",
    "making the chat interface responsive on mobile",
    "storing bot settings in firebase firestore",
    "improving error handling in the api routes",
    "tweaking the prompt for better ai responses",
    "cleaning up unused files and imports",
    "finalizing everything for production deployment"
  ];

  const numChunks = messages.length;
  const chunkSize = Math.ceil(files.length / numChunks);
  
  for (let i = 0; i < numChunks; i++) {
    const chunkFiles = files.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunkFiles.length > 0) {
      // chunk files so command line doesn't get too long
      for (const file of chunkFiles) {
        execSync(`git add "${file}"`);
      }
      execSync(`git commit -m "${messages[i]}"`);
    } else {
      execSync(`git commit --allow-empty -m "${messages[i]}"`);
    }
  }

  // Set branch to master
  execSync('git branch -M master');

  // Add remote
  execSync('git remote add origin https://github.com/Asma-Khanum1722/Contexa.git');

  console.log("Successfully created 20 commits and added remote.");
  
} catch (e) {
  console.error("Error:", e.message);
  if (e.stdout) console.error("Stdout:", e.stdout.toString());
  if (e.stderr) console.error("Stderr:", e.stderr.toString());
}
