// Replace this with your Render backend URL after deployment.
const API_BASE_URL = "https://glow-coach.onrender.com";

const authScreen = document.getElementById("auth-screen");
const onboardingScreen = document.getElementById("onboarding-screen");
const chatScreen = document.getElementById("chat-screen");
const logoutBtn = document.getElementById("logout-btn");

const authError = document.getElementById("auth-error");
const onboardingError = document.getElementById("onboarding-error");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const registerBtn = document.getElementById("register-btn");
const loginBtn = document.getElementById("login-btn");

const mainGoalInput = document.getElementById("main-goal");
const struggleInput = document.getElementById("struggle");
const styleInput = document.getElementById("style");
const focusAreaInput = document.getElementById("focus-area");
const saveOnboardingBtn = document.getElementById("save-onboarding-btn");
const skipOnboardingBtn = document.getElementById("skip-onboarding-btn");

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const chatBox = document.getElementById("chat-box");
const subtitle = document.getElementById("subtitle");
const profileSummary = document.getElementById("profile-summary");

const moodInput = document.getElementById("mood");
const energyInput = document.getElementById("energy");
const focusInput = document.getElementById("focus");
const checkinNoteInput = document.getElementById("checkin-note");
const checkinBtn = document.getElementById("checkin-btn");
const checkinStatus = document.getElementById("checkin-status");

let token = localStorage.getItem("glowcoach_token") || "";
let currentUser = JSON.parse(localStorage.getItem("glowcoach_user") || "null");

function hideAllScreens() {
  authScreen.classList.add("hidden");
  onboardingScreen.classList.add("hidden");
  chatScreen.classList.add("hidden");
}

function showAuth() {
  hideAllScreens();
  authScreen.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  subtitle.textContent = "Your motivational AI partner.";
}

function showOnboarding() {
  hideAllScreens();
  onboardingScreen.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
}

function showChat() {
  hideAllScreens();
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

    showOnboarding();
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

async function saveOnboarding() {
  onboardingError.textContent = "";

  try {
    await apiRequest("/api/onboarding", {
      method: "POST",
      body: JSON.stringify({
        mainGoal: mainGoalInput.value.trim(),
        struggle: struggleInput.value.trim(),
        style: styleInput.value,
        focusArea: focusAreaInput.value
      })
    });

    showChat();
  } catch (error) {
    onboardingError.textContent = error.message;
  }
}

async function loadProfile() {
  try {
    const data = await apiRequest("/api/me");
    const memoryCount = data.profile?.memories?.length || 0;
    const goalCount = data.profile?.goals?.length || 0;
    const checkinCount = data.profile?.checkins?.length || 0;

    profileSummary.textContent =
      `Saved ${memoryCount} personal notes, ${goalCount} goals, and ${checkinCount} recent check-ins.`;
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

async function saveCheckin() {
  checkinStatus.textContent = "";

  try {
    await apiRequest("/api/checkin", {
      method: "POST",
      body: JSON.stringify({
        mood: moodInput.value,
        energy: energyInput.value,
        focus: focusInput.value,
        note: checkinNoteInput.value.trim()
      })
    });

    checkinStatus.textContent = "Check-in saved.";
    checkinNoteInput.value = "";
    loadProfile();
  } catch (error) {
    checkinStatus.textContent = error.message;
  }
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
saveOnboardingBtn.addEventListener("click", saveOnboarding);
skipOnboardingBtn.addEventListener("click", showChat);
checkinBtn.addEventListener("click", saveCheckin);

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
