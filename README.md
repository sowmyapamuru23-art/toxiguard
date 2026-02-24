# ToxiGuard 🛡️ — Real-Time Chat with Toxic Message Detection

> Academic Mini-Project | Node.js · Express · Socket.io · MySQL · JWT · Bootstrap

---

## 📁 Project Structure (MVC)

```
ToxiGuard/
├── config/db.js              # MySQL connection (db4free.net)
├── controllers/authController.js
├── middleware/auth.js         # JWT verification
├── models/Message.js
├── routes/auth.js             # POST /register, /login
├── routes/chat.js             # GET /messages
├── socket/chatSocket.js       # Real-time + toxicity + blocking
├── utils/toxicityDetector.js  # NLP keyword engine
├── public/                    # Frontend (HTML, CSS, JS)
│   ├── login.html
│   ├── register.html
│   ├── chat.html
│   ├── style.css
│   ├── auth.js
│   └── chat.js
├── schema.sql                 # DB setup
├── .env                       # Your credentials (never commit!)
└── server.js                  # Entry point
```

---

## ⚙️ Setup Instructions

### Step 1 — Create Free Online MySQL Database

1. Go to **[https://db4free.net](https://db4free.net)** → Sign Up
2. Fill: Username, Password, Database Name, Email
3. Verify email
4. Go to **[phpMyAdmin](https://www.db4free.net/phpMyAdmin/)** → select your database
5. Click **SQL** tab → paste the content of `schema.sql` → click **Go**

### Step 2 — Configure Environment

Edit the `.env` file with your db4free.net credentials:

```env
DB_HOST=db4free.net
DB_PORT=3306
DB_USER=your_username
DB_PASS=your_password
DB_NAME=your_database
JWT_SECRET=any_long_random_string
```

### Step 3 — Install Dependencies

```bash
cd "C:\Users\sowmy\OneDrive\Desktop\Toxic-Chat-App"
npm install
```

### Step 4 — Run the App

```bash
node server.js
```

Open browser → **[http://localhost:3000](http://localhost:3000)**

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| 🔐 Auth | JWT login/register with bcrypt password hashing |
| 💬 Real-time Chat | Socket.io global room with timestamps |
| 🛡️ Toxicity Detection | 6-category NLP keyword engine (no APIs) |
| ⚠️ Warning Toast | Instant animated alert for blocked messages |
| 🚫 User Blocking | Banned after 3 toxic messages |
| 🗄️ DB Persistence | All messages stored (safe + toxic flagged) |

## 🧠 Toxicity Categories

1. **Toxic** — insults, put-downs
2. **Severe Toxic** — extreme hate language
3. **Insult** — direct abuse phrases
4. **Threat** — violent/threatening phrases (e.g., "I will kill you")
5. **Obscene** — profanity
6. **Identity Hate** — slurs targeting race, religion, gender

## 🚫 Blocking System

- Strike 1 → Warning toast shown
- Strike 2 → Warning + red strike counter in sidebar
- Strike 3 → **BANNED**: full block screen, socket disconnected, user blocked for session

---

## 💻 Tech Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Database**: MySQL (via db4free.net, online/free)
- **Auth**: JWT + bcrypt
- **Frontend**: Vanilla JS, CSS (dark theme), Bootstrap 5
- **NLP**: Custom keyword-based toxicity detector
