const API_URL = "https://glow-coach.onrender.com/chat";

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chatBox = document.getElementById("chat-box");

function addMessage(sender, text, className) {
  const div = document.createElement("div");
  div.className = `message ${className}`;
  div.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  addMessage("You", message, "user");
  input.value = "";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message
      })
    });

    const data = await response.json();

    addMessage(
      "GlowCoach",
      data.reply || "I’m here for you.",
      "coach"
    );
  } catch (error) {
    addMessage(
      "GlowCoach",
      "I couldn’t connect to the backend.",
      "coach"
    );
  }
});
