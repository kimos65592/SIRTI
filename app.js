(() => {
  "use strict";

  const STORAGE_KEY = "jarvis_cognitive_os_reviewed_v3";

  const DEFAULT_STATE = {
    messages: [],
    memories: [],
    goals: [],
    settings: {
      voiceEnabled: true,
      concise: false,
      proactive: true,
      tone: "calm",
      formality: 0.65,
      humor: 0.25,
      voiceRate: 0.95
    },
    system: {
      status: "online",
      mode: "idle",
      confidence: 0.50,
      attention: 0.86,
      uncertainty: 0.50
    },
    lastAnalysis: null,
    currentGoal: null,
    currentPlan: null,
    eventLog: []
  };

  const state = loadState();

  function el(id) {
    return document.getElementById(id);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_STATE);

      const saved = JSON.parse(raw);

      return {
        ...clone(DEFAULT_STATE),
        ...saved,
        settings: {
          ...clone(DEFAULT_STATE.settings),
          ...(saved.settings || {})
        },
        system: {
          ...clone(DEFAULT_STATE.system),
          ...(saved.system || {})
        }
      };
    } catch (error) {
      console.error("[JARVIS] State load error:", error);
      return clone(DEFAULT_STATE);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.error("[JARVIS] State save error:", error);
    }
  }

  function normalizeArabic(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[ًٌٍَُِّْـ]/g, "")
      .replace(/[\u0617-\u061A]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasAny(text, words) {
    const normalized = normalizeArabic(text);
    return words.some(word =>
      normalized.includes(normalizeArabic(word))
    );
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function logEvent(type, data = {}) {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    state.eventLog.unshift(event);
    state.eventLog = state.eventLog.slice(0, 80);

    const log = el("eventLog");
    if (log) {
      log.textContent = state.eventLog
        .slice(0, 35)
        .map(e =>
          `${new Date(e.timestamp).toLocaleTimeString("ar-EG")} | ${e.type}`
        )
        .join("\n");
    }
  }

  /* =========================================================
     MEMORY ENGINE
  ========================================================= */

  const MemoryEngine = {

    save(text, type = "USER_FACT") {
      const clean = String(text || "").trim();
      if (!clean) return false;

      const normalized = normalizeArabic(clean);

      const exists = state.memories.some(
        item => normalizeArabic(item.text) === normalized
      );

      if (exists) return true;

      state.memories.push({
        id: Date.now() + "_" + Math.random().toString(36).slice(2),
        type,
        text: clean,
        createdAt: Date.now(),
        lastAccess: null
      });

      saveState();
      logEvent("MEMORY_SAVED", { type, text: clean });

      return true;
    },

    search(query = "") {
      const memories = state.memories;

      if (!memories.length) return [];

      const q = normalizeArabic(query);
      const words = q.split(/\s+/).filter(Boolean);

      return memories
        .map(item => {
          const text = normalizeArabic(item.text);

          let score = 0;

          for (const word of words) {
            if (word.length > 1 && text.includes(word)) {
              score++;
            }
          }

          return {
            ...item,
            score
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    },

    all() {
      return [...state.memories];
    },

    clear() {
      state.memories = [];
      saveState();
      logEvent("MEMORY_CLEARED");
    }
  };

  /* =========================================================
     CONTEXT ENGINE
  ========================================================= */

  const ContextEngine = {

    recent(limit = 12) {
      return state.messages.slice(-limit);
    },

    text(limit = 12) {
      return this.recent(limit)
        .map(item =>
          `${item.role === "user" ? "USER" : "JARVIS"}: ${item.text}`
        )
        .join("\n");
    }
  };

  /* =========================================================
     PERSONALIZATION
  ========================================================= */

  const PersonalizationEngine = {

    update(change = {}) {

      Object.assign(
        state.settings,
        change
      );

      saveState();

      logEvent(
        "PERSONALIZATION_UPDATED",
        change
      );
    },

    describe() {

      const s = state.settings;

      return [
        `المخاطبة: ${s.tone}`,
        `الاختصار: ${s.concise ? "مفعل" : "غير مفعل"}`,
        `الرسمية: ${Math.round(s.formality * 100)}%`,
        `الفكاهة: ${Math.round(s.humor * 100)}%`,
        `المبادرة: ${s.proactive ? "مفعلة" : "غير مفعلة"}`,
        `سرعة الصوت: ${s.voiceRate}`
      ].join("\n");
    }
  };

  /* =========================================================
     MODEL GATEWAY
  =========================================================

     هذا هو مدخل الموديل الحقيقي.

     حاليًا:
       - Local semantic fallback يعمل بدون API.

     لاحقًا:
       - يمكن تفعيل مزود نموذج فعلي هنا.
  ========================================================= */

  const ModelGateway = {

    enabled: false,
    endpoint: "",
    apiKey: "",
    model: "",

    async analyze(message) {

      if (
        this.enabled &&
        this.endpoint
      ) {
        try {
          return await this.remoteAnalyze(message);
        } catch (error) {
          console.warn(
            "[MODEL] Remote analysis failed, using local fallback:",
            error
          );
        }
      }

      return this.localAnalyze(message);
    },

    async remoteAnalyze(message) {

      const response = await fetch(
        this.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey
              ? {
                  Authorization:
                    `Bearer ${this.apiKey}`
                }
              : {})
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: "system",
                content: `
You are the language understanding layer of J.A.R.V.I.S.
Do not answer the user.
Return valid JSON only.

Schema:
{
  "intent": "greeting|memory_save|memory_recall|memory_forget|system_status|settings|personality|behavior|voice|planning|goal_set|task_start|decision|question|chat|unknown",
  "subIntent": "",
  "goal": null,
  "memoryAction": "none|save|recall|forget",
  "memoryQuery": null,
  "factsToSave": [],
  "constraints": [],
  "preferences": [],
  "entities": [],
  "urgency": 0,
  "requiresContext": false,
  "confidence": 0,
  "reason": ""
}

Use the conversation context and current message.
                `.trim()
              },
              {
                role: "user",
                content:
                  `CONTEXT:\n${ContextEngine.text(12)}\n\nMESSAGE:\n${message}`
              }
            ],
            temperature: 0.1
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `Model HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const raw =
        data?.choices?.[0]?.message?.content ??
        data?.output_text ??
        data?.response ??
        "";

      if (!raw) {
        throw new Error(
          "Empty model response"
        );
      }

      return JSON.parse(
        String(raw)
          .replace(/^```json/i, "")
          .replace(/```$/i, "")
          .trim()
      );
    },

    localAnalyze(message) {

      const n =
        normalizeArabic(message);

      const result = {
        intent: "unknown",
        subIntent: "",
        goal: null,
        memoryAction: "none",
        memoryQuery: null,
        factsToSave: [],
        constraints: [],
        preferences: [],
        entities: [],
        urgency: 0.2,
        requiresContext: false,
        confidence: 0.55,
        reason: "local semantic fallback"
      };

      if (!n) {
        return result;
      }

      if (hasAny(n, [
        "صباح الخير",
        "مساء الخير",
        "السلام عليكم",
        "اهلا",
        "مرحبا",
        "هاي"
      ])) {
        result.intent = "greeting";
        result.confidence = 0.98;
        return result;
      }

      if (hasAny(n, [
        "حالة النظام",
        "حاله النظام",
        "وضع النظام"
      ])) {
        result.intent = "system_status";
        result.confidence = 0.99;
        return result;
      }

      if (hasAny(n, [
        "ما اعداداتك",
        "ايه اعداداتك",
        "اعداداتك الحالية",
        "اعداداتك الحاليه"
      ])) {
        result.intent = "settings";
        result.confidence = 0.98;
        return result;
      }

      if (hasAny(n, [
        "غير اسلوب كلامك",
        "غير اسلوبك",
        "كلمني باختصار",
        "خليك مختصر",
        "تكلم بشكل رسمي",
        "خليك رسمي"
      ])) {
        result.intent = "personality";
        result.confidence = 0.95;
        return result;
      }

      if (hasAny(n, [
        "قارن 3 خطط",
        "قارن ثلاث خطط",
        "قارن الخطط قبل",
        "قبل اي هدف"
      ])) {
        result.intent = "behavior";
        result.subIntent = "compare_plans";
        result.confidence = 0.97;
        return result;
      }

      if (hasAny(n, [
        "سرعة صوتك",
        "سرعه صوتك",
        "خلي صوتك ابطأ",
        "خلي صوتك أبطأ",
        "اتكلم ابطأ",
        "اتكلم أبطأ"
      ])) {
        result.intent = "voice";
        result.confidence = 0.96;
        return result;
      }

      if (
        hasAny(n, [
          "ماذا تتذكر",
          "ايه اللي فاكره",
          "ايه الي فاكره",
          "تفتكر انا بحب ايه",
          "هل تتذكر",
          "هل فاكر",
          "فكرني"
        ])
      ) {
        result.intent = "memory_recall";
        result.memoryAction = "recall";
        result.memoryQuery = message;
        result.requiresContext = true;
        result.confidence = 0.97;
        return result;
      }

      if (
        hasAny(n, [
          "انس",
          "انسي",
          "احذف من ذاكرتك",
          "لا تتذكر"
        ])
      ) {
        result.intent = "memory_forget";
        result.memoryAction = "forget";
        result.memoryQuery = message;
        result.confidence = 0.92;
        return result;
      }

      const saveMatch =
        message.match(
          /^(?:تذكر|افتكر|احفظ|سجل)\s*(?:انني|اني|ان)?\s*(.+)$/i
        );

      if (saveMatch) {
        const fact =
          saveMatch[1].trim();

        if (
          fact &&
          !hasAny(n, [
            "ماذا تتذكر",
            "هل تتذكر"
          ])
        ) {
          result.intent = "memory_save";
          result.memoryAction = "save";
          result.factsToSave = [fact];
          result.confidence = 0.98;
          return result;
        }
      }

      /*
       * Contextual "ابدأ".
       */

      if (
        hasAny(n, [
          "ابدأ",
          "ابدا",
          "يلا نبدأ",
          "يلا نبدا",
          "كمل",
          "تابع",
          "نفذ"
        ])
      ) {

        if (
          state.currentGoal ||
          state.currentPlan
        ) {
          result.intent = "task_start";
          result.requiresContext = true;
          result.confidence = 0.96;
        }

        return result;
      }

      const urgent =
        hasAny(n, [
          "متاخر",
          "متأخر",
          "مستعجل",
          "بسرعه",
          "بسرعة",
          "الوقت ضيق",
          "عايز اخلص بسرعة"
        ]);

      const fastWasBad =
        hasAny(n, [
          "الخطة السريعة",
          "الخطة السريعه",
          "الطريقه السريعه",
          "الطريقة السريعة"
        ])
        &&
        hasAny(n, [
          "مشت بشكل وحش",
          "فشلت",
          "ما نفعت",
          "وحشه",
          "وحشة"
        ]);

      const study =
        hasAny(n, [
          "مذاكرة البرمجة",
          "مذاكره البرمجه",
          "مذاكره برمجه",
          "مذاكرة برمجة",
          "اذاكر برمجة",
          "اذاكر البرمجة"
        ]);

      if (
        study ||
        fastWasBad ||
        hasAny(n, [
          "خطة للمذاكرة",
          "جهزني للمذاكرة",
          "جهزني لمذاكرة البرمجة"
        ])
      ) {

        result.intent = "planning";
        result.subIntent = "study_session";
        result.goal = "مذاكرة البرمجة";
        result.requiresContext = true;
        result.urgency = urgent ? 0.92 : 0.55;
        result.entities = ["البرمجة"];

        if (urgent) {
          result.constraints.push(
            "الوقت المتاح محدود"
          );
        }

        if (fastWasBad) {
          result.constraints.push(
            "الخطة السريعة فشلت سابقًا"
          );

          result.preferences.push(
            "تجنب الخطة السريعة"
          );
        }

        result.confidence = 0.95;

        return result;
      }

      if (
        hasAny(n, [
          "قارن",
          "قرار",
          "اختار",
          "ايه الافضل",
          "ما الافضل"
        ])
      ) {
        result.intent = "decision";
        result.confidence = 0.80;
        return result;
      }

      if (
        hasAny(n, [
          "ساعدني",
          "ماذا تستطيع",
          "ايه اللي تقدر",
          "ماذا يمكنك"
        ])
      ) {
        result.intent = "question";
        result.confidence = 0.90;
        return result;
      }

      return result;
    }
  };

  /* =========================================================
     PLANNER
  ========================================================= */

  const Planner = {

    build(goal, analysis) {

      const urgent =
        Number(analysis.urgency || 0) >= 0.75;

      const avoidFast =
        (analysis.preferences || []).includes(
          "تجنب الخطة السريعة"
        );

      const plans = [

        {
          id: "A",
          name: "الخطة السريعة",
          score: urgent ? 0.72 : 0.60,
          steps: [
            "تحديد أهم جزء",
            "تنفيذ مباشر",
            "مراجعة قصيرة"
          ]
        },

        {
          id: "B",
          name: "الخطة المتوازنة",
          score: 0.84,
          steps: [
            "تحديد نطاق المهمة",
            "فهم الأساسيات",
            "تطبيق عملي",
            "مراجعة النتيجة"
          ]
        },

        {
          id: "C",
          name: "الخطة العميقة",
          score: 0.80,
          steps: [
            "تحليل الحالة",
            "استرجاع الخبرة السابقة",
            "تنفيذ تدريجي",
            "اختبار",
            "مراجعة الأخطاء"
          ]
        }
      ];

      if (avoidFast) {
        plans[0].score -= 0.38;
        plans[2].score += 0.05;
      }

      if (urgent) {
        plans[0].score += 0.04;
        plans[2].score -= 0.03;
      }

      plans.sort(
        (a, b) =>
          b.score - a.score
      );

      return {
        goal,
        compared:
          plans.map(p => ({
            id: p.id,
            name: p.name,
            score:
              Number(
                p.score.toFixed(2)
              )
          })),
        selected: plans[0],
        reason:
          avoidFast
            ? "تم تقليل أولوية الخطة السريعة لأن التجربة السابقة كانت سيئة."
            : urgent
              ? "الوقت محدود، لذلك أعطيت وزنًا أعلى للتنفيذ العملي."
              : "اخترت التوازن بين الفهم والتنفيذ."
      };
    }
  };

  /* =========================================================
     DECISION ENGINE
  ========================================================= */

  const DecisionEngine = {

    choose(plan) {

      const selected =
        plan?.selected;

      if (!selected) {
        return null;
      }

      const confidence =
        clamp(
          0.70 +
          selected.score * 0.22
        );

      logEvent(
        "DECISION_MADE",
        {
          selected: selected.name,
          confidence
        }
      );

      return {
        selected,
        confidence,
        reason: plan.reason
      };
    }
  };

  /* =========================================================
     MAIN COGNITIVE CYCLE
  ========================================================= */

  const CognitiveCore = {

    async process(message) {

      state.system.mode =
        "understanding";

      renderAll();

      logEvent(
        "USER_INPUT",
        { message }
      );

      const analysis =
        await ModelGateway.analyze(
          message
        );

      state.lastAnalysis =
        analysis;

      state.system.confidence =
        clamp(
          analysis.confidence ||
          0.5
        );

      state.system.uncertainty =
        1 -
        state.system.confidence;

      logEvent(
        "UNDERSTANDING",
        analysis
      );

      /*
       * World model update
       */

      state.world = {
        time: new Date().toISOString(),
        intent: analysis.intent,
        subIntent: analysis.subIntent,
        context:
          ContextEngine.recent(10),
        relevantMemory:
          MemoryEngine.search(message),
        constraints:
          analysis.constraints || [],
        goal:
          state.currentGoal
      };

      state.system.mode =
        "reasoning";

      renderAll();

      /*
       * Intent handling
       */

      let response =
        await this.route(
          analysis,
          message
        );

      state.system.mode =
        "idle";

      saveState();
      renderAll();

      return response;
    },

    async route(
      analysis,
      message
    ) {

      switch (
        analysis.intent
      ) {

        case "greeting":

          return (
            "صباح الخير يا سيدي. " +
            "النواة المعرفية تعمل."
          );

        case "memory_save":

          for (
            const fact
            of analysis.factsToSave || []
          ) {
            MemoryEngine.save(
              fact
            );
          }

          return (
            "تم حفظ المعلومة في ذاكرتي."
          );

        case "memory_recall": {

          const memories =
            MemoryEngine.search(
              analysis.memoryQuery ||
              message
            );

          if (!memories.length) {

            return (
              "بحثت في الذاكرة ولم أجد " +
              "معلومة مطابقة بما يكفي."
            );
          }

          return [
            "أتذكر:",
            ...memories.map(
              m => `• ${m.text}`
            )
          ].join("\n");
        }

        case "memory_forget": {

          const query =
            normalizeArabic(
              analysis.memoryQuery ||
              message
            )
            .replace(
              /احذف من ذاكرتك/g,
              ""
            )
            .replace(
              /انس|انسي/g,
              ""
            )
            .trim();

          const before =
            state.memories.length;

          state.memories =
            state.memories.filter(
              m =>
                !normalizeArabic(
                  m.text
                ).includes(query)
            );

          const removed =
            before -
            state.memories.length;

          saveState();

          return removed
            ? `تم حذف ${removed} معلومة من الذاكرة.`
            : "لم أجد معلومة واضحة لحذفها.";
        }

        case "system_status":

          return [
            "النظام: يعمل",
            "البيئة: web",
            `الحالة المعرفية: ${state.system.mode}`,
            `الإدراك الداخلي: ${Math.round(state.system.awareness || 0.82) * 100}%`,
            `الانتباه: ${Math.round(state.system.attention * 100)}%`,
            `الثقة: ${Math.round(state.system.confidence * 100)}%`,
            `عدم اليقين: ${Math.round(state.system.uncertainty * 100)}%`,
            `الهدف الحالي: ${state.currentGoal?.title || "لا يوجد"}`
          ].join("\n");

        case "settings":

          return [
            PersonalizationEngine.describe(),
            `محرك الفهم: ${ModelGateway.enabled ? "Remote Model" : "Local Semantic Fallback"}`
          ].join("\n");

        case "personality":

          if (
            hasAny(
              message,
              [
                "مختصر",
                "باختصار"
              ]
            )
          ) {
            PersonalizationEngine.update({
              concise: true,
              verbosity: 0.3
            });

            return (
              "تم. سأجعل ردودي أكثر اختصارًا."
            );
          }

          if (
            hasAny(
              message,
              [
                "رسمي",
                "بشكل رسمي"
              ]
            )
          ) {
            PersonalizationEngine.update({
              formality: 0.95,
              tone: "formal"
            });

            return (
              "تم. تم اعتماد أسلوب أكثر رسمية."
            );
          }

          if (
            hasAny(
              message,
              [
                "هادئ",
                "هادي"
              ]
            )
          ) {
            PersonalizationEngine.update({
              tone: "calm"
            });

            return (
              "تم. سأحافظ على نبرة أكثر هدوءًا."
            );
          }

          return (
            "أستطيع تعديل النبرة، الرسمية، الاختصار، " +
            "الفكاهة، وطريقة التواصل وحفظها."
          );

        case "behavior":

          if (
            analysis.subIntent ===
            "compare_plans"
          ) {
            PersonalizationEngine.update({
              comparePlans: true
            });

            return (
              "تم. سأقارن ثلاث خطط عندما يكون ذلك مناسبًا."
            );
          }

          return (
            "تم استلام تعديل السلوك."
          );

        case "voice":

          if (
            hasAny(
              message,
              [
                "ابطأ",
                "أبطأ",
                "ابطي"
              ]
            )
          ) {

            PersonalizationEngine.update({
              voiceRate: 0.80
            });

            return (
              "تم إبطاء سرعة صوتي."
            );
          }

          if (
            hasAny(
              message,
              [
                "اسرع",
                "أسرع"
              ]
            )
          ) {

            PersonalizationEngine.update({
              voiceRate: 1.12
            });

            return (
              "تم رفع سرعة صوتي."
            );
          }

          return (
            "إعدادات الصوت الحالية قابلة للتعديل."
          );

        case "planning": {

          const goal =
            analysis.goal ||
            "هدف جديد";

          state.currentGoal = {
            title: goal,
            urgency:
              analysis.urgency || 0,
            constraints:
              analysis.constraints || [],
            preferences:
              analysis.preferences || [],
            createdAt:
              Date.now()
          };

          state.currentPlan =
            Planner.build(
              goal,
              analysis
            );

          const decision =
            DecisionEngine.choose(
              state.currentPlan
            );

          state.system.confidence =
            decision.confidence;

          state.system.uncertainty =
            1 -
            decision.confidence;

          saveState();
          renderAll();

          return [
            `تم فهم الهدف: ${goal}`,
            "حللت السياق الحالي.",
            "قارنت 3 خطط.",
            `الخطة المختارة: ${decision.selected.name}.`,
            `السبب: ${decision.reason}`,
            "الخطة جاهزة. قل «ابدأ» للتنفيذ."
          ].join("\n");
        }

        case "task_start":

          if (
            !state.currentGoal ||
            !state.currentPlan
          ) {

            return (
              "لا يوجد هدف وخطة نشطة لبدء التنفيذ."
            );
          }

          state.currentPlan.startedAt =
            Date.now();

          state.currentPlan.status =
            "running";

          state.system.mode =
            "execution";

          saveState();
          renderAll();

          return [
            `بدأت الهدف: ${state.currentGoal.title}`,
            `الخطة: ${state.currentPlan.selected.name}`,
            "",
            ...state.currentPlan
              .selected
              .steps
              .map(
                (step, i) =>
                  `${i + 1}. ${step}`
              ),
            "",
            "التنفيذ الآن في وضع المحاكاة على الويب."
          ].join("\n");

        case "decision":

          if (
            state.currentPlan
          ) {

            const decision =
              DecisionEngine.choose(
                state.currentPlan
              );

            return [
              `الاختيار: ${decision.selected.name}`,
              `السبب: ${decision.reason}`,
              `الثقة: ${Math.round(decision.confidence * 100)}%`
            ].join("\n");
          }

          return (
            "لا توجد خطط حالية للمقارنة."
          );

        case "question":

          return [
            "أستطيع حاليًا:",
            "• إدارة الذاكرة.",
            "• فهم السياق الحالي.",
            "• إنشاء الأهداف.",
            "• مقارنة الخطط.",
            "• اتخاذ قرار مفسر.",
            "• تعديل بعض سلوكياتي.",
            "• إخراج الرد صوتيًا.",
            "• الاحتفاظ بالحالة محليًا."
          ].join("\n");

        default:

          return (
            "فهمت الرسالة جزئيًا، " +
            "لكنني لا أملك يقينًا كافيًا " +
            "لتحديد الإجراء المناسب."
          );
      }
    }
  };

  /* =========================================================
     UI
  ========================================================= */

  function addMessage(role, text) {
    state.messages.push({
      role,
      text,
      timestamp: Date.now()
    });

    state.messages =
      state.messages.slice(-100);

    saveState();
    renderMessages();
  }

  function renderMessages() {
    const container =
      el("messages");

    if (!container) return;

    container.innerHTML = "";

    for (
      const item
      of state.messages
    ) {

      const wrapper =
        document.createElement("div");

      wrapper.className =
        `msg ${
          item.role === "user"
            ? "user"
            : "jarvis"
        }`;

      const meta =
        document.createElement("div");

      meta.className =
        "meta";

      meta.textContent =
        item.role === "user"
          ? "YOU"
          : "J.A.R.V.I.S";

      const body =
        document.createElement("div");

      body.textContent =
        item.text;

      wrapper.append(
        meta,
        body
      );

      container.appendChild(
        wrapper
      );
    }

    container.scrollTop =
      container.scrollHeight;
  }

  function renderAnalysis() {
    const a =
      state.lastAnalysis;

    el("intent").textContent =
      a?.intent || "unknown";

    el("subIntent").textContent =
      a?.subIntent || "—";

    const extras =
      el("analysisExtras");

    if (!extras) return;

    extras.innerHTML = "";

    if (a?.goal) {
      extras.innerHTML +=
        `<div class="row"><span class="label">الهدف</span><span class="value">${escapeHtml(a.goal)}</span></div>`;
    }

    if (
      a?.memoryAction &&
      a.memoryAction !== "none"
    ) {
      extras.innerHTML +=
        `<div class="row"><span class="label">Memory</span><span class="value">${escapeHtml(a.memoryAction)}</span></div>`;
    }

    extras.innerHTML +=
      `<div class="row"><span class="label">Urgency</span><span class="value">${Math.round((a?.urgency || 0) * 100)}%</span></div>`;

    extras.innerHTML +=
      `<div class="row"><span class="label">Confidence</span><span class="value">${Math.round((a?.confidence || 0) * 100)}%</span></div>`;

    if (
      a?.constraints?.length
    ) {
      extras.innerHTML +=
        `<div class="tags">${a.constraints.map(x => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div>`;
    }
  }

  function renderMemory() {
    const container =
      el("memoryView");

    const memories =
      MemoryEngine.all()
        .slice(-10)
        .reverse();

    container.innerHTML =
      memories.length
        ? memories
            .map(
              m =>
                `<div class="row"><span class="value" style="max-width:100%;text-align:right">${escapeHtml(m.text)}</span></div>`
            )
            .join("")
        : "فارغة";
  }

  function renderPlan() {
    const container =
      el("planView");

    const plan =
      state.currentPlan;

    if (!plan) {
      container.textContent =
        "لا توجد خطة.";
      return;
    }

    container.innerHTML = `
      <div class="row">
        <span class="label">الهدف</span>
        <span class="value">${escapeHtml(plan.goal)}</span>
      </div>
      <div class="row">
        <span class="label">المختارة</span>
        <span class="value">${escapeHtml(plan.selected.name)}</span>
      </div>
      <div class="row">
        <span class="label">السبب</span>
        <span class="value">${escapeHtml(plan.reason)}</span>
      </div>
      ${plan.compared
        .map(
          p =>
            `<div class="row"><span class="label">${escapeHtml(p.name)}</span><span class="value">${p.score}</span></div>`
        )
        .join("")}
    `;
  }

  function renderSystem() {
    const s =
      state.system;

    el("systemState").textContent =
      s.status.toUpperCase();

    el("processing").textContent =
      s.mode;

    el("confidence").textContent =
      `${Math.round(s.confidence * 100)}%`;

    el("attention").textContent =
      `${Math.round(s.attention * 100)}%`;

    el("uncertainty").textContent =
      `${Math.round(s.uncertainty * 100)}%`;

    el("goal").textContent =
      state.currentGoal?.title ||
      "لا يوجد";
  }

  function renderAll() {
    renderMessages();
    renderSystem();
    renderAnalysis();
    renderMemory();
    renderPlan();
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(
        /[&<>"']/g,
        char =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
          })[char]
      );
  }

  async function send() {

    const input =
      el("userInput");

    const button =
      el("sendButton");

    if (!input) return;

    const text =
      input.value.trim();

    if (!text) return;

    if (button) {
      button.disabled = true;
    }

    addMessage(
      "user",
      text
    );

    input.value = "";

    try {

      const response =
        await CognitiveCore.process(
          text
        );

      addMessage(
        "jarvis",
        response
      );

      speak(response);

    } catch (error) {

      console.error(
        "[JARVIS] Cognitive cycle error:",
        error
      );

      state.system.mode =
        "error";

      addMessage(
        "jarvis",
        "حدث خطأ داخلي أثناء معالجة الرسالة."
      );

    } finally {

      if (button) {
        button.disabled = false;
      }

      state.system.mode =
        "idle";

      saveState();
      renderAll();

      input.focus();
    }
  }

  function speak(text) {

    if (
      !state.settings.voiceEnabled
    ) return;

    if (
      !("speechSynthesis" in window)
    ) return;

    try {

      speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          text
        );

      utterance.lang =
        "ar-EG";

      utterance.rate =
        clamp(
          state.settings.voiceRate,
          0.5,
          2
        );

      speechSynthesis.speak(
        utterance
      );

    } catch (error) {

      console.error(
        "[JARVIS] TTS error:",
        error
      );
    }
  }

  function initialize() {

    logEvent(
      "SYSTEM_BOOT",
      {
        version:
          "REVIEWED_V3"
      }
    );

    renderAll();

    if (
      !state.messages.length
    ) {

      addMessage(
        "jarvis",
        "صباح الخير يا سيدي. نظام J.A.R.V.I.S المعرفي يعمل. ابدأ باختبار الذاكرة أو الأهداف أو التخطيط."
      );
    }

    el("chatForm").addEventListener(
      "submit",
      event => {
        event.preventDefault();
        void send();
      }
    );

    el("voiceButton").addEventListener(
      "click",
      () => {
        state.settings.voiceEnabled =
          !state.settings.voiceEnabled;

        saveState();

        el("voiceButton").textContent =
          state.settings.voiceEnabled
            ? "🔊 الصوت"
            : "🔇 الصوت";
      }
    );

    el("clearButton").addEventListener(
      "click",
      () => {

        state.messages = [];

        saveState();
        renderAll();
      }
    );

    el("userInput").focus();

    console.log(
      "[JARVIS] Reviewed build initialized successfully."
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );

  window.JARVIS = {
    state,
    CognitiveCore,
    ModelGateway,
    MemoryEngine,
    Planner,
    DecisionEngine
  };
})();
