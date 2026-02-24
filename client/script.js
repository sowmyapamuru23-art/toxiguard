const socket = io("http://localhost:3000");

const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("message");
const warning = document.getElementById("warning");

function sendMessage() {
  const msg = messageInput.value;
  if (msg.trim() === "") return;

  socket.emit("chatMessage", msg);
  messageInput.value = "";
}

socket.on("chatMessage", (msg) => {
  const p = document.createElement("p");
  p.textContent = msg;
  chatBox.appendChild(p);
  warning.textContent = "";
});

socket.on("warning", (msg) => {
  warning.textContent = msg;
  warning.style.color = "red";
});
