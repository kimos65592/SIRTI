(function () {
  const CHAT_KEY = "study_jarvis_chat_v1";
  const PREF_KEY = "study_jarvis_prefs_v1";
  const SESSION_KEY = "study_jarvis_sessions_v1";

  const state = {
    section: "home",
    mode: "explain",
    recognition: null,
    listening: false,
    chat: loadChat(),
    prefs: loadPrefs(),
    sessions: loadSessions()
  };

  const $ = (id) => document.getElementById(id);
  const tabs = [...document.querySelectorAll(".tab")];
  const sections = [...document.querySelectorAll(".section")];
  const modeButtons = [...document.querySelectorAll(".mode-btn")];

  function loadChat() {
    try {
      const data = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function saveChat() {
    const compact = state.chat.slice(-30);
    localStorage.setItem(CHAT_KEY, JSON.stringify(compact));
  }

  function loadPrefs() {
    try { return { name: "أحمد", ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}") }; }
    catch (_) { return { name: "أحمد" }; }
  }

  function savePrefs() {
    localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs));
  }

  function loadSessions() {
    try {
      const data = JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function saveSessions() {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.sessions.slice(-300)));
  }

  function todayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDate(value) {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setSection(id) {
    state.section = id;
    tabs.forEach(btn => btn.classList.toggle("active", btn.dataset.section === id));
    sections.forEach(section => section.classList.toggle("active", section.id === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function subjectById(id) {
    return (window.STUDY_SUBJECTS || []).find(subject => subject.id === id);
  }

  function updateHome() {
    const items = ScheduleStore.all().filter(item => item.date === todayKey()).sort(sortSessions);
    $("todaySessions").textContent = String(items.length);
    $("todayMinutes").textContent = `${items.reduce((sum, x) => sum + Number(x.duration || 0), 0)} د`;
    $("prioritySubject").textContent = items[0] ? `${subjectById(items[0].subject)?.icon || "📚"} ${subjectById(items[0].subject)?.name || items[0].subject}` : "—";

    const box = $("todayPlan");
    if (!items.length) {
      box.innerHTML = `<div class="empty">مفيش جلسات متسجلة لليوم. أضف جلسة من قسم الجدول.</div>`;
      return;
    }
    box.innerHTML = items.map(item => planHtml(item)).join("");
    bindScheduleActions(box);
  }

  function planHtml(item) {
    const subject = subjectById(item.subject);
    return `<article class="plan-item">
      <div class="plan-main">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${subject?.icon || "📚"} ${escapeHtml(subject?.name || item.subject)} · ${escapeHtml(item.time)} · ${Number(item.duration)} دقيقة</span>
      </div>
      <span class="pill">${item.done ? "✅ تم" : "⌛ قادم"}</span>
    </article>`;
  }

  function sortSessions(a, b) {
    return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
  }

  function renderSchedule() {
    const list = $("scheduleList");
    const items = ScheduleStore.all().sort(sortSessions);
    if (!items.length) {
      list.innerHTML = `<div class="empty">الجدول لسه فاضي. أضف أول جلسة.</div>`;
      return;
    }
    list.innerHTML = items.map(item => {
      const subject = subjectById(item.subject);
      return `<article class="schedule-item" data-id="${escapeHtml(item.id)}">
        <div class="schedule-time"><strong>${escapeHtml(item.time)}</strong><br><small>${escapeHtml(item.date)}</small></div>
        <div class="schedule-info">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${subject?.icon || "📚"} ${escapeHtml(subject?.name || item.subject)} · ${Number(item.duration)} دقيقة ${item.done ? "· منتهية" : ""}</span>
        </div>
        <button class="delete-btn" type="button" data-delete-id="${escapeHtml(item.id)}" aria-label="حذف الجلسة">حذف</button>
      </article>`;
    }).join("");
    bindScheduleActions(list);
  }

  function bindScheduleActions(root) {
    root.querySelectorAll("[data-delete-id]").forEach(button => {
      button.addEventListener("click", () => {
        ScheduleStore.remove(button.dataset.deleteId);
        renderSchedule();
        updateHome();
        refreshProgress();
      });
    });
  }

  function initScheduleForm() {
    const subjectSelect = $("subjectInput");
    subjectSelect.innerHTML = (window.STUDY_SUBJECTS || []).map(s => `<option value="${escapeHtml(s.id)}">${s.icon} ${escapeHtml(s.name)}</option>`).join("");
    $("dateInput").value = todayKey();

    $("scheduleForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const title = $("titleInput").value.trim();
      const date = $("dateInput").value;
      const time = $("timeInput").value;
      const duration = Number($("durationInput").value);
      if (!title || !date || !time || !Number.isFinite(duration) || duration < 15 || duration > 480) return;

      ScheduleStore.add({
        subject: subjectSelect.value,
        date,
        time,
        duration,
        title,
        done: false
      });
      $("titleInput").value = "";
      renderSchedule();
      updateHome();
      refreshProgress();
      setSection("schedule");
    });
  }

  function renderChat() {
    const box = $("chatMessages");
    if (!state.chat.length) {
      box.innerHTML = `<div class="notice">مرحبًا ${escapeHtml(state.prefs.name)}. أنا Study JARVIS. اسألني عن درس، أو ابعت مسألة، أو قل لي: نظّملي مذاكرتي.</div>`;
      return;
    }
    box.innerHTML = state.chat.map(msg => `<div class="message ${msg.role === "user" ? "user" : "assistant"}">
      <span class="meta">${msg.role === "user" ? "أنت" : "Study JARVIS"}</span>
      ${escapeHtml(msg.content)}
    </div>`).join("");
    box.scrollTop = box.scrollHeight;
  }

  function appendMessage(role, content) {
    state.chat.push({ role, content });
    saveChat();
    renderChat();
  }

  function detectSubject(text) {
    const value = text.toLowerCase();
    const map = [
      ["math", ["رياضة", "رياضيات", "هندسة", "استاتيكا", "تفاضل", "تكامل"]],
      ["physics", ["فيزياء", "نيوتن", "كهربا", "كهرباء", "حركة", "قوة"]],
      ["chemistry", ["كيمياء", "اتزان", "عضوية", "كهربية", "حمض"]],
      ["arabic", ["عربي", "نحو", "بلاغة", "أدب", "قراءة"]],
      ["english", ["إنجليزي", "انجليزي", "grammar", "vocabulary"]]
    ];
    for (const [id, words] of map) if (words.some(word => value.includes(word))) return subjectById(id)?.name || "";
    return "";
  }

  async function sendPrompt() {
    const input = $("promptInput");
    const prompt = input.value.trim();
    if (!prompt) return;

    input.value = "";
    appendMessage("user", prompt);
    $("sendBtn").disabled = true;
    $("sendBtn").textContent = "يكتب...";
    $("statusLine").textContent = "جاري التفكير في إجابة تعليمية...";

    try {
      const answer = await HuggingFaceAI.chat({
        messages: state.chat.filter(m => m.role === "user" || m.role === "assistant").slice(-12),
        mode: state.mode,
        subject: detectSubject(prompt)
      });
      appendMessage("assistant", answer);
      speak(answer);
      $("statusLine").textContent = "تمت الإجابة.";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendMessage("assistant", `تعذر الاتصال بالذكاء الاصطناعي.\n${message}`);
      $("statusLine").textContent = "راجع إعدادات Hugging Face.";
    } finally {
      $("sendBtn").disabled = false;
      $("sendBtn").textContent = "إرسال";
    }
  }

  function setupVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      $("micBtn").disabled = true;
      $("voiceState").textContent = "المتصفح الحالي لا يدعم إدخال الصوت هنا.";
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "ar-EG";
    recognition.interimResults = true;
    recognition.continuous = false;
    state.recognition = recognition;

    recognition.addEventListener("start", () => {
      state.listening = true;
      $("micBtn").textContent = "⏹️ إيقاف";
      $("voiceState").textContent = "أسمعك...";
    });

    recognition.addEventListener("result", (event) => {
      const transcript = [...event.results].map(result => result[0].transcript).join(" ");
      $("promptInput").value = transcript;
    });

    recognition.addEventListener("error", (event) => {
      $("voiceState").textContent = `الصوت لم يعمل: ${event.error}`;
    });

    recognition.addEventListener("end", () => {
      state.listening = false;
      $("micBtn").textContent = "🎤 تحدث";
      if (!$('voiceState').textContent.startsWith("الصوت لم يعمل")) $('voiceState').textContent = "تم التقاط الكلام.";
    });

    $("micBtn").addEventListener("click", () => {
      if (state.listening) recognition.stop();
      else recognition.start();
    });
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleaned = String(text).replace(/[#*_`]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "ar-EG";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  function refreshProgress() {
    const subjectTotals = Object.fromEntries((window.STUDY_SUBJECTS || []).map(s => [s.id, 0]));
    const items = ScheduleStore.all();
    items.forEach(item => { subjectTotals[item.subject] = (subjectTotals[item.subject] || 0) + Number(item.duration || 0); });
    $("subjectProgress").innerHTML = (window.STUDY_SUBJECTS || []).map(subject => {
      const minutes = subjectTotals[subject.id] || 0;
      const target = 300;
      const percent = Math.max(0, Math.min(100, Math.round(minutes / target * 100)));
      const topics = window.STUDY_CURRICULUM?.[subject.id]?.topics || [];
      return `<article class="progress-card">
        <div class="progress-row"><strong>${subject.icon} ${escapeHtml(subject.name)}</strong><span>${minutes} د</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
        <small>${percent}% من هدف 300 دقيقة · موضوعات: ${escapeHtml(topics.join("، "))}</small>
      </article>`;
    }).join("");
  }

  function openSettings() {
    $("hfTokenInput").value = HuggingFaceAI.getToken();
    $("modelInput").value = HuggingFaceAI.getModel();
    $("studentNameInput").value = state.prefs.name;
    $("settingsDialog").showModal();
  }

  function saveSettings(event) {
    event.preventDefault();
    HuggingFaceAI.setToken($("hfTokenInput").value);
    HuggingFaceAI.setModel($("modelInput").value);
    state.prefs.name = $("studentNameInput").value.trim() || "أحمد";
    savePrefs();
    $("settingsDialog").close();
    renderChat();
    $("statusLine").textContent = HuggingFaceAI.getToken() ? "المساعد متصل بالإعدادات المحلية." : "أدخل HF Token لبدء أسئلة الذكاء الاصطناعي.";
  }

  function setup() {
    tabs.forEach(tab => tab.addEventListener("click", () => setSection(tab.dataset.section)));
    modeButtons.forEach(button => button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      modeButtons.forEach(btn => btn.classList.toggle("active", btn === button));
    }));

    $("askBtn").addEventListener("click", () => { setSection("chat"); $("promptInput").focus(); });
    $("goScheduleBtn").addEventListener("click", () => setSection("schedule"));
    $("startStudyBtn").addEventListener("click", () => { setSection("schedule"); $("titleInput").focus(); });
    $("sendBtn").addEventListener("click", sendPrompt);
    $("promptInput").addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") sendPrompt();
    });
    $("clearChatBtn").addEventListener("click", () => {
      state.chat = [];
      saveChat();
      renderChat();
      $("statusLine").textContent = "تم مسح المحادثة.";
    });
    $("settingsBtn").addEventListener("click", openSettings);
    $("settingsForm").addEventListener("submit", saveSettings);

    initScheduleForm();
    renderChat();
    renderSchedule();
    updateHome();
    refreshProgress();
    setupVoice();

    $("statusLine").textContent = HuggingFaceAI.getToken() ? "المساعد جاهز." : "أضف HF Token من الإعدادات لتشغيل الذكاء الاصطناعي.";
  }

  setup();
})();
