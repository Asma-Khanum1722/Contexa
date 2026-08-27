const { initializeApp } = require("firebase-admin/app");
try {
  const app = initializeApp({ projectId: "fir-e2bdf" });
  console.log("Initialized successfully");
} catch (e) {
  console.error("Error initializing:", e);
}
