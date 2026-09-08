"use strict";

/*
=========================================================
J.A.R.V.I.S — COGNITIVE OS v1.0
PHASE 1 — WEB COGNITIVE CORE

USER INPUT  : TEXT
JARVIS      : TEXT + VOICE

NO MICROPHONE
NO ANDROID
NO EXTERNAL API
NO EXTERNAL DEPENDENCIES

This phase builds the cognitive architecture first.
The "awareness" values are internal engineering state,
not a claim of literal consciousness.
=========================================================
*/

const STORAGE = {
  memory: "jarvis_v1_memory",
  profile: "jarvis_v1_profile",
  goals: "jarvis_v1_goals",
  episodes: "jarvis_v1_episodes"
};

const $ = (id) => document.getElementById(id);

const UI = {
  chat: $("chat"),
  input: $("input"),
  form: $("command-form"),
  system: $("system-state"),
  mode: $("mode-state"),
  awareness: $("awareness-value"),
  awarenessBar: $("awareness-bar"),
  attention: $("attention-value"),
  attentionBar: $("attention-bar"),
  confidence: $("confidence-value"),
  confidenceBar: $("confidence-bar"),
  uncertainty: $("uncertainty-value"),
  uncertaintyBar: $("uncertainty-bar"),
  goal: $("goal-state"),
  thought: $("thought-state"),
  plan: $("plan-state"),
  action: $("action-state"),
  behavior: $("behavior-state"),
  log: $("cognitive-log")
};

function clamp(n, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

function nowISO() {
  return new Date().toISOString();
}

function normalizeArabic(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, words) {
  const n = normalizeArabic(text);
  return words.some(w => n.includes(normalizeArabic(w)));
}

function safeJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* =========================================================
   VOICE OUTPUT
========================================================= */

const VoiceOutput = {
  enabled: true,
  speaking: false,

  speak(text) {
    if (!this.enabled || !("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel();

      const profile = Personalization.profile.voice;
      const utterance = new SpeechSynthesisUtterance(text);

      utterance.lang = profile.language || "ar-EG";
      utterance.rate = clamp(profile.rate, 0.5, 2);
      utterance.pitch = clamp(profile.pitch, 0, 2);
      utterance.volume = clamp(profile.volume, 0, 1);

      this.speaking = true;
      utterance.onend = () => { this.speaking = false; };
      utterance.onerror = () => { this.speaking = false; };

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      CognitiveLog.add("VOICE_ERROR", error.message);
    }
  }
};

function jarvisSay(text, speak = true) {
  addMessage("J.A.R.V.I.S", text, "jarvis");
  if (speak) VoiceOutput.speak(text);
}

function addMessage(who, text, className) {
  const box = document.createElement("div");
  box.className = `msg ${className}`;

  const label = document.createElement("div");
  label.className = "who";
  label.textContent = who;

  const body = document.createElement("div");
  body.textContent = text;

  box.append(label, body);
  UI.chat.appendChild(box);
  UI.chat.scrollTop = UI.chat.scrollHeight;
}

/* =========================================================
   COGNITIVE LOG
========================================================= */

const CognitiveLog = {
  entries: [],

  add(type, message) {
    this.entries.unshift({
      time: new Date().toLocaleTimeString("ar-EG"),
      type,
      message: String(message)
    });

    this.entries = this.entries.slice(0, 35);
    UI.log.innerHTML = this.entries
      .map(e => `[${e.time}] ${e.type}: ${e.message}`)
      .join("<br>");
  }
};

/* =========================================================
   SELF MODEL
========================================================= */

const SelfModel = {
  state: {
    mode: "OBSERVING",
    awareness: 0.72,
    attention: 0.65,
    confidence: 0.80,
    uncertainty: 0.20,
    currentThought: "في انتظار الإدراك...",
    currentAction: "لا يوجد",
    lastObservation: "لا يوجد",
    uptimeStarted: Date.now()
  },

  update(patch = {}) {
    Object.assign(this.state, patch);

    this.state.awareness = clamp(this.state.awareness);
    this.state.attention = clamp(this.state.attention);
    this.state.confidence = clamp(this.state.confidence);
    this.state.uncertainty = clamp(this.state.uncertainty);

    renderCognitiveState();
  }
};

/* =========================================================
   WORLD MODEL
========================================================= */

const WorldModel = {
  state: {
    environment: "web",
    userInput: "",
    normalizedInput: "",
    currentIntent: "unknown",
    userMoodEstimate: "neutral",
    time: nowISO(),
    availableTools: ["memory", "goals", "planner", "voice", "focus_mode"]
  },

  update(patch = {}) {
    Object.assign(this.state, patch, { time: nowISO() });
  }
};

/* =========================================================
   MEMORY SYSTEM
========================================================= */

const MemorySystem = {
  get memories() {
    return safeJSON(STORAGE.memory, []);
  },

  remember(text, type = "semantic", confidence = 0.9) {
    const memories = this.memories;
    const normalized = normalizeArabic(text);

    if (!normalized) return false;

    const existing = memories.find(m => m.normalized === normalized);
    if (existing) {
      existing.lastSeen = nowISO();
      existing.confidence = Math.max(existing.confidence, confidence);
      saveJSON(STORAGE.memory, memories);
      return true;
    }

    memories.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      text: text.trim(),
      normalized,
      type,
      confidence,
      createdAt: nowISO(),
      lastSeen: nowISO()
    });

    saveJSON(STORAGE.memory, memories);
    CognitiveLog.add("MEMORY", `Stored ${type} memory`);
    return true;
  },

  all() {
    return this.memories;
  },

  search(query) {
    const q = normalizeArabic(query);
    if (!q) return [];

    return this.memories
      .map(m => {
        const words = q.split(" ").filter(Boolean);
        const score = words.reduce(
          (s, word) => s + (m.normalized.includes(word) ? 1 : 0),
          0
        );
        return { ...m, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);
  }
};

/* =========================================================
   PERSONALIZATION ENGINE
========================================================= */

const defaultProfile = {
  name: "J.A.R.V.I.S",
  userAddress: "يا سيدي",

  communication: {
    tone: "calm",
    formality: 0.65,
    verbosity: 0.55,
    humor: 0.25,
    concise: false
  },

  behavior: {
    askWhenUncertain: true,
    verifyActions: true,
    comparePlans: true,
    planCount: 3,
    proactive: true
  },

  voice: {
    enabled: true,
    language: "ar-EG",
    rate: 0.95,
    pitch: 1.0,
    volume: 1.0
  }
};

const Personalization = {
  profile: safeJSON(STORAGE.profile, structuredClone(defaultProfile)),

  save() {
    saveJSON(STORAGE.profile, this.profile);
    renderCognitiveState();
    CognitiveLog.add("PROFILE", "Persistent behavior updated");
  },

  set(path, value) {
    const parts = path.split(".");
    let target = this.profile;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {};
      target = target[parts[i]];
    }

    target[parts.at(-1)] = value;
    this.save();
  },

  describe() {
    const p = this.profile;
    return [
      `مخاطبتك: ${p.userAddress}`,
      `النبرة: ${p.communication.tone}`,
      `الاختصار: ${p.communication.concise ? "مفعل" : "غير مفعل"}`,
      `الرسمية: ${Math.round(p.communication.formality * 100)}%`,
      `الفكاهة: ${Math.round(p.communication.humor * 100)}%`,
      `المبادرة: ${p.behavior.proactive ? "مفعلة" : "غير مفعلة"}`,
      `مراجعة النتائج: ${p.behavior.verifyActions ? "مفعلة" : "غير مفعلة"}`,
      `مقارنة الخطط: ${p.behavior.comparePlans ? "مفعلة" : "غير مفعلة"}`,
      `سرعة الصوت: ${p.voice.rate}`
    ].join("\n");
  }
};

/* =========================================================
   GOAL SYSTEM
========================================================= */

const GoalSystem = {
  get goals() {
    return safeJSON(STORAGE.goals, []);
  },

  setGoal(description) {
    const goals = this.goals;

    goals.forEach(g => {
      if (g.status === "active") g.status = "paused";
    });

    const goal = {
      id: Date.now(),
      description,
      normalized: normalizeArabic(description),
      status: "active",
      priority: 0.8,
      progress: 0,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    goals.push(goal);
    saveJSON(STORAGE.goals, goals);

    SelfModel.update({
      mode: "GOAL_SELECTED",
      currentThought: `تم تحديد الهدف: ${description}`
    });

    CognitiveLog.add("GOAL", description);
    return goal;
  },

  current() {
    return this.goals.find(g => g.status === "active") || null;
  },

  complete(goal) {
    if (!goal) return;
    const goals = this.goals;
    const item = goals.find(g => g.id === goal.id);
    if (!item) return;

    item.status = "completed";
    item.progress = 1;
    item.updatedAt = nowISO();
    saveJSON(STORAGE.goals, goals);
  }
};

/* =========================================================
   INTENT / UNDERSTANDING
========================================================= */

const Intent = {
  MEMORY_SAVE: "memory_save",
  MEMORY_READ: "memory_read",
  SYSTEM_STATUS: "system_status",
  GOAL: "goal",
  PERSONALITY: "personality",
  BEHAVIOR: "behavior",
  VOICE: "voice",
  SETTINGS: "settings",
  GREETING: "greeting",
  HELP: "help",
  UNKNOWN: "unknown"
};

function understand(input) {
  const n = normalizeArabic(input);

  if (containsAny(n, ["تذكر", "افتكر", "احفظ", "خلي بالك"])) {
    return { type: Intent.MEMORY_SAVE, confidence: 0.96 };
  }

  if (containsAny(n, ["ماذا تتذكر", "ايه اللي تفتكره", "الذاكره", "ذكرياتي"])) {
    return { type: Intent.MEMORY_READ, confidence: 0.95 };
  }

  if (containsAny(n, ["حاله النظام", "حالة النظام", "system status", "حالتك"])) {
    return { type: Intent.SYSTEM_STATUS, confidence: 0.96 };
  }

  // Behavior rules come before GOAL so phrases like
  // "قارن 3 خطط قبل أي هدف" are not mistaken for a goal.
  if (containsAny(n, [
    "قارن 3 خطط",
    "قارن ثلاث خطط",
    "قارن ثلاثه خطط",
    "قبل اي هدف",
    "قبل أي هدف",
    "من دلوقتي",
    "من الان",
    "غير سلوكك",
    "غير طريقه تفكيرك",
    "قبل ما تاخد قرار"
  ])) {
    return { type: Intent.BEHAVIOR, confidence: 0.96 };
  }

  if (containsAny(n, [
    "ما اعداداتك",
    "ايه اعداداتك",
    "ما هي اعداداتك",
    "اعداداتك الحاليه",
    "اعداداتك الحالية",
    "ما اعدادات النظام",
    "اعدادات النظام"
  ])) {
    return { type: Intent.SETTINGS, confidence: 0.97 };
  }

  if (containsAny(n, ["جهزني", "اريد ان اذاكر", "عايز اذاكر", "هدف"])) {
    return { type: Intent.GOAL, confidence: 0.88 };
  }

  if (containsAny(n, ["كلمني", "اسلوبك", "طريقه كلامك", "طريقة كلامك", "رسمي", "مختصر"])) {
    return { type: Intent.PERSONALITY, confidence: 0.90 };
  }

  if (containsAny(n, ["صوتك", "سرعه الصوت", "سرعة الصوت", "اتكلم ابطأ", "اتكلم أبطأ"])) {
    return { type: Intent.VOICE, confidence: 0.93 };
  }

  if (containsAny(n, ["مرحبا", "اهلا", "أهلا", "صباح الخير", "مساء الخير", "السلام عليكم"])) {
    return { type: Intent.GREETING, confidence: 0.98 };
  }

  if (containsAny(n, ["ساعدني", "ماذا تستطيع", "ايه اللي تقدر", "ماذا يمكنك"])) {
    return { type: Intent.HELP, confidence: 0.92 };
  }

  return { type: Intent.UNKNOWN, confidence: 0.42 };
}

/* =========================================================
   EMOTION / CONTEXT ESTIMATOR
========================================================= */

function estimateMood(text) {
  const n = normalizeArabic(text);

  if (containsAny(n, ["زهقت", "متضايق", "مخنوق", "غضبان", "عصبت", "مش شغال"])) {
    return "frustrated";
  }

  if (containsAny(n, ["جامد", "ممتاز", "حلو", "متحمس", "رائع"])) {
    return "positive";
  }

  if (containsAny(n, ["خايف", "قلقان", "قلق"])) {
    return "anxious";
  }

  return "neutral";
}

/* =========================================================
   PLANNER
========================================================= */

const Planner = {
  generate(goal) {
    const description = goal.description;
    const plans = [
      {
        id: "A",
        title: "خطة سريعة",
        steps: [
          "تحديد الموضوع",
          "مراجعة الأساسيات",
          "حل تطبيقات قصيرة",
          "مراجعة النتيجة"
        ],
        score: 0
      },
      {
        id: "B",
        title: "خطة متوازنة",
        steps: [
          "تحديد نقطة البداية",
          "دراسة المفهوم الأساسي",
          "تطبيق عملي",
          "حل مسائل",
          "اختبار الفهم"
        ],
        score: 0
      },
      {
        id: "C",
        title: "خطة عميقة",
        steps: [
          "تحديد المعرفة السابقة",
          "بناء المفهوم",
          "تطبيق عملي",
          "حل مسائل متنوعة",
          "اختبار",
          "مراجعة الأخطاء"
        ],
        score: 0
      }
    ];

    plans.forEach(plan => {
      plan.score =
        (plan.id === "B" ? 0.92 : 0.78) +
        (description.length > 15 ? 0.03 : 0);
    });

    plans.sort((a, b) => b.score - a.score);

    const selected = Personalization.profile.behavior.comparePlans
      ? plans[0]
      : plans[1];

    CognitiveLog.add(
      "PLANNER",
      `Compared ${plans.length} plans → ${selected.id}`
    );

    return { plans, selected };
  }
};

/* =========================================================
   DECISION ENGINE
========================================================= */

const DecisionEngine = {
  choose(options) {
    if (!options?.length) {
      return { selected: null, confidence: 0.1 };
    }

    const sorted = [...options].sort((a, b) => b.score - a.score);
    const selected = sorted[0];

    return {
      selected,
      confidence: clamp(selected.score)
    };
  }
};

/* =========================================================
   ACTION / TOOL ENGINE
========================================================= */

const ToolEngine = {
  available: {
    focus_mode: true,
    memory: true,
    goals: true,
    planner: true,
    voice: true
  },

  execute(action) {
    SelfModel.update({
      mode: "ACTING",
      currentAction: action.name,
      currentThought: `تنفيذ: ${action.name}`
    });

    CognitiveLog.add("ACTION", action.name);

    if (action.name === "focus_mode") {
      return {
        success: true,
        message: "تم تجهيز وضع التركيز."
      };
    }

    if (action.name === "announce") {
      return {
        success: true,
        message: action.message || "تم الإعلان."
      };
    }

    return {
      success: false,
      message: "الأداة غير متاحة في هذه المرحلة."
    };
  }
};

/* =========================================================
   OBSERVATION / REFLECTION
========================================================= */

const ObservationEngine = {
  verify(result) {
    const observed = {
      success: Boolean(result?.success),
      message: result?.message || "لا توجد نتيجة."
    };

    SelfModel.update({
      mode: "OBSERVING",
      lastObservation: observed.message,
      confidence: observed.success ? 0.94 : 0.38,
      uncertainty: observed.success ? 0.06 : 0.62
    });

    CognitiveLog.add(
      "OBSERVATION",
      `${observed.success ? "SUCCESS" : "FAIL"} — ${observed.message}`
    );

    return observed;
  }
};

const ReflectionEngine = {
  reflect(context) {
    const episodes = safeJSON(STORAGE.episodes, []);

    episodes.push({
      time: nowISO(),
      intent: context.intent,
      goal: context.goal || null,
      action: context.action || null,
      result: context.result || null,
      lesson: context.lesson || "تمت مراجعة النتيجة."
    });

    saveJSON(STORAGE.episodes, episodes.slice(-100));

    CognitiveLog.add("REFLECTION", context.lesson || "Completed");
  }
};

/* =========================================================
   AUTONOMY / COGNITIVE LOOP
========================================================= */

const CognitiveEngine = {
  async process(userText) {
    WorldModel.update({
      userInput: userText,
      normalizedInput: normalizeArabic(userText),
      userMoodEstimate: estimateMood(userText)
    });

    SelfModel.update({
      mode: "PERCEIVING",
      attention: 0.86,
      awareness: 0.82,
      currentThought: "أفهم المدخل وأحدد السياق..."
    });

    const intent = understand(userText);
    WorldModel.update({ currentIntent: intent.type });

    SelfModel.update({
      mode: "REASONING",
      confidence: intent.confidence,
      uncertainty: 1 - intent.confidence,
      currentThought: `النية المحتملة: ${intent.type}`
    });

    CognitiveLog.add(
      "UNDERSTANDING",
      `${intent.type} (${Math.round(intent.confidence * 100)}%)`
    );

    return this.dispatch(intent, userText);
  },

  async dispatch(intent, userText) {
    switch (intent.type) {
      case Intent.MEMORY_SAVE:
        return this.handleMemorySave(userText);

      case Intent.MEMORY_READ:
        return this.handleMemoryRead();

      case Intent.SYSTEM_STATUS:
        return this.handleStatus();

      case Intent.GOAL:
        return this.handleGoal(userText);

      case Intent.PERSONALITY:
        return this.handlePersonality(userText);

      case Intent.BEHAVIOR:
        return this.handleBehavior(userText);

      case Intent.VOICE:
        return this.handleVoice(userText);

      case Intent.SETTINGS:
        return this.handleSettings();

      case Intent.GREETING:
        return this.handleGreeting();

      case Intent.HELP:
        return this.handleHelp();

      default:
        return this.handleUnknown(userText);
    }
  },

  handleMemorySave(text) {
    let memory = text
      .replace(/تذكر/gi, "")
      .replace(/افتكر/gi, "")
      .replace(/احفظ/gi, "")
      .trim();

    memory = memory.replace(/^انني\s*/i, "").replace(/^اني\s*/i, "").trim();

    if (!memory) {
      return "بالتأكيد. ما المعلومة التي تريد مني حفظها؟";
    }

    MemorySystem.remember(memory);
    return "تم حفظ المعلومة في ذاكرتي.";
  },

  handleMemoryRead() {
    const memories = MemorySystem.all();

    if (!memories.length) {
      return "ذاكرتي الدائمة فارغة حاليًا.";
    }

    return "هذه المعلومات التي أتذكرها:\n" +
      memories.map(m => `• ${m.text}`).join("\n");
  },

  handleStatus() {
    const s = SelfModel.state;
    const goal = GoalSystem.current();

    return [
      `النظام: يعمل`,
      `البيئة: ${WorldModel.state.environment}`,
      `الحالة المعرفية: ${s.mode.toLowerCase()}`,
      `الإدراك الداخلي: ${Math.round(s.awareness * 100)}%`,
      `الانتباه: ${Math.round(s.attention * 100)}%`,
      `الثقة: ${Math.round(s.confidence * 100)}%`,
      `عدم اليقين: ${Math.round(s.uncertainty * 100)}%`,
      `الهدف الحالي: ${goal ? goal.description : "لا يوجد"}`,
      `المهمة الحالية: ${s.currentAction}`
    ].join("\n");
  },

  handleGoal(text) {
    const description = text
      .replace(/^\s*(جهزني|عايز|أريد|اريد)\s*/i, "")
      .replace(/^\s*(لمذاكرة|لمذاكره)\s*/i, "مذاكرة ")
      .trim() || "مهمة جديدة";

    const goal = GoalSystem.setGoal(description);

    const planResult = Planner.generate(goal);

    SelfModel.update({
      mode: "PLANNING",
      currentThought: `تم اختيار ${planResult.selected.title}`,
      awareness: 0.91,
      attention: 0.93,
      confidence: 0.91,
      uncertainty: 0.09
    });

    UI.plan.textContent =
      `${planResult.selected.title}: ${planResult.selected.steps.join(" → ")}`;

    const action = {
      name: "focus_mode"
    };

    const result = ToolEngine.execute(action);
    const observation = ObservationEngine.verify(result);

    ReflectionEngine.reflect({
      intent: Intent.GOAL,
      goal: goal.description,
      action: action.name,
      result: observation,
      lesson: observation.success
        ? "الخطة الحالية مناسبة كبداية."
        : "التنفيذ يحتاج إلى إعادة تخطيط."
    });

    if (observation.success) {
      GoalSystem.complete(goal);
      SelfModel.update({
        mode: "COMPLETED",
        currentAction: "لا يوجد",
        currentThought: "اكتملت المهمة الحالية.",
        confidence: 0.96,
        uncertainty: 0.04
      });

      return [
        `تم تحديد الهدف: ${goal.description}`,
        `حللت الهدف وقارنت ${planResult.plans.length} خطط.`,
        `الخطة المختارة: ${planResult.selected.title}.`,
        "تم تجهيز جلسة التركيز. لنبدأ."
      ].join("\n");
    }

    return [
      `تم تحديد الهدف: ${goal.description}`,
      "الخطة جاهزة، لكن التنفيذ لم يكتمل.",
      "سأحتاج إلى إعادة التخطيط في المرحلة التالية."
    ].join("\n");
  },

  handleSettings() {
    return Personalization.describe();
  },

  handlePersonality(text) {
    const n = normalizeArabic(text);

    if (containsAny(n, ["مختصر", "باختصار"])) {
      Personalization.set("communication.concise", true);
      Personalization.set("communication.verbosity", 0.25);
      return "تم. من الآن سأجعل ردودي أكثر اختصارًا.";
    }

    if (containsAny(n, ["رسمي", "بشكل رسمي"])) {
      Personalization.set("communication.formality", 0.95);
      Personalization.set("communication.tone", "formal");
      return "تم تعديل أسلوب التواصل إلى أسلوب أكثر رسمية، وسيظل محفوظًا.";
    }

    if (containsAny(n, ["هادي", "هادئ", "هدوء"])) {
      Personalization.set("communication.tone", "calm");
      return "تم. سأحافظ على نبرة أكثر هدوءًا.";
    }

    if (containsAny(n, ["اهزر", "هزار", "نكات", "نكته"])) {
      Personalization.set("communication.humor", 0.70);
      return "تم رفع مستوى الفكاهة قليلًا. لكن سأحاول ألا أحول كل اجتماع إلى عرض كوميدي.";
    }

    return "أستطيع تعديل النبرة، الرسمية، الاختصار، الفكاهة، وطريقة التواصل وحفظ التغييرات.";
  },

  handleBehavior(text) {
    const n = normalizeArabic(text);

    if (containsAny(n, ["اسالني", "اسألني", "مش متاكد", "غير متاكد", "عدم اليقين"])) {
      Personalization.set("behavior.askWhenUncertain", true);
      return "تم. عندما يكون عدم اليقين مرتفعًا سأفضّل طلب التوضيح بدل الافتراض.";
    }

    if (containsAny(n, ["ثلاث خطط", "3 خطط", "ثلاثه خطط", "قارن 3 خطط", "قارن ثلاث خطط"])) {
      Personalization.set("behavior.comparePlans", true);
      Personalization.set("behavior.planCount", 3);
      return "تم. سأقارن ثلاث خطط قبل اختيار الأفضل عندما يكون ذلك مناسبًا.";
    }

    if (containsAny(n, ["راجع النتيجه", "راجع النتيجة", "تحقق من النتيجه", "تحقق من النتيجة"])) {
      Personalization.set("behavior.verifyActions", true);
      return "تم. سأتحقق من نتيجة الأفعال بدل افتراض نجاحها.";
    }

    if (containsAny(n, ["بادر", "مبادر", "اقترح من نفسك"])) {
      Personalization.set("behavior.proactive", true);
      return "تم تفعيل السلوك الاستباقي ضمن الحدود المتاحة.";
    }

    return "تم استلام طلب تعديل السلوك. أخبرني بالقاعدة التي تريدها وسأحولها إلى إعداد محفوظ.";
  },

  handleVoice(text) {
    const n = normalizeArabic(text);

    if (containsAny(n, ["ابطا", "أبطأ", "بطئ", "ببطء"])) {
      const newRate = 0.78;
      Personalization.set("voice.rate", newRate);
      return "تم إبطاء سرعة صوتي، وسيظل الإعداد محفوظًا.";
    }

    if (containsAny(n, ["اسرع", "أسرع"])) {
      Personalization.set("voice.rate", 1.12);
      return "تم رفع سرعة صوتي قليلًا، وسيظل الإعداد محفوظًا.";
    }

    if (containsAny(n, ["ارفع الصوت", "أعلى"])) {
      Personalization.set("voice.volume", 1);
      return "تم ضبط مستوى الصوت إلى الحد الأعلى المتاح للمحرك.";
    }

    return "إعدادات الصوت الحالية محفوظة، ويمكنني تعديل السرعة واللغة وخصائص الصوت التي يدعمها المتصفح.";
  },

  handleGreeting() {
    return "صباح الخير يا سيدي. نظام J.A.R.V.I.S Cognitive OS يعمل. الإدراك والذاكرة والأهداف والتخطيط والتنفيذ جاهزة للمرحلة الأولى.";
  },

  handleHelp() {
    return [
      "في المرحلة الأولى أستطيع:",
      "• حفظ واسترجاع الذكريات.",
      "• إنشاء أهداف وخطط.",
      "• مقارنة الخطط واختيار الأنسب.",
      "• مراقبة نتيجة التنفيذ.",
      "• تعديل بعض إعدادات شخصيتي وسلوكي.",
      "• تعديل إعدادات الصوت وحفظها.",
      "• عرض حالتي المعرفية الداخلية.",
      "",
      "الميكروفون والتحكم في Android والعمل في الخلفية سيتم بناؤها بعد تثبيت الـCore."
    ].join("\n");
  },

  handleUnknown(text) {
    SelfModel.update({
      mode: "REFLECTING",
      currentThought: "النية غير مؤكدة؛ أحتاج إلى سياق إضافي.",
      confidence: 0.42,
      uncertainty: 0.58
    });

    if (Personalization.profile.behavior.askWhenUncertain) {
      return "فهمت طلبك جزئيًا، لكنني غير واثق من الإجراء المقصود. وضّح لي ماذا تريد أن أفعل بالضبط.";
    }

    return "فهمت أن هناك طلبًا، لكنني أحتاج إلى مزيد من التفاصيل.";
  }
};

/* =========================================================
   UI STATE
========================================================= */

function renderBar(valueEl, barEl, value) {
  const pct = Math.round(clamp(value) * 100);
  valueEl.textContent = `${pct}%`;
  barEl.style.width = `${pct}%`;
}

function renderCognitiveState() {
  const s = SelfModel.state;
  const p = Personalization.profile;

  UI.system.textContent = "ONLINE";
  UI.mode.textContent = s.mode;
  UI.goal.textContent = GoalSystem.current()?.description || "لا يوجد";
  UI.thought.textContent = s.currentThought;
  UI.action.textContent = s.currentAction;
  UI.behavior.textContent =
    `${p.communication.tone} • ${p.communication.concise ? "مختصر" : "متوازن"} • ` +
    `${p.behavior.proactive ? "استباقي" : "تفاعلي"}`;

  renderBar(UI.awareness, UI.awarenessBar, s.awareness);
  renderBar(UI.attention, UI.attentionBar, s.attention);
  renderBar(UI.confidence, UI.confidenceBar, s.confidence);
  renderBar(UI.uncertainty, UI.uncertaintyBar, s.uncertainty);
}

/* =========================================================
   FORM
========================================================= */

UI.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = UI.input.value.trim();
  if (!text) return;

  addMessage("YOU", text, "user");
  UI.input.value = "";

  try {
    const response = await CognitiveEngine.process(text);
    jarvisSay(response, Personalization.profile.voice.enabled);
  } catch (error) {
    CognitiveLog.add("SYSTEM_ERROR", error.stack || error.message);
    SelfModel.update({
      mode: "ERROR",
      confidence: 0.15,
      uncertainty: 0.85,
      currentThought: "حدث خطأ أثناء المعالجة."
    });
    jarvisSay("حدث خطأ داخلي أثناء معالجة الطلب. راجعت الحالة وسأحتاج إلى تصحيح المسار.");
  } finally {
    setTimeout(() => {
      if (SelfModel.state.mode === "COMPLETED") {
        SelfModel.update({ mode: "OBSERVING" });
      }
    }, 700);
  }
});

/* =========================================================
   INITIALIZATION
========================================================= */

function initialize() {
  renderCognitiveState();

  CognitiveLog.add("BOOT", "J.A.R.V.I.S Cognitive OS v1.0 initialized");

  addMessage(
    "J.A.R.V.I.S",
    "صباح الخير يا سيدي. نظام العقل V1.0 يعمل. الإدراك والذاكرة والأهداف والتخطيط والتنفيذ جاهزة.",
    "jarvis"
  );

  VoiceOutput.speak(
    "صباح الخير يا سيدي. نظام العقل يعمل."
  );
}

initialize();
