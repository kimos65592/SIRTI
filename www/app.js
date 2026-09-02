"use strict";

/*
=========================================================
J.A.R.V.I.S V5.1
BRAIN LAB
=========================================================

ARCHITECTURE:

Perception
    ↓
World Model
    ↓
Memory
    ↓
Goal System
    ↓
Planner
    ↓
Policy
    ↓
Tool Engine
    ↓
Result
    ↓
World Model

NO ANDROID
NO API
NO MIC
NO EXTERNAL DEPENDENCIES
=========================================================
*/


/* =========================================================
   UTILITIES
========================================================= */

function normalizeArabic(text) {

    if (!text) {
        return "";
    }

    return text
        .toLowerCase()
        .replace(/[إأآا]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(
            /[\u0617-\u061A\u064B-\u0652]/g,
            ""
        )
        .replace(/[٠-٩]/g, d =>
            String(
                "٠١٢٣٤٥٦٧٨٩"
                    .indexOf(d)
            )
        )
        .trim();
}


/* =========================================================
   UI
========================================================= */

const UI = {

    chat:
        document.getElementById("chat"),

    input:
        document.getElementById("input"),

    form:
        document.getElementById(
            "command-form"
        ),

    status:
        document.getElementById(
            "status"
        ),

    system:
        document.getElementById(
            "system-state"
        ),

    time:
        document.getElementById(
            "time-state"
        ),

    idle:
        document.getElementById(
            "idle-state"
        ),

    battery:
        document.getElementById(
            "battery-state"
        ),

    goal:
        document.getElementById(
            "goal-state"
        )
};


function addMessage(
    type,
    text
) {

    const box =
        document.createElement(
            "div"
        );

    box.className =
        `message ${type}`;


    const sender =
        document.createElement(
            "span"
        );

    sender.className =
        "sender";


    sender.textContent =
        type === "user"
            ? "YOU"
            : type === "jarvis"
                ? "J.A.R.V.I.S"
                : "SYSTEM";


    const body =
        document.createElement(
            "div"
        );

    body.textContent =
        text;


    box.append(
        sender,
        body
    );


    UI.chat.appendChild(
        box
    );


    UI.chat.scrollTop =
        UI.chat.scrollHeight;
}


/* =========================================================
   VOICE OUTPUT
========================================================= */

class VoiceOutput {

    constructor() {

        this.enabled =
            "speechSynthesis"
            in window;
    }


    speak(text) {

        if (
            !this.enabled ||
            !text
        ) {
            return;
        }


        try {

            window.speechSynthesis.cancel();


            const utterance =
                new SpeechSynthesisUtterance(
                    text
                );


            utterance.lang =
                "ar-EG";

            utterance.rate =
                0.95;

            utterance.pitch =
                0.9;

            utterance.volume =
                1;


            window.speechSynthesis.speak(
                utterance
            );

        } catch (error) {

            console.error(
                "[TTS]",
                error
            );
        }
    }
}


const voice =
    new VoiceOutput();


function jarvisSay(text) {

    addMessage(
        "jarvis",
        text
    );

    voice.speak(
        text
    );
}


/* =========================================================
   WORLD MODEL
========================================================= */

class WorldModel {

    constructor() {

        this.state = {

            time:
                new Date(),

            environment:
                "web",

            pageVisible:
                document.visibilityState ===
                "visible",

            idleSeconds:
                0,

            battery:
                null,

            activeGoal:
                null,

            activePlan:
                null,

            currentTask:
                null,

            lastAction:
                null,

            lastResult:
                null
        };
    }


    update(data) {

        Object.assign(
            this.state,
            data
        );
    }


    get(key) {

        return this.state[key];
    }


    snapshot() {

        return {
            ...this.state
        };
    }
}


const world =
    new WorldModel();


/* =========================================================
   MEMORY
========================================================= */

class MemorySystem {

    constructor() {

        this.key =
            "jarvis_v5_memory";

        this.data =
            this.load();
    }


    load() {

        try {

            const raw =
                localStorage.getItem(
                    this.key
                );


            return raw
                ? JSON.parse(raw)
                : {
                    facts: [],
                    events: []
                };

        } catch {

            return {
                facts: [],
                events: []
            };
        }
    }


    save() {

        localStorage.setItem(
            this.key,
            JSON.stringify(
                this.data
            )
        );
    }


    rememberFact(
        key,
        value
    ) {

        const existing =
            this.data.facts.find(
                item =>
                    item.key === key
            );


        if (existing) {

            existing.value =
                value;

        } else {

            this.data.facts.push({
                key,
                value,
                createdAt:
                    Date.now()
            });
        }


        this.save();
    }


    recall(key) {

        const item =
            this.data.facts.find(
                item =>
                    item.key === key
            );


        return item
            ? item.value
            : null;
    }


    recordEvent(
        type,
        data = {}
    ) {

        this.data.events.push({

            type,

            data,

            timestamp:
                Date.now()
        });


        /*
         * Keep local memory
         * reasonably small.
         */

        if (
            this.data.events.length >
            200
        ) {

            this.data.events =
                this.data.events.slice(
                    -200
                );
        }


        this.save();
    }
}


const memory =
    new MemorySystem();


/* =========================================================
   GOAL SYSTEM
========================================================= */

class GoalSystem {

    constructor(
        worldModel
    ) {

        this.world =
            worldModel;

        this.goals = [];

        this.counter = 0;
    }


    create(
        description,
        priority = 50
    ) {

        const goal = {

            id:
                ++this.counter,

            description,

            priority,

            status:
                "active",

            createdAt:
                Date.now()
        };


        this.goals.push(
            goal
        );


        this.world.update({

            activeGoal:
                goal
        });


        memory.recordEvent(
            "goal_created",
            goal
        );


        return goal;
    }


    complete(goal) {

        goal.status =
            "completed";


        if (
            this.world.get(
                "activeGoal"
            )?.id === goal.id
        ) {

            this.world.update({

                activeGoal:
                    null
            });
        }


        memory.recordEvent(
            "goal_completed",
            goal
        );
    }
}


const goalSystem =
    new GoalSystem(
        world
    );


/* =========================================================
   TOOL ENGINE
========================================================= */

class ToolEngine {

    constructor() {

        this.tools =
            new Map();
    }


    register(
        name,
        executor
    ) {

        this.tools.set(
            name,
            executor
        );
    }


    has(name) {

        return this.tools.has(
            name
        );
    }


    async execute(
        name,
        payload
    ) {

        if (
            !this.tools.has(name)
        ) {

            throw new Error(
                `Unknown tool: ${name}`
            );
        }


        return await this.tools
            .get(name)(
                payload
            );
    }
}


const tools =
    new ToolEngine();


/* =========================================================
   WEB TOOLS
========================================================= */

tools.register(
    "focus_mode",
    async state => {

        console.log(
            "[TOOL] focus_mode:",
            state
        );


        return {

            success:
                true,

            message:
                state === "on"
                    ? "تم تفعيل وضع التركيز."
                    : "تم إيقاف وضع التركيز."
        };
    }
);


tools.register(
    "development_environment",
    async () => {

        console.log(
            "[TOOL] development_environment"
        );


        return {

            success:
                true,

            message:
                "بيئة البرمجة جاهزة — محاكاة Web."
        };
    }
);


tools.register(
    "timer",
    async minutes => {

        const value =
            Number(minutes);


        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            return {

                success:
                    false,

                message:
                    "مدة المؤقت غير صالحة."
            };
        }


        console.log(
            `[TOOL] Timer: ${value} minutes`
        );


        return {

            success:
                true,

            message:
                `تم إنشاء مؤقت لمدة ${value} دقيقة.`
        };
    }
);


tools.register(
    "announce",
    async text => {

        jarvisSay(
            text
        );


        return {

            success:
                true,

            message:
                text
        };
    }
);


/* =========================================================
   PLANNER
========================================================= */

class Planner {

    constructor(
        worldModel
    ) {

        this.world =
            worldModel;
    }


    build(goal) {

        const text =
            normalizeArabic(
                goal.description
            );


        /*
         * Programming study
         */

        if (
            text.includes(
                "مذاكره البرمجه"
            ) ||
            text.includes(
                "مذاكره البرمجة"
            ) ||
            text.includes(
                "برمجه"
            )
        ) {

            return {

                goalId:
                    goal.id,

                steps: [

                    {
                        id:
                            1,

                        tool:
                            "focus_mode",

                        payload:
                            "on"
                    },

                    {
                        id:
                            2,

                        tool:
                            "development_environment",

                        payload:
                            null
                    },

                    {
                        id:
                            3,

                        tool:
                            "timer",

                        payload:
                            120
                    },

                    {
                        id:
                            4,

                        tool:
                            "announce",

                        payload:
                            "تم تجهيز جلسة مذاكرة البرمجة. لنبدأ."
                    }
                ]
            };
        }


        /*
         * Generic goal.
         */

        return {

            goalId:
                goal.id,

            steps: [

                {
                    id:
                        1,

                    tool:
                        "announce",

                    payload:
                        `تم تحليل الهدف: ${goal.description}`
                }
            ]
        };
    }
}


const planner =
    new Planner(
        world
    );


/* =========================================================
   SECURITY POLICY
========================================================= */

class SecurityPolicy {

    canExecute(
        toolName,
        payload
    ) {

        /*
         * Current Web Lab:
         * only explicitly registered
         * tools may execute.
         */

        if (
            !tools.has(toolName)
        ) {

            return {

                allowed:
                    false,

                reason:
                    "الأداة غير مسجلة."
            };
        }


        /*
         * Reject suspicious
         * executable strings.
         */

        if (
            typeof payload ===
                "string" &&
            /<script|javascript:|eval\(/i
                .test(payload)
        ) {

            return {

                allowed:
                    false,

                reason:
                    "تم رفض الحمولة لأسباب أمنية."
            };
        }


        return {

            allowed:
                true,

            reason:
                null
        };
    }
}


const security =
    new SecurityPolicy();


/* =========================================================
   PLAN EXECUTOR
========================================================= */

class PlanExecutor {

    constructor() {

        this.running =
            false;
    }


    async execute(
        plan,
        goal
    ) {

        if (this.running) {

            return {

                success:
                    false,

                message:
                    "هناك خطة أخرى قيد التنفيذ."
            };
        }


        this.running =
            true;


        world.update({

            activePlan:
                plan
        });


        try {

            for (
                const step of
                    plan.steps
            ) {

                world.update({

                    currentTask:
                        step.tool
                });


                /*
                 * Security gate
                 */

                const policy =
                    security.canExecute(
                        step.tool,
                        step.payload
                    );


                if (
                    !policy.allowed
                ) {

                    return {

                        success:
                            false,

                        message:
                            policy.reason
                    };
                }


                const result =
                    await tools.execute(
                        step.tool,
                        step.payload
                    );


                world.update({

                    lastAction:
                        step.tool,

                    lastResult:
                        result
                });


                memory.recordEvent(
                    "tool_execution",
                    {
                        tool:
                            step.tool,

                        result
                    }
                );


                if (
                    !result ||
                    !result.success
                ) {

                    return {

                        success:
                            false,

                        message:
                            `فشلت الخطوة: ${step.tool}`
                    };
                }
            }


            goalSystem.complete(
                goal
            );


            return {

                success:
                    true,

                message:
                    "اكتملت الخطة."
            };

        } finally {

            this.running =
                false;


            world.update({

                currentTask:
                    null,

                activePlan:
                    null
            });
        }
    }
}


const executor =
    new PlanExecutor();


/* =========================================================
   COMMAND UNDERSTANDING
========================================================= */

function understand(
    raw
) {

    const text =
        normalizeArabic(
            raw
        );


    /*
     * Memory command
     */

    const remember =
        text.match(
            /^تذكر انني (.+)$/
        );


    if (remember) {

        return {

            type:
                "remember",

            value:
                remember[1]
        };
    }


    /*
     * Recall command
     */

    if (
        text.includes(
            "ماذا تتذكر"
        )
    ) {

        return {

            type:
                "recall"
        };
    }


    /*
     * Goal command
     */

    const goal =
        text.match(
            /^(?:جهزني ل|جهز لي|اعمل لي|خطط لي)\s+(.+)$/
        );


    if (goal) {

        return {

            type:
                "goal",

            description:
                goal[1]
        };
    }


    /*
     * Simple status
     */

    if (
        text.includes(
            "حالتك"
        ) ||
        text.includes(
            "حاله النظام"
        )
    ) {

        return {

            type:
                "status"
        };
    }


    return {

        type:
            "unknown",

        text
    };
}


/* =========================================================
   BRAIN
========================================================= */

class JarvisBrain {

    async process(
        rawText
    ) {

        const understanding =
            understand(
                rawText
            );


        console.log(
            "[BRAIN]",
            understanding
        );


        switch (
            understanding.type
        ) {


            case "remember":

                memory.rememberFact(
                    "user_fact",
                    understanding.value
                );


                jarvisSay(
                    "تم حفظ المعلومة في ذاكرتي."
                );

                return;


            case "recall":

                const fact =
                    memory.recall(
                        "user_fact"
                    );


                if (fact) {

                    jarvisSay(
                        `أتذكر أنك قلت: ${fact}`
                    );

                } else {

                    jarvisSay(
                        "لا توجد لدي معلومات محفوظة حتى الآن."
                    );
                }

                return;


            case "status":

                this.reportStatus();

                return;


            case "goal":

                await this.handleGoal(
                    understanding.description
                );

                return;


            default:

                jarvisSay(
                    "فهمت ما كتبته، لكنني لا أملك أداة أو خطة مناسبة لهذا الهدف حتى الآن."
                );
        }
    }


    async handleGoal(
        description
    ) {

        const goal =
            goalSystem.create(
                description,
                70
            );


        jarvisSay(
            `تم تحديد الهدف: ${description}`
        );


        const plan =
            planner.build(
                goal
            );


        jarvisSay(
            `بنيت خطة من ${plan.steps.length} خطوات.`
        );


        const result =
            await executor.execute(
                plan,
                goal
            );


        if (
            result.success
        ) {

            jarvisSay(
                "اكتملت المهمة بنجاح."
            );

        } else {

            jarvisSay(
                `توقفت الخطة: ${result.message}`
            );
        }
    }


    reportStatus() {

        const state =
            world.snapshot();


        const goal =
            state.activeGoal;


        jarvisSay(
            [
                `النظام: يعمل`,
                `البيئة: ${state.environment}`,
                `الخمول: ${state.idleSeconds} ثانية`,
                `الهدف الحالي: ${goal?.description || "لا يوجد"}`,
                `المهمة الحالية: ${state.currentTask || "لا يوجد"}`
            ].join("\n")
        );
    }
}


const brain =
    new JarvisBrain();


/* =========================================================
   CONSCIOUSNESS ENGINE
========================================================= */

class ConsciousnessEngine {

    constructor() {

        this.interval =
            null;

        this.lastInteraction =
            Date.now();

        this.lastProactive =
            {};
    }


    start() {

        if (this.interval) {
            return;
        }


        this.interval =
            setInterval(
                () => this.tick(),
                10000
            );


        this.tick();
    }


    updateInteraction() {

        this.lastInteraction =
            Date.now();
    }


    tick() {

        const now =
            new Date();


        const idle =
            Math.floor(
                (
                    Date.now() -
                    this.lastInteraction
                ) / 1000
            );


        world.update({

            time:
                now,

            idleSeconds:
                idle,

            pageVisible:
                document.visibilityState ===
                "visible"
        });


        this.updateUI();


        /*
         * We deliberately don't
         * spam the user.
         */

        if (
            idle >= 300 &&
            document.visibilityState ===
                "visible"
        ) {

            const last =
                this.lastProactive.idle
                || 0;


            if (
                Date.now() -
                last >
                1800000
            ) {

                this.lastProactive.idle =
                    Date.now();


                jarvisSay(
                    "أنا ما زلت هنا يا سيدي. إذا احتجت شيئًا فأنا جاهز."
                );
            }
        }
    }


    updateUI() {

        const state =
            world.snapshot();


        UI.time.textContent =
            state.time
                .toLocaleTimeString(
                    "ar-EG"
                );


        UI.idle.textContent =
            `${state.idleSeconds} sec`;


        UI.battery.textContent =
            state.battery === null
                ? "غير متاح في هذا المتصفح"
                : `${state.battery}%`;


        UI.goal.textContent =
            state.activeGoal
                ?.description
                || "None";
    }
}


const consciousness =
    new ConsciousnessEngine();


/* =========================================================
   BATTERY SENSOR
========================================================= */

async function initializeBattery() {

    if (
        typeof navigator.getBattery !==
        "function"
    ) {

        return;
    }


    try {

        const battery =
            await navigator.getBattery();


        function update() {

            world.update({

                battery:
                    Math.round(
                        battery.level *
                        100
                    )
            });


            consciousness.updateUI();
        }


        update();


        battery.addEventListener(
            "levelchange",
            update
        );

    } catch (error) {

        console.warn(
            "[Battery]",
            error
        );
    }
}


/* =========================================================
   USER ACTIVITY
========================================================= */

[
    "click",
    "keydown",
    "touchstart",
    "pointerdown"
].forEach(
    event => {

        document.addEventListener(
            event,
            () =>
                consciousness
                    .updateInteraction(),
            {
                passive:
                    true
            }
        );
    }
);


/* =========================================================
   FORM
========================================================= */

UI.form.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const text =
            UI.input.value.trim();


        if (!text) {
            return;
        }


        UI.input.value =
            "";


        consciousness
            .updateInteraction();


        addMessage(
            "user",
            text
        );


        await brain.process(
            text
        );
    }
);


/* =========================================================
   INITIALIZATION
========================================================= */

function initialize() {

    console.log(
        "================================="
    );

    console.log(
        "J.A.R.V.I.S V5.1"
    );

    console.log(
        "BRAIN LAB ONLINE"
    );

    console.log(
        "================================="
    );


    addMessage(
        "jarvis",
        "صباح الخير يا سيدي. نظام العقل V5.1 يعمل. أنا جاهز لتحليل الأهداف وبناء الخطط."
    );


    initializeBattery();


    consciousness.start();


    UI.input.focus();
}


initialize();
