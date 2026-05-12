const API_URL = "https://glow-coach.onrender.com/api/chat";

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chatBox = document.getElementById("chat-box");

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function addMessage(sender, text, className) {
  const div = document.createElement("div");
  div.className = `message ${className}`;
  div.innerHTML = `<strong>${escapeHtml(sender)}:</strong> ${escapeHtml(text)}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  addMessage("You", message, "user");
  input.value = "";
  addMessage("GlowCoach", "Thinking...", "coach");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    chatBox.lastChild.remove();

    if (!response.ok) {
      addMessage("GlowCoach", data.error || "Backend error.", "coach");
      return;
    }

    addMessage("GlowCoach", data.reply || "I’m here for you.", "coach");
  } catch (error) {
    chatBox.lastChild.remove();
    addMessage("GlowCoach", "I couldn’t connect to the backend. Check your Render URL and redeploy.", "coach");
  }
});
