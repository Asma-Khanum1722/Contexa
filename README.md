# Contexa AI

Contexa is a powerful AI chatbot platform built to seamlessly integrate with your custom knowledge base. By utilizing Retrieval-Augmented Generation (RAG), Contexa allows you to upload documents and instantly create a smart, embeddable chatbot for any website.

## Features

* **Custom Knowledge Base:** Upload PDF documents or text to train your bot on your specific business data.
* **Embeddable Widget:** Generate a lightweight script tag to embed your trained chatbot on any third-party website.
* **Vector Search:** Powered by Pinecone vector database for highly accurate context retrieval.
* **Advanced AI Responses:** Integrated with Google Gemini for natural and intelligent conversation.
* **Modern Dashboard:** Built with Next.js and Tailwind CSS for a seamless user experience.
* **Secure Authentication:** Utilizes Firebase Authentication to protect user data and bot configurations.

## Tech Stack

* **Frontend:** Next.js, React, Tailwind CSS
* **Backend:** Next.js API Routes, Firebase Admin SDK
* **AI & Embeddings:** Google Generative AI (Gemini)
* **Database:** Pinecone Vector Database, Firebase Firestore
* **Rate Limiting:** Upstash Redis

## Getting Started

### Prerequisites

You will need the following API keys and credentials to run Contexa locally:
* Firebase Admin Service Account JSON
* Google Gemini API Key
* Pinecone API Key
* Upstash Redis REST URL and Token

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure your environment variables:
   Copy `.env.local.example` to `.env.local` and fill in your credentials.

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

## Deployment

Contexa is designed to be easily deployed on Vercel. 
1. Link your GitHub repository to Vercel.
2. Copy the contents of your `.env.local` file into the Vercel Environment Variables settings.
3. Deploy the application.

## Usage

After logging in, you can create a new bot from the dashboard. Upload your reference documents, customize the appearance of your bot, and copy the provided `<script>` tag. Paste this tag just before the closing `</body>` tag on any website to deploy your chatbot.
