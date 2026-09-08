"use strict";

/*
=========================================================
 J.A.R.V.I.S — COGNITIVE OS v2
 MODEL-DRIVEN COGNITIVE CORE
=========================================================

Architecture:

USER
 ↓
UNDERSTANDING MODEL
 ↓
WORLD MODEL
 ↓
MEMORY
 ↓
GOALS
 ↓
PLANNER
 ↓
DECISION
 ↓
ACTION
 ↓
OBSERVATION
 ↓
REFLECTION
 ↓
LEARNING
*/

const STORAGE_KEY = "JARVIS_COGNITIVE_OS_V2";

const JARVIS = {

    state: {

        system: {
            status: "online",
            environment: "web",

            cognitiveState: "idle",

            awareness: 0.82,
            attention: 0.86,

            confidence: 0.50,
            uncertainty: 0.50
        },

        conversation: [],

        memory: [],

        world: {
            currentContext: null,
            currentSituation: null,
            userState: null
        },

        goal: null,

        plan: null,

        lastUnderstanding: null,

        settings: {

            address: "يا سيدي",

            tone: "calm",

            concise: false,

            formality: 0.65,

            humor: 0.25,

            proactive: true,

            comparePlans: true,

            reviewResults: true,

            voiceRate: 0.95
        }
    },

    /*
    =====================================================
    STORAGE
    =====================================================
    */

    storage: {

        load() {

            try {

                const saved =
                    JSON.parse(
                        localStorage.getItem(STORAGE_KEY)
                    );

                if (!saved) return;

                Object.assign(
                    JARVIS.state,
                    saved
                );

                console.log(
                    "[MEMORY] State restored."
                );

            } catch (error) {

                console.error(
                    "[MEMORY] Load error:",
                    error
                );
            }
        },

        save() {

            try {

                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(
                        JARVIS.state
                    )
                );

            } catch (error) {

                console.error(
                    "[MEMORY] Save error:",
                    error
                );
            }
        }
    },

    /*
    =====================================================
    TEXT NORMALIZATION
    =====================================================
    */

    text: {

        normalize(text) {

            return String(text || "")

                .trim()

                .toLowerCase()

                .replace(
                    /[\u064B-\u065F\u0670]/g,
                    ""
                )

                .replace(
                    /[أإآ]/g,
                    "ا"
                )

                .replace(
                    /ى/g,
                    "ي"
                );
        },

        includes(text, words) {

            const normalized =
                this.normalize(text);

            return words.some(
                word =>
                    normalized.includes(
                        this.normalize(word)
                    )
            );
        }
    },

    /*
    =====================================================
    CONVERSATION
    =====================================================
    */

    conversation: {

        addUser(text) {

            JARVIS.state.conversation.push({

                role: "user",

                text,

                timestamp: Date.now()
            });

            this.limit();
        },

        addJarvis(text) {

            JARVIS.state.conversation.push({

                role: "jarvis",

                text,

                timestamp: Date.now()
            });

            this.limit();
        },

        limit() {

            if (
                JARVIS.state.conversation.length
                > 100
            ) {

                JARVIS.state.conversation =
                    JARVIS.state.conversation
                        .slice(-100);
            }
        },

        recent(count = 10) {

            return JARVIS.state.conversation
                .slice(-count);
        },

        contextText(count = 10) {

            return this.recent(count)
                .map(message => {

                    const role =
                        message.role === "user"
                            ? "USER"
                            : "JARVIS";

                    return `${role}: ${message.text}`;

                })
                .join("\n");
        }
    },

    /*
    =====================================================
    MEMORY ENGINE
    =====================================================
    */

    memory: {

        save(fact) {

            if (!fact) return;

            const normalized =
                JARVIS.text.normalize(fact);

            const exists =
                JARVIS.state.memory.some(
                    item =>
                        JARVIS.text.normalize(
                            item.text
                        ) === normalized
                );

            if (exists) return;

            JARVIS.state.memory.push({

                id:
                    crypto.randomUUID
                    ? crypto.randomUUID()
                    : String(Date.now()),

                text: fact,

                createdAt: Date.now(),

                lastAccess: null
            });

            JARVIS.storage.save();

            console.log(
                "[MEMORY] Saved:",
                fact
            );
        },

        recall(query = "") {

            if (
                JARVIS.state.memory.length === 0
            ) {

                return [];
            }

            const q =
                JARVIS.text.normalize(query);

            const words =
                q.split(/\s+/)
                    .filter(Boolean);

            const results =
                JARVIS.state.memory
                    .map(memory => {

                        const text =
                            JARVIS.text.normalize(
                                memory.text
                            );

                        let score = 0;

                        for (
                            const word of words
                        ) {

                            if (
                                word.length > 1 &&
                                text.includes(word)
                            ) {

                                score++;
                            }
                        }

                        return {

                            ...memory,

                            score
                        };
                    })

                    .sort(
                        (a, b) =>
                            b.score - a.score
                    );

            return results
                .slice(0, 10);
        },

        all() {

            return [
                ...JARVIS.state.memory
            ];
        },

        clear() {

            JARVIS.state.memory = [];

            JARVIS.storage.save();
        }
    },

    /*
    =====================================================
    MODEL GATEWAY
    =====================================================

    هنا المكان الذي سنوصل فيه الموديل الحقيقي.

    حاليا يعمل Local Understanding Model
    حتى JARVIS يشتغل بدون API.
    =====================================================
    */

    model: {

        enabled: false,

        endpoint: "",

        apiKey: "",

        modelName: "",

        async understand(message) {

            if (
                this.enabled &&
                this.endpoint
            ) {

                try {

                    return await
                        this.remoteModel(
                            message
                        );

                } catch (error) {

                    console.warn(
                        "Remote model failed.",
                        error
                    );
                }
            }

            return this.localModel(
                message
            );
        },

        async remoteModel(message) {

            const prompt = {

                system: `
You are the UNDERSTANDING MODEL
inside J.A.R.V.I.S Cognitive OS.

Your job is NOT to answer the user.

Your job is to understand the message
and return structured JSON.

Possible intents:

greeting
memory_save
memory_recall
memory_forget
system_status
settings
goal_set
planning
task_start
task_update
decision
question
chat
unknown

Return ONLY JSON.

Schema:

{
 "intent": "",
 "subIntent": "",
 "goal": null,
 "memoryAction": "none",
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
`,

                conversation:
                    JARVIS.conversation
                        .contextText(12),

                message
            };

            const response =
                await fetch(
                    this.endpoint,
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            ...(this.apiKey
                                ? {
                                    Authorization:
                                        `Bearer ${this.apiKey}`
                                }
                                : {})
                        },

                        body:
                            JSON.stringify({

                                model:
                                    this.modelName,

                                messages: [

                                    {
                                        role:
                                            "system",

                                        content:
                                            prompt.system
                                    },

                                    {
                                        role:
                                            "user",

                                        content:
                                            JSON.stringify(
                                                prompt
                                            )
                                    }
                                ],

                                temperature:
                                    0.1
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
                data?.choices?.[0]
                    ?.message
                    ?.content
                ||
                data?.output_text
                ||
                data?.response;

            if (!raw) {

                throw new Error(
                    "Empty model response"
                );
            }

            return JSON.parse(
                String(raw)
                    .replace(
                        /^```json/i,
                        ""
                    )
                    .replace(
                        /```$/i,
                        ""
                    )
                    .trim()
            );
        },

        /*
        =================================================
        LOCAL SEMANTIC MODEL
        =================================================

        ده fallback فقط.

        بعد توصيل موديل حقيقي:
        model.enabled = true

        ساعتها الموديل هو الذي يحلل اللغة.
        =================================================
        */

        localModel(message) {

            const n =
                JARVIS.text.normalize(
                    message
                );

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

                urgency: 0.20,

                requiresContext: false,

                confidence: 0.55,

                reason:
                    "Local semantic fallback"
            };

            /*
            =============================================
            GREETING
            =============================================
            */

            if (
                JARVIS.text.includes(
                    n,
                    [
                        "صباح الخير",
                        "مساء الخير",
                        "السلام عليكم",
                        "اهلا",
                        "مرحبا",
                        "هاي"
                    ]
                )
            ) {

                result.intent =
                    "greeting";

                result.confidence =
                    0.98;

                return result;
            }

            /*
            =============================================
            SYSTEM
            =============================================
            */

            if (
                JARVIS.text.includes(
                    n,
                    [
                        "حالة النظام",
                        "حاله النظام",
                        "وضع النظام"
                    ]
                )
            ) {

                result.intent =
                    "system_status";

                result.confidence =
                    0.99;

                return result;
            }

            /*
            =============================================
            SETTINGS
            =============================================
            */

            if (
                JARVIS.text.includes(
                    n,
                    [
                        "اعداداتك",
                        "إعداداتك",
                        "اسلوب كلامك",
                        "اسلوبك"
                    ]
                )
            ) {

                result.intent =
                    "settings";

                result.confidence =
                    0.97;

                return result;
            }

            /*
            =============================================
            MEMORY RECALL
            =============================================
            */

            if (
                JARVIS.text.includes(
                    n,
                    [
                        "ماذا تتذكر",
                        "ايه الي فاكره",
                        "ايه اللي فاكره",
                        "تفتكر انا بحب ايه",
                        "هل تتذكر",
                        "هل فاكر",
                        "فكرني"
                    ]
                )
            ) {

                result.intent =
                    "memory_recall";

                result.memoryAction =
                    "recall";

                result.memoryQuery =
                    message;

                result.requiresContext =
                    true;

                result.confidence =
                    0.97;

                return result;
            }

            /*
            =============================================
            MEMORY SAVE
            =============================================
            */

            const savePattern =
                /^(?:تذكر|افتكر|احفظ|سجل)\s+(?:انني|اني|ان)?\s*(.+)$/i;

            const saveMatch =
                message.match(
                    savePattern
                );

            if (
                saveMatch
            ) {

                const fact =
                    saveMatch[1].trim();

                if (fact) {

                    result.intent =
                        "memory_save";

                    result.memoryAction =
                        "save";

                    result.factsToSave =
                        [fact];

                    result.confidence =
                        0.98;

                    return result;
                }
            }

            /*
            =============================================
            MEMORY FORGET
            =============================================
            */

            if (
                JARVIS.text.includes(
                    n,
                    [
                        "انس",
                        "انسي",
                        "احذف من ذاكرتك",
                        "لا تتذكر"
                    ]
                )
            ) {

                result.intent =
                    "memory_forget";

                result.memoryAction =
                    "forget";

                result.memoryQuery =
                    message;

                result.confidence =
                    0.92;

                return result;
            }

            /*
            =============================================
            CONTEXTUAL START
            =============================================
            */

            if (
                JARVIS.text.includes(
                    n,
                    [
                        "ابدأ",
                        "ابدا",
                        "يلا نبدأ",
                        "يلا نبدا",
                        "كمل",
                        "تابع",
                        "نفذ"
                    ]
                )
            ) {

                if (
                    JARVIS.state.goal ||
                    JARVIS.state.plan
                ) {

                    result.intent =
                        "task_start";

                    result.requiresContext =
                        true;

                    result.confidence =
                        0.96;

                } else {

                    result.intent =
                        "unknown";

                    result.confidence =
                        0.60;
                }

                return result;
            }

            /*
            =============================================
            PLANNING
            =============================================
            */

            const study =
                JARVIS.text.includes(
                    n,
                    [
                        "مذاكرة البرمجة",
                        "مذاكره البرمجه",
                        "ذاكر برمجه",
                        "دراسة البرمجة",
                        "دراسه البرمجه"
                    ]
                );

            const planning =
                JARVIS.text.includes(
                    n,
                    [
                        "خطط",
                        "خطة",
                        "خطه",
                        "جهزني",
                        "اعمل لي خطة"
                    ]
                );

            const urgent =
                JARVIS.text.includes(
                    n,
                    [
                        "متأخر",
                        "متاخر",
                        "مستعجل",
                        "بسرعة",
                        "بسرعه",
                        "الوقت ضيق",
                        "عايز اخلص بسرعة"
                    ]
                );

            const fastPlanBad =
                JARVIS.text.includes(
                    n,
                    [
                        "الخطة السريعة",
                        "الخطة السريعه",
                        "الطريقة السريعة",
                        "الطريقه السريعه"
                    ]
                )
                &&
                JARVIS.text.includes(
                    n,
                    [
                        "مشت بشكل وحش",
                        "ما نفعتش",
                        "ما نفعت",
                        "فشلت",
                        "وحشة",
                        "وحشه"
                    ]
                );

            if (
                study ||
                planning ||
                fastPlanBad
            ) {

                result.intent =
                    "planning";

                result.subIntent =
                    "study_session";

                result.goal =
                    "مذاكرة البرمجة";

                result.entities =
                    ["البرمجة"];

                result.requiresContext =
                    true;

                if (urgent) {

                    result.urgency =
                        0.92;

                    result.constraints.push(
                        "الوقت المتاح محدود"
                    );
                }

                if (fastPlanBad) {

                    result.preferences.push(
                        "تجنب الخطة السريعة"
                    );

                    result.constraints.push(
                        "الخطة السريعة لم تنجح سابقًا"
                    );
                }

                result.confidence =
                    0.94;

                return result;
            }

            /*
            =============================================
            DECISION
            =============================================
            */

            if (
                JARVIS.text.includes(
                    n,
                    [
                        "قارن 3 خطط",
                        "قارن ثلاث خطط",
                        "قارن الخطط",
                        "قارن الخطط قبل"
                    ]
                )
            ) {

                result.intent =
                    "decision";

                result.subIntent =
                    "compare_plans";

                result.confidence =
                    0.95;

                return result;
            }

            return result;
        }
    },

    /*
    =====================================================
    WORLD MODEL
    =====================================================
    */

    worldModel: {

        update(understanding) {

            JARVIS.state.world
                .currentContext =
                JARVIS.conversation
                    .recent(8);

            JARVIS.state.world
                .currentSituation = {

                    intent:
                        understanding.intent,

                    goal:
                        understanding.goal,

                    urgency:
                        understanding.urgency,

                    constraints:
                        understanding.constraints,

                    preferences:
                        understanding.preferences
                };

            JARVIS.state.world
                .userState = {

                    urgency:
                        understanding.urgency,

                    needsContext:
                        understanding.requiresContext
                };
        }
    },

    /*
    =====================================================
    GOAL ENGINE
    =====================================================
    */

    goals: {

        set(
            title,
            analysis
        ) {

            JARVIS.state.goal = {

                title,

                createdAt:
                    Date.now(),

                urgency:
                    analysis.urgency || 0,

                constraints:
                    analysis.constraints || [],

                preferences:
                    analysis.preferences || [],

                status:
                    "active"
            };

            JARVIS.storage.save();
        },

        clear() {

            JARVIS.state.goal =
                null;

            JARVIS.state.plan =
                null;

            JARVIS.storage.save();
        }
    },

    /*
    =====================================================
    PLANNER
    =====================================================
    */

    planner: {

        build(
            goal,
            analysis
        ) {

            const urgent =
                Number(
                    analysis.urgency || 0
                ) >= 0.75;

            const avoidFast =
                (
                    analysis.preferences ||
                    []
                ).some(
                    p =>
                        JARVIS.text.includes(
                            p,
                            [
                                "تجنب الخطة السريعة"
                            ]
                        )
                );

            const plans = [

                {

                    id: "intensive",

                    name:
                        "الخطة المكثفة",

                    score:
                        urgent
                            ? 0.76
                            : 0.60,

                    steps: [

                        "تحديد أهم جزء",

                        "جلسة تركيز قصيرة",

                        "تطبيق مباشر",

                        "مراجعة سريعة"
                    ]
                },

                {

                    id: "balanced",

                    name:
                        "الخطة المتوازنة",

                    score:
                        0.84,

                    steps: [

                        "تحديد نطاق المذاكرة",

                        "فهم المفاهيم",

                        "تطبيق عملي",

                        "مراجعة واختبار"
                    ]
                },

                {

                    id: "safe",

                    name:
                        "الخطة الآمنة",

                    score:
                        avoidFast
                            ? 0.92
                            : 0.79,

                    steps: [

                        "تقسيم الهدف",

                        "البدء بالجزء الأكثر وضوحًا",

                        "تطبيق تدريجي",

                        "التحقق من الإنجاز"
                    ]
                }
            ];

            /*
            الخطة السريعة/المكثفة تتأثر
            بالتجربة السابقة السيئة.
            */

            if (avoidFast) {

                const intensive =
                    plans.find(
                        p =>
                            p.id ===
                            "intensive"
                    );

                if (intensive) {

                    intensive.score -=
                        0.30;
                }
            }

            plans.sort(
                (a, b) =>
                    b.score - a.score
            );

            return {

                goal,

                compared:
                    plans.map(
                        p => ({

                            name:
                                p.name,

                            score:
                                Number(
                                    p.score
                                    .toFixed(2)
                                )
                        })
                    ),

                selected:
                    plans[0],

                reason:
                    avoidFast

                        ? "التجربة السابقة مع السرعة كانت سيئة، لذلك خفضت أولوية الخطة المكثفة."

                        : urgent

                            ? "الوقت ضيق، لذلك تم رفع أولوية التنفيذ العملي."

                            : "الخطة المتوازنة تحقق أفضل توازن حاليًا."
            };
        }
    },

    /*
    =====================================================
    DECISION ENGINE
    =====================================================
    */

    decision: {

        choose(plan) {

            if (!plan) {

                return null;
            }

            const selected =
                plan.selected;

            return {

                action:
                    selected.name,

                confidence:
                    Math.min(
                        0.99,
                        0.75 +
                        selected.score *
                        0.20
                    ),

                reason:
                    plan.reason
            };
        }
    },

    /*
    =====================================================
    EXECUTION ENGINE
    =====================================================
    */

    action: {

        start() {

            if (
                !JARVIS.state.goal
            ) {

                return {

                    success: false,

                    message:
                        "لا يوجد هدف حالي."
                };
            }

            if (
                !JARVIS.state.plan
            ) {

                return {

                    success: false,

                    message:
                        "لا توجد خطة جاهزة."
                };
            }

            JARVIS.state.plan.startedAt =
                Date.now();

            JARVIS.state.plan.currentStep =
                0;

            JARVIS.state.system
                .cognitiveState =
                "execution";

            JARVIS.storage.save();

            return {

                success: true,

                message:
                    "بدأ التنفيذ."
            };
        }
    },

    /*
    =====================================================
    REFLECTION ENGINE
    =====================================================
    */

    reflection: {

        review() {

            if (
                !JARVIS.state.plan
            ) {

                return null;
            }

            return {

                reviewedAt:
                    Date.now(),

                goal:
                    JARVIS.state.goal?.title,

                plan:
                    JARVIS.state.plan
                        ?.selected
                        ?.name,

                result:
                    "pending"
            };
        }
    },

    /*
    =====================================================
    RESPONSE ENGINE
    =====================================================
    */

    response: {

        generate(
            analysis
        ) {

            switch (
                analysis.intent
            ) {

                case "greeting":

                    return (
                        "صباح الخير يا سيدي. " +
                        "النواة المعرفية جاهزة."
                    );

                case "memory_save":

                    return (
                        "تم حفظ المعلومة في الذاكرة."
                    );

                case "memory_recall": {

                    const memories =
                        JARVIS.memory.recall(
                            analysis.memoryQuery
                        );

                    if (
                        !memories.length
                    ) {

                        return (
                            "بحثت في الذاكرة، " +
                            "ولم أجد معلومة مطابقة."
                        );
                    }

                    return (
                        "أتذكر:\n" +

                        memories
                            .map(
                                (m, i) =>
                                    `${i + 1}. ${m.text}`
                            )
                            .join("\n")
                    );
                }

                case "memory_forget":

                    return (
                        "سأحتاج تحديد المعلومة " +
                        "التي تريد حذفها بشكل أوضح."
                    );

                case "system_status":

                    return [

                        "النظام: يعمل",

                        "البيئة: web",

                        `الحالة المعرفية: ${
                            JARVIS.state.system
                                .cognitiveState
                        }`,

                        `الإدراك الداخلي: ${
                            Math.round(
                                JARVIS.state.system
                                    .awareness * 100
                            )
                        }%`,

                        `الانتباه: ${
                            Math.round(
                                JARVIS.state.system
                                    .attention * 100
                            )
                        }%`,

                        `الثقة: ${
                            Math.round(
                                JARVIS.state.system
                                    .confidence * 100
                            )
                        }%`,

                        `عدم اليقين: ${
                            Math.round(
                                JARVIS.state.system
                                    .uncertainty * 100
                            )
                        }%`,

                        `الهدف الحالي: ${
                            JARVIS.state.goal?.title
                            || "لا يوجد"
                        }`

                    ].join("\n");

                case "settings":

                    return [

                        "إعداداتي الحالية:",

                        `المخاطبة: ${
                            JARVIS.state.settings.address
                        }`,

                        `النبرة: ${
                            JARVIS.state.settings.tone
                        }`,

                        `الاختصار: ${
                            JARVIS.state.settings.concise
                                ? "مفعل"
                                : "غير مفعل"
                        }`,

                        `الرسمية: ${
                            Math.round(
                                JARVIS.state.settings
                                    .formality * 100
                            )
                        }%`,

                        `الفكاهة: ${
                            Math.round(
                                JARVIS.state.settings
                                    .humor * 100
                            )
                        }%`,

                        `المبادرة: ${
                            JARVIS.state.settings
                                .proactive
                                ? "مفعلة"
                                : "غير مفعلة"
                        }`

                    ].join("\n");

                case "planning": {

                    const goal =
                        analysis.goal ||
                        "هدف جديد";

                    JARVIS.goals.set(
                        goal,
                        analysis
                    );

                    const plan =
                        JARVIS.planner.build(
                            goal,
                            analysis
                        );

                    JARVIS.state.plan =
                        plan;

                    const decision =
                        JARVIS.decision
                            .choose(plan);

                    JARVIS.state.system
                        .confidence =
                        decision.confidence;

                    JARVIS.state.system
                        .uncertainty =
                        1 -
                        decision.confidence;

                    JARVIS.storage.save();

                    return [

                        `تم فهم الهدف: ${goal}`,

                        "حللت الحالة الحالية.",

                        "قارنت 3 خطط.",

                        `الخطة المختارة: ${
                            decision.action
                        }.`,

                        `سبب الاختيار: ${
                            decision.reason
                        }`,

                        "الجلسة جاهزة. " +
                        "قل «ابدأ» للتنفيذ."

                    ].join("\n");
                }

                case "task_start": {

                    const result =
                        JARVIS.action.start();

                    if (
                        !result.success
                    ) {

                        return result.message;
                    }

                    const plan =
                        JARVIS.state.plan;

                    return [

                        `بدأت: ${
                            JARVIS.state.goal.title
                        }`,

                        `الخطة: ${
                            plan.selected.name
                        }`,

                        "",

                        ...plan.selected.steps
                            .map(
                                (step, i) =>
                                    `${i + 1}. ${step}`
                            ),

                        "",

                        "حالة التنفيذ: نشطة."

                    ].join("\n");
                }

                case "decision":

                    if (
                        JARVIS.state.plan
                    ) {

                        const d =
                            JARVIS.decision
                                .choose(
                                    JARVIS.state.plan
                                );

                        return [

                            `القرار: ${
                                d.action
                            }`,

                            `السبب: ${
                                d.reason
                            }`,

                            `الثقة: ${
                                Math.round(
                                    d.confidence *
                                    100
                                )
                            }%`

                        ].join("\n");
                    }

                    return (
                        "لا توجد خطط حالية للمقارنة."
                    );

                default:

                    return (
                        "فهمت الرسالة، " +
                        "لكنني لا أملك يقينًا كافيًا " +
                        "لتحديد الإجراء المناسب."
                    );
            }
        }
    },

    /*
    =====================================================
    MAIN COGNITIVE LOOP
    =====================================================
    */

    async process(message) {

        console.log(
            "\n========== JARVIS CYCLE =========="
        );

        console.log(
            "[1] USER:",
            message
        );

        /*
        OBSERVE
        */

        this.state.system
            .cognitiveState =
            "understanding";

        /*
        UNDERSTAND
        */

        const understanding =
            await this.model
                .understand(message);

        console.log(
            "[2] UNDERSTANDING:",
            understanding
        );

        this.state.lastUnderstanding =
            understanding;

        this.state.system
            .confidence =
            Number(
                understanding.confidence
            ) || 0.5;

        this.state.system
            .uncertainty =
            1 -
            this.state.system.confidence;

        /*
        WORLD MODEL
        */

        this.worldModel.update(
            understanding
        );

        console.log(
            "[3] WORLD MODEL UPDATED"
        );

        /*
        REASON
        */

        this.state.system
            .cognitiveState =
            "reasoning";

        const reply =
            this.response.generate(
                understanding
            );

        console.log(
            "[4] RESPONSE:",
            reply
        );

        /*
        STORE CONVERSATION
        */

        this.conversation
            .addJarvis(reply);

        /*
        REFLECTION
        */

        this.state.system
            .cognitiveState =
            "reflection";

        this.reflection.review();

        /*
        DONE
        */

        this.state.system
            .cognitiveState =
            "idle";

        this.storage.save();

        console.log(
            "========== CYCLE COMPLETE ==========\n"
        );

        return reply;
    }
};


/*
=========================================================
UI
=========================================================
*/

function $(id) {

    return document.getElementById(id);
}


function renderMessages() {

    const container =
        $("messages");

    if (!container) return;

    container.innerHTML = "";

    for (
        const message
        of JARVIS.state.conversation
    ) {

        const div =
            document.createElement(
                "div"
            );

        div.className =
            "message " +
            (
                message.role === "user"
                    ? "user-message"
                    : "jarvis-message"
            );

        div.textContent =
            message.text;

        container.appendChild(
            div
        );
    }

    container.scrollTop =
        container.scrollHeight;
}


function renderAnalysis() {

    const container =
        $("analysis");

    if (!container) return;

    const a =
        JARVIS.state.lastUnderstanding;

    if (!a) {

        container.textContent =
            "لا يوجد تحليل بعد.";

        return;
    }

    container.innerHTML = `

        <div>
            <b>Intent:</b>
            ${escapeHTML(a.intent)}
        </div>

        <div>
            <b>Sub Intent:</b>
            ${escapeHTML(a.subIntent || "—")}
        </div>

        <div>
            <b>Goal:</b>
            ${escapeHTML(a.goal || "—")}
        </div>

        <div>
            <b>Memory:</b>
            ${escapeHTML(a.memoryAction)}
        </div>

        <div>
            <b>Urgency:</b>
            ${Math.round(
                (a.urgency || 0) * 100
            )}%
        </div>

        <div>
            <b>Confidence:</b>
            ${Math.round(
                (a.confidence || 0) * 100
            )}%
        </div>

        <div>
            <b>Context:</b>
            ${a.requiresContext
                ? "مطلوب"
                : "غير مطلوب"
            }
        </div>
    `;
}


function renderMemory() {

    const container =
        $("memory");

    if (!container) return;

    const memories =
        JARVIS.memory.all();

    if (!memories.length) {

        container.textContent =
            "الذاكرة فارغة.";

        return;
    }

    container.innerHTML =
        memories
            .slice(-10)
            .reverse()
            .map(
                m =>
                    `<div>• ${
                        escapeHTML(m.text)
                    }</div>`
            )
            .join("");
}


function renderPlan() {

    const container =
        $("plan");

    if (!container) return;

    const plan =
        JARVIS.state.plan;

    if (!plan) {

        container.textContent =
            "لا توجد خطة.";

        return;
    }

    container.innerHTML = `

        <div>
            <b>الهدف:</b>
            ${escapeHTML(plan.goal)}
        </div>

        <div>
            <b>الخطة المختارة:</b>
            ${escapeHTML(
                plan.selected.name
            )}
        </div>

        <div>
            <b>السبب:</b>
            ${escapeHTML(plan.reason)}
        </div>

        <hr>

        ${plan.compared
            .map(
                p =>
                    `<div>
                        ${escapeHTML(p.name)}
                        —
                        ${p.score}
                    </div>`
            )
            .join("")}

        <hr>

        ${plan.selected.steps
            .map(
                (step, i) =>
                    `<div>
                        ${i + 1}.
                        ${escapeHTML(step)}
                    </div>`
            )
            .join("")}
    `;
}


function renderSystem() {

    const system =
        JARVIS.state.system;

    if ($("systemState")) {

        $("systemState")
            .textContent =
            system.status === "online"
                ? "يعمل"
                : "متوقف";
    }

    if ($("processing")) {

        $("processing")
            .textContent =
            system.cognitiveState;
    }

    if ($("confidence")) {

        $("confidence")
            .textContent =
            Math.round(
                system.confidence * 100
            ) + "%";
    }

    if ($("goal")) {

        $("goal")
            .textContent =
            JARVIS.state.goal?.title
            || "لا يوجد";
    }
}


function renderAll() {

    renderMessages();

    renderAnalysis();

    renderMemory();

    renderPlan();

    renderSystem();
}


function escapeHTML(text) {

    return String(text || "")
        .replace(
            /[&<>"']/g,
            char => ({

                "&": "&amp;",

                "<": "&lt;",

                ">": "&gt;",

                '"': "&quot;",

                "'": "&#039;"

            }[char])
        );
}


/*
=========================================================
SEND MESSAGE
=========================================================
*/

async function sendMessage() {

    const input =
        $("userInput");

    if (!input) return;

    const message =
        input.value.trim();

    if (!message) return;

    input.value = "";

    JARVIS.conversation
        .addUser(message);

    renderAll();

    const reply =
        await JARVIS.process(
            message
        );

    renderAll();

    speak(reply);
}


/*
=========================================================
VOICE
=========================================================
*/

function speak(text) {

    if (
        !JARVIS.state.settings
            .voiceEnabled
    ) return;

    if (
        !("speechSynthesis" in window)
    ) return;

    speechSynthesis.cancel();

    const utterance =
        new SpeechSynthesisUtterance(
            text
        );

    utterance.lang =
        "ar-EG";

    utterance.rate =
        JARVIS.state.settings
            .voiceRate;

    speechSynthesis.speak(
        utterance
    );
}


/*
=========================================================
BOOT
=========================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        JARVIS.storage.load();

        const form =
            $("chatForm");

        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    sendMessage();
                }
            );
        }

        const voiceButton =
            $("voiceBtn");

        if (voiceButton) {

            voiceButton.addEventListener(
                "click",
                () => {

                    JARVIS.state
                        .settings
                        .voiceEnabled =
                        !JARVIS.state
                            .settings
                            .voiceEnabled;

                    JARVIS.storage.save();
                }
            );
        }

        renderAll();

        console.log(
            "J.A.R.V.I.S COGNITIVE OS v2 ONLINE"
        );
    }
);
