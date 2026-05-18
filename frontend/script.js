// Replace this with your actual Render backend URL if different.
const API_BASE_URL = "https://glow-coach.onrender.com";

const authScreen = document.getElementById("auth-screen");
const chatScreen = document.getElementById("chat-screen");
const logoutBtn = document.getElementById("logout-btn");
const authError = document.getElementById("auth-error");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const registerBtn = document.getElementById("register-btn");
const loginBtn = document.getElementById("login-btn");

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chatBox = document.getElementById("chat-box");
const subtitle = document.getElementById("subtitle");
const profileSummary = document.getElementById("profile-summary");

let token = localStorage.getItem("glowcoach_token") || "";
let currentUser = JSON.parse(localStorage.getItem("glowcoach_user") || "null");

function showAuth() {
  authScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

function showChat() {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");

  if (currentUser?.name) {
    subtitle.textContent = `Welcome back, ${currentUser.name}.`;
  }

  loadProfile();
  loadHistory();
}

function addMessage(sender, text, className) {
  const div = document.createElement("div");
  div.className = `message ${className}`;
  div.textContent = `${sender}: ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function register() {
  authError.textContent = "";

  try {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value
      })
    });

    token = data.token;
    currentUser = data.user;

    localStorage.setItem("glowcoach_token", token);
    localStorage.setItem("glowcoach_user", JSON.stringify(currentUser));

    showChat();
  } catch (error) {
    authError.textContent = error.message;
  }
}

async function login() {
  authError.textContent = "";

  try {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value
      })
    });

    token = data.token;
    currentUser = data.user;

    localStorage.setItem("glowcoach_token", token);
    localStorage.setItem("glowcoach_user", JSON.stringify(currentUser));

    showChat();
  } catch (error) {
    authError.textContent = error.message;
  }
}

async function loadProfile() {
  try {
    const data = await apiRequest("/api/me");
    const memoryCount = data.profile?.memories?.length || 0;
    const goalCount = data.profile?.goals?.length || 0;

    profileSummary.textContent =
      `GlowCoach has saved ${memoryCount} personal notes and ${goalCount} goals to personalize your coaching.`;
  } catch {
    profileSummary.textContent = "GlowCoach will build this as you chat.";
  }
}

async function loadHistory() {
  try {
    const data = await apiRequest("/api/chat/history");

    if (data.messages?.length) {
      chatBox.innerHTML = "";
      data.messages.forEach(msg => {
        addMessage(
          msg.role === "user" ? "You" : "GlowCoach",
          msg.content,
          msg.role === "user" ? "user" : "coach"
        );
      });
    }
  } catch {}
}

async function sendMessage(message) {
  const data = await apiRequest("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message })
  });

  return data.reply;
}

registerBtn.addEventListener("click", register);
loginBtn.addEventListener("click", login);

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("glowcoach_token");
  localStorage.removeItem("glowcoach_user");
  token = "";
  currentUser = null;
  showAuth();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = input.value.trim();
  if (!message) return;

  addMessage("You", message, "user");
  input.value = "";

  try {
    addMessage("GlowCoach", "Thinking...", "coach");
    const thinkingBubble = chatBox.lastChild;
    const reply = await sendMessage(message);
    thinkingBubble.textContent = `GlowCoach: ${reply}`;
    loadProfile();
  } catch (error) {
    addMessage("GlowCoach", error.message || "I couldn’t connect to the backend.", "coach");
  }
});

if (token) showChat();
else showAuth();
