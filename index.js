import express from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import chalk from "chalk";

// ===== Telegram =====
const TELEGRAM_TOKEN = "7526587942:AAFysM7AuOD2Jg0Nc3PtvyDMYzNYmMyvPjE";
const TELEGRAM_CHAT_ID = "7413876187";
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// ===== Express =====
const app = express();
const PORT = 3000;
app.use(bodyParser.json());

// ===== Data storage =====
const reports = {}; // reportId -> { sender, chat, date, replied, kickHistory: [], kickPlayer, reason }

// ===== Endpoint Roblox -> Node.js =====
app.post("/chat", (req, res) => {
  const { sender, chat } = req.body;
  if (!sender || !chat) return res.status(400).send("Data tidak lengkap");

  const reportId = Date.now().toString();
  const date = new Date().toLocaleString();
  reports[reportId] = { sender, chat, date, replied: false, kickHistory: [] };

  // Kirim ke Telegram
  const telegramMessage =
`📢 ADA REPORT DARI PLAYER
*ID:* ${reportId}
*Sender:* ${sender}
*Chat:* ${chat}
*Date:* ${date}`;
  bot.sendMessage(TELEGRAM_CHAT_ID, telegramMessage, { parse_mode: "Markdown" });

  // Console log
  console.log(chalk.cyan("────────────────────────────"));
  console.log(chalk.cyan("Sender : ") + chalk.yellow(sender));
  console.log(chalk.cyan("Chat   : ") + chalk.yellow(chat));
  console.log(chalk.cyan("ID     : ") + chalk.yellow(reportId));
  console.log(chalk.cyan("Date   : ") + chalk.yellow(date));
  console.log(chalk.cyan("────────────────────────────"));

  res.send({ reportId });
});

// ===== Admin balas via Telegram =====
bot.onText(/\/r (.+)/, (msg, match) => {
  const [reportId, replyText] = match[1].split("|");
  const report = reports[reportId];

  if (!report) return bot.sendMessage(msg.chat.id, "❌ Report ID tidak ditemukan!");
  if (report.replied) return bot.sendMessage(msg.chat.id, "❌ Report sudah dibalas sebelumnya!");

  report.replied = true;
  report.replyText = replyText;

  bot.sendMessage(msg.chat.id, `✅ Balasan terkirim ke ${report.sender}`);
});

// ===== Admin kick via Telegram =====
bot.onText(/\/kick (.+)/, (msg, match) => {
  const [targetUsername, reportId, reason] = match[1].split("|");
  const report = reports[reportId];

  if (!report) return bot.sendMessage(msg.chat.id, "❌ Report ID tidak ditemukan!");
  report.kickHistory = report.kickHistory || [];
  if (report.kickHistory.includes(targetUsername)) return bot.sendMessage(msg.chat.id, "❌ Player sudah di-kick untuk report ini!");

  // simpan kick
  report.kickHistory.push(targetUsername);
  report.kickPlayer = targetUsername;
  report.reason = reason;

  bot.sendMessage(msg.chat.id, `✅ Player ${targetUsername} siap di-kick. Report ID: ${reportId}`);
});

// ===== Roblox polling balasan =====
app.get("/getReplies/:playerName", (req, res) => {
  const playerName = req.params.playerName;
  const playerReplies = [];

  for (const id in reports) {
    const r = reports[id];
    if (r.sender === playerName && r.replied && r.replyText) {
      playerReplies.push({ reportId: id, reply: r.replyText });
      r.replied = false; // hapus setelah dikirim
    }
  }

  res.json(playerReplies);
});

// ===== Roblox polling kick =====
app.get("/getKick/:playerName", (req, res) => {
  const playerName = req.params.playerName;
  let kickData = null;

  for (const id in reports) {
    const r = reports[id];
    if (r.kickPlayer === playerName && r.reason) {
      kickData = { reportId: id, reason: r.reason };
      r.kickPlayer = null; // reset setelah dikirim
      break;
    }
  }

  res.json(kickData);
});

app.listen(PORT, () => console.log(chalk.green(`BOT ON at http://localhost:${PORT}`)));
