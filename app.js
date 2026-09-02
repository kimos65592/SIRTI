/* =========================================================
   J.A.R.V.I.S V4 — CORE INTELLIGENCE
   WEB PROTOTYPE

   Modules:
   - Arabic normalization
   - Memory
   - Intent Router
   - Security Policy
   - Tool Registry
   - Task Planner
   - Confirmation Manager
   - TTS
   - Conversation Controller

   Android layer is intentionally NOT included here.
========================================================= */


/* =========================================================
   1. ARABIC NORMALIZATION
========================================================= */

function normalizeArabic(text) {

    if (!text) {
        return "";
    }

    const arabicNumbers = [
        "٠", "١", "٢", "٣", "٤",
        "٥", "٦", "٧", "٨", "٩"
    ];

    let result =
        String(text)
            .toLowerCase()

            .replace(
                /[إأآٱ]/g,
                "ا"
            )

            .replace(
                /ى/g,
                "ي"
            )

            .replace(
                /ة/g,
                "ه"
            )

            .replace(
                /[\u0617-\u061A\u064B-\u0652]/g,
                ""
            )

            .replace(
                /\s+/g,
                " "
            )

            .trim();


    for (let i = 0; i < 10; i++) {

        result =
            result.replace(
                new RegExp(
                    arabicNumbers[i],
                    "g"
                ),
                String(i)
            );

    }

    return result;
}


/* =========================================================
   2. UI
========================================================= */

const ui = {

    form:
        document.getElementById(
            "command-form"
        ),

    input:
        document.getElementById(
            "user-input"
        ),

    status:
        document.getElementById(
            "status-text"
        ),

    log:
        document.getElementById(
            "chat-log"
        ),

    memoryStatus:
        document.getElementById(
            "memory-status"
        ),

    ttsStatus:
        document.getElementById(
            "tts-status"
        ),

    commandCount:
        document.getElementById(
            "command-count"
        )
};


/* =========================================================
   3. UI MESSAGES
========================================================= */

function appendMessage(
    type,
    sender,
    text
) {

    const message =
        document.createElement(
            "div"
        );

    message.className =
        `message ${type}`;


    const senderElement =
        document.createElement(
            "span"
        );

    senderElement.className =
        "sender";

    senderElement.textContent =
        sender;


    const body =
        document.createElement(
            "div"
        );

    body.textContent =
        text;


    message.append(
        senderElement,
        body
    );


    ui.log.appendChild(
        message
    );


    ui.log.scrollTop =
        ui.log.scrollHeight;
}


function userMessage(text) {

    appendMessage(
        "user",
        "USER",
        text
    );
}


function jarvisMessage(text) {

    appendMessage(
        "jarvis",
        "J.A.R.V.I.S",
        text
    );
}


function securityMessage(text) {

    appendMessage(
        "security",
        "SECURITY",
        text
    );
}


function errorMessage(text) {

    appendMessage(
        "error",
        "SYSTEM",
        text
    );
}


function setStatus(text) {

    ui.status.textContent =
        text;
}


/* =========================================================
   4. MEMORY STORE
========================================================= */

class MemoryStore {

    constructor() {

        this.storageKey =
            "jarvis_core_memory_v1";

        this.data =
            this.load();
    }


    load() {

        try {

            const saved =
                localStorage.getItem(
                    this.storageKey
                );


            if (!saved) {

                return {
                    facts: [],
                    preferences: {},
                    history: []
                };
            }


            const parsed =
                JSON.parse(saved);


            return {

                facts:
                    Array.isArray(parsed.facts)
                        ? parsed.facts
                        : [],

                preferences:
                    parsed.preferences &&
                    typeof parsed.preferences === "object"
                        ? parsed.preferences
                        : {},

                history:
                    Array.isArray(parsed.history)
                        ? parsed.history
                        : []
            };

        } catch (error) {

            console.error(
                "[Memory Load]",
                error
            );


            return {
                facts: [],
                preferences: {},
                history: []
            };
        }
    }


    save() {

        try {

            localStorage.setItem(
                this.storageKey,
                JSON.stringify(
                    this.data
                )
            );

            ui.memoryStatus.textContent =
                "ONLINE";

        } catch (error) {

            ui.memoryStatus.textContent =
                "ERROR";

            console.error(
                "[Memory Save]",
                error
            );
        }
    }


    remember(text) {

        const clean =
            text.trim();


        if (!clean) {
            return false;
        }


        const exists =
            this.data.facts.some(
                fact =>
                    normalizeArabic(fact) ===
                    normalizeArabic(clean)
            );


        if (!exists) {

            this.data.facts.push(
                clean
            );

            this.save();

            return true;
        }


        return false;
    }


    forget(text) {

        const normalized =
            normalizeArabic(text);


        const before =
            this.data.facts.length;


        this.data.facts =
            this.data.facts.filter(
                fact =>
                    normalizeArabic(fact) !==
                    normalized
            );


        this.save();


        return (
            before !==
            this.data.facts.length
        );
    }


    getFacts() {

        return [
            ...this.data.facts
        ];
    }


    addHistory(
        role,
        content
    ) {

        this.data.history.push({

            role,

            content,

            timestamp:
                Date.now()

        });


        /*
         * Keep local history bounded.
         */

        if (
            this.data.history.length >
            100
        ) {

            this.data.history =
                this.data.history.slice(
                    -100
                );
        }


        this.save();
    }


    clear() {

        this.data = {

            facts: [],

            preferences: {},

            history: []
        };


        this.save();
    }
}


const memory =
    new MemoryStore();


/* =========================================================
   5. VOICE OUTPUT / TTS
========================================================= */

class VoiceOutput {

    constructor() {

        this.engine =
            "speechSynthesis" in window
                ? window.speechSynthesis
                : null;

        this.voice =
            null;

        this.loadVoices();


        if (this.engine) {

            ui.ttsStatus.textContent =
                "READY";


            this.engine.onvoiceschanged =
                () => {

                    this.loadVoices();

                };

        } else {

            ui.ttsStatus.textContent =
                "UNAVAILABLE";
        }
    }


    loadVoices() {

        if (!this.engine) {
            return;
        }


        const voices =
            this.engine.getVoices();


        this.voice =
            voices.find(
                item =>
                    item.lang &&
                    item.lang
                        .toLowerCase() ===
                    "ar-eg"
            )

            ||

            voices.find(
                item =>
                    item.lang &&
                    item.lang
                        .toLowerCase()
                        .startsWith("ar")
            )

            ||

            null;
    }


    speak(text) {

        if (
            !this.engine ||
            !text
        ) {
            return;
        }


        try {

            this.engine.cancel();


            const utterance =
                new SpeechSynthesisUtterance(
                    text
                );


            utterance.lang =
                "ar-EG";

            utterance.rate =
                0.95;

            utterance.pitch =
                1.0;

            utterance.volume =
                1.0;


            if (this.voice) {

                utterance.voice =
                    this.voice;
            }


            this.engine.speak(
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


const voiceOutput =
    new VoiceOutput();


/* =========================================================
   6. ACTION DEFINITIONS
========================================================= */

const ACTIONS = Object.freeze({

    torch: {
        risk: "low"
    },

    vibrate: {
        risk: "low"
    },

    open_app: {
        risk: "medium"
    },

    call: {
        risk: "high"
    },

    remember: {
        risk: "low"
    },

    forget: {
        risk: "medium"
    },

    calculator: {
        risk: "low"
    },

    system_status: {
        risk: "low"
    },

    help: {
        risk: "low"
    }

});


/* =========================================================
   7. INTENT ROUTER
========================================================= */

class IntentRouter {


    static route(rawText) {

        const text =
            normalizeArabic(
                rawText
            );


        /* =========================
           TORCH ON
        ========================= */

        if (
            /^(شغل الكشاف|شغل الفلاش|تفعيل الكشاف|افتح الكشاف)$/
                .test(text)
        ) {

            return {
                matched: true,
                action: "torch",
                payload: "on"
            };
        }


        /* =========================
           TORCH OFF
        ========================= */

        if (
            /^(اطفي الكشاف|طفي الكشاف|ايقاف الكشاف|اغلق الكشاف|اقفل الكشاف)$/
                .test(text)
        ) {

            return {
                matched: true,
                action: "torch",
                payload: "off"
            };
        }


        /* =========================
           VIBRATION
        ========================= */

        if (
            /^(اهتز|اهتزاز|هز الهاتف)$/
                .test(text)
        ) {

            return {
                matched: true,
                action: "vibrate",
                payload: 1000
            };
        }


        const vibration =
            text.match(
                /^اهتز لمدة (\d+) (ثانيه|ثواني|ثان)$/
            );


        if (vibration) {

            const seconds =
                Number(
                    vibration[1]
                );


            return {
                matched: true,
                action: "vibrate",
                payload:
                    seconds * 1000
            };
        }


        /* =========================
           OPEN APPLICATION
        ========================= */

        const appMatch =
            text.match(
                /^(?:افتح|شغل) (?:تطبيق )?(.+)$/
            );


        if (appMatch) {

            const requested =
                appMatch[1].trim();


            const apps = {

                "واتساب":
                    "whatsapp",

                "واتس":
                    "whatsapp",

                "يوتيوب":
                    "youtube",

                "كروم":
                    "chrome",

                "الكاميرا":
                    "camera",

                "الاعدادات":
                    "settings"

            };


            if (
                apps[requested]
            ) {

                return {

                    matched: true,

                    action:
                        "open_app",

                    payload:
                        apps[requested],

                    displayName:
                        requested
                };
            }
        }


        /* =========================
           CALL
        ========================= */

        const callMatch =
            text.match(
                /^اتصل\s*(?:بـ|ب|على)?\s*(.+)$/
            );


        if (callMatch) {

            const candidate =
                callMatch[1]
                    .replace(
                        /[\s\-()]/g,
                        ""
                    );


            if (
                /^\d+$/.test(candidate) &&
                /^01[0125]\d{8}$/
                    .test(candidate)
            ) {

                return {

                    matched: true,

                    action:
                        "call",

                    payload:
                        candidate
                };
            }


            return {

                matched: false,

                action: null,

                payload: null
            };
        }


        /* =========================
           REMEMBER
        ========================= */

        const rememberMatch =
            text.match(
                /^(?:تذكر|افتكر|احفظ)\s+(?:ان|إن)?\s*(.+)$/
            );


        if (rememberMatch) {

            return {

                matched: true,

                action:
                    "remember",

                payload:
                    rememberMatch[1]
            };
        }


        /* =========================
           FORGET
        ========================= */

        const forgetMatch =
            text.match(
                /^(?:انس|انسى|احذف من ذاكرتك)\s+(.+)$/
            );


        if (forgetMatch) {

            return {

                matched: true,

                action:
                    "forget",

                payload:
                    forgetMatch[1]
            };
        }


        /* =========================
           MEMORY QUERY
        ========================= */

        if (
            /^(ماذا تتذكر عني|ماذا تتذكر|ذاكرتي|اعرض ذاكرتك)$/
                .test(text)
        ) {

            return {

                matched: true,

                action:
                    "memory_list",

                payload:
                    null
            };
        }


        /* =========================
           CLEAR MEMORY
        ========================= */

        if (
            /^(امسح ذاكرتك|انس كل شيء|امسح الذاكره)$/
                .test(text)
        ) {

            return {

                matched: true,

                action:
                    "memory_clear",

                payload:
                    null
            };
        }


        /* =========================
           SYSTEM STATUS
        ========================= */

        if (
            /^(حاله النظام|النظام|حالة النظام|status)$/
                .test(text)
        ) {

            return {

                matched: true,

                action:
                    "system_status",

                payload:
                    null
            };
        }


        /* =========================
           HELP
        ========================= */

        if (
            /^(مساعده|مساعدة|الاوامر|الأوامر|ماذا تستطيع)$/
                .test(text)
        ) {

            return {

                matched: true,

                action:
                    "help",

                payload:
                    null
            };
        }


        /* =========================
           CALCULATOR
        ========================= */

        const calculateMatch =
            text.match(
                /^(?:احسب|كم يساوي|كام)\s+(.+)$/
            );


        if (calculateMatch) {

            return {

                matched: true,

                action:
                    "calculator",

                payload:
                    calculateMatch[1]
            };
        }


        /* =========================
           SIMPLE GREETINGS
        ========================= */

        if (
            /^(السلام عليكم|سلام عليكم|اهلا|اهلاً|هاي|hello|مرحبا|صباح الخير|مساء الخير)$/
                .test(text)
        ) {

            return {

                matched: true,

                action:
                    "greeting",

                payload:
                    text
            };
        }


        /* =========================
           DIRECT CONVERSATION
        ========================= */

        if (
            /^(عامل ايه|ازيك|اخبارك|كيف حالك|من انت|انت مين)$/
                .test(text)
        ) {

            return {

                matched: true,

                action:
                    "conversation",

                payload:
                    text
            };
        }


        return {

            matched: false,

            action: null,

            payload: null
        };
    }
}


/* =========================================================
   8. SECURITY POLICY
========================================================= */

class SecurityPolicy {


    static validate(
        action,
        payload
    ) {

        if (
            !Object.prototype.hasOwnProperty.call(
                ACTIONS,
                action
            )
        ) {

            return {

                valid: false,

                requiresConfirmation: false,

                error:
                    "الأمر غير موجود في سجل الأدوات."
            };
        }


        switch (action) {


            case "torch":

                return {

                    valid:
                        payload === "on" ||
                        payload === "off",

                    requiresConfirmation:
                        false,

                    error:
                        "حالة الكشاف غير صالحة."
                };


            case "vibrate":

                return {

                    valid:
                        Number.isInteger(
                            payload
                        ) &&
                        payload > 0 &&
                        payload <= 10000,

                    requiresConfirmation:
                        false,

                    error:
                        "مدة الاهتزاز يجب أن تكون بين 1 و10000 ملي ثانية."
                };


            case "open_app":

                return {

                    valid:
                        typeof payload ===
                            "string" &&
                        [
                            "whatsapp",
                            "youtube",
                            "chrome",
                            "camera",
                            "settings"
                        ].includes(payload),

                    requiresConfirmation:
                        false,

                    error:
                        "التطبيق غير موجود في القائمة الآمنة."
                };


            case "call":

                return {

                    valid:
                        typeof payload ===
                            "string" &&
                        /^01[0125]\d{8}$/
                            .test(payload),

                    requiresConfirmation:
                        true,

                    error:
                        "رقم الهاتف غير مطابق للصيغة المصرية."
                };


            case "remember":

                return {

                    valid:
                        typeof payload ===
                            "string" &&
                        payload.length >= 2 &&
                        payload.length <= 300,

                    requiresConfirmation:
                        false,

                    error:
                        "البيان المراد حفظه غير صالح."
                };


            case "forget":

                return {

                    valid:
                        typeof payload ===
                            "string" &&
                        payload.length >= 2 &&
                        payload.length <= 300,

                    requiresConfirmation:
                        true,

                    error:
                        "البيان المراد حذفه غير صالح."
                };


            case "calculator":

                return {

                    valid:
                        typeof payload ===
                            "string" &&
                        payload.length > 0 &&
                        payload.length <= 100,

                    requiresConfirmation:
                        false,

                    error:
                        "المعادلة غير صالحة."
                };


            default:

                return {

                    valid: true,

                    requiresConfirmation:
                        false,

                    error: null
                };
        }
    }
}


/* =========================================================
   9. CONFIRMATION MANAGER
========================================================= */

class ConfirmationManager {


    constructor() {

        this.pending =
            null;
    }


    request(action) {

        this.pending =
            action;

        setStatus(
            "WAITING FOR CONFIRMATION"
        );
    }


    hasPending() {

        return !!this.pending;
    }


    getPending() {

        return this.pending;
    }


    clear() {

        this.pending =
            null;

        setStatus(
            "SYSTEM STANDBY"
        );
    }


    isYes(text) {

        return /^(نعم|ايوه|أيوه|موافق|اوافق|وافق|تاكيد|تأكيد|اكد|أكيد)$/
            .test(
                normalizeArabic(text)
            );
    }


    isNo(text) {

        return /^(لا|لأ|الغاء|الغى|إلغاء|رفض|مش موافق)$/
            .test(
                normalizeArabic(text)
            );
    }
}


const confirmation =
    new ConfirmationManager();


/* =========================================================
   10. CALCULATOR
========================================================= */

function calculateExpression(
    input
) {

    let expression =
        normalizeArabic(
            input
        );


    expression =
        expression
            .replace(
                /×/g,
                "*"
            )

            .replace(
                /÷/g,
                "/"
            )

            .replace(
                /٪/g,
                "%"
            )

            .replace(
                /[^0-9+\-*/%().\s]/g,
                ""
            )

            .trim();


    if (!expression) {
        return null;
    }


    /*
     * Small recursive-descent parser.
     * No eval() / Function().
     */

    let position = 0;


    function skipSpaces() {

        while (
            position <
            expression.length &&
            /\s/.test(
                expression[position]
            )
        ) {

            position++;
        }
    }


    function parseNumber() {

        skipSpaces();


        const start =
            position;


        while (
            position <
                expression.length &&
            /[0-9.]/.test(
                expression[position]
            )
        ) {

            position++;
        }


        if (
            start ===
            position
        ) {

            return null;
        }


        const value =
            Number(
                expression.slice(
                    start,
                    position
                )
            );


        return Number.isFinite(
            value
        )
            ? value
            : null;
    }


    function parseFactor() {

        skipSpaces();


        if (
            expression[position] ===
            "("
        ) {

            position++;


            const value =
                parseExpression();


            skipSpaces();


            if (
                expression[position] ===
                ")"
            ) {

                position++;

                return value;
            }


            return null;
        }


        if (
            expression[position] ===
            "-"
        ) {

            position++;

            const value =
                parseFactor();


            return value === null
                ? null
                : -value;
        }


        return parseNumber();
    }


    function parseTerm() {

        let left =
            parseFactor();


        if (left === null) {
            return null;
        }


        while (true) {

            skipSpaces();


            const operator =
                expression[
                    position
                ];


            if (
                operator !== "*" &&
                operator !== "/" &&
                operator !== "%"
            ) {

                break;
            }


            position++;


            const right =
                parseFactor();


            if (right === null) {
                return null;
            }


            if (
                operator === "*"
            ) {

                left *= right;

            } else if (
                operator === "/"
            ) {

                if (
                    right === 0
                ) {

                    return null;
                }

                left /= right;

            } else {

                if (
                    right === 0
                ) {

                    return null;
                }

                left %= right;
            }
        }


        return left;
    }


    function parseExpression() {

        let left =
            parseTerm();


        if (left === null) {
            return null;
        }


        while (true) {

            skipSpaces();


            const operator =
                expression[
                    position
                ];


            if (
                operator !== "+" &&
                operator !== "-"
            ) {

                break;
            }


            position++;


            const right =
                parseTerm();


            if (right === null) {
                return null;
            }


            if (
                operator === "+"
            ) {

                left += right;

            } else {

                left -= right;
            }
        }


        return left;
    }


    const result =
        parseExpression();


    skipSpaces();


    if (
        result === null ||
        position !==
            expression.length
    ) {

        return null;
    }


    if (
        !Number.isFinite(
            result
        )
    ) {

        return null;
    }


    return result;
}


/* =========================================================
   11. TOOL REGISTRY
========================================================= */

class ToolRegistry {


    constructor() {

        this.tools =
            new Map();
    }


    register(
        name,
        handler
    ) {

        this.tools.set(
            name,
            handler
        );
    }


    exists(name) {

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
                "Tool not registered"
            );
        }


        return await this.tools
            .get(name)(
                payload
            );
    }
}


const tools =
    new ToolRegistry();


/* =========================================================
   12. WEB SIMULATION TOOLS
========================================================= */

tools.register(
    "torch",
    payload => {

        console.log(
            "[WEB TOOL] Torch:",
            payload
        );

        return {
            success: true,

            message:
                payload === "on"
                    ? "تم تفعيل الكشاف في وضع المحاكاة."
                    : "تم إيقاف الكشاف في وضع المحاكاة."
        };
    }
);


tools.register(
    "vibrate",
    payload => {

        if (
            typeof navigator.vibrate ===
            "function"
        ) {

            navigator.vibrate(
                payload
            );
        }


        console.log(
            "[WEB TOOL] Vibrate:",
            payload
        );


        return {

            success: true,

            message:
                `تم تشغيل الاهتزاز لمدة ${payload / 1000} ثانية.`
        };
    }
);


tools.register(
    "open_app",
    payload => {

        console.log(
            "[WEB TOOL] Open app:",
            payload
        );


        return {

            success: true,

            message:
                `تم تجهيز فتح التطبيق ${payload} في وضع المحاكاة.`
        };
    }
);


tools.register(
    "call",
    payload => {

        console.log(
            "[WEB TOOL] Call:",
            payload
        );


        return {

            success: true,

            message:
                `تم اعتماد الاتصال بالرقم ${payload}. التنفيذ الحقيقي مؤجل لطبقة Android.`
        };
    }
);


/* =========================================================
   13. TASK PLANNER
========================================================= */

class TaskPlanner {


    plan(
        route
    ) {

        if (
            !route ||
            !route.matched
        ) {

            return [];
        }


        /*
         * Each task is an atomic action.
         * Android V2 can later execute the same plan
         * through native tools.
         */

        return [

            {

                action:
                    route.action,

                payload:
                    route.payload,

                metadata: {
                    displayName:
                        route.displayName ||
                        route.action
                }
            }

        ];
    }
}


const planner =
    new TaskPlanner();


/* =========================================================
   14. BRAIN
========================================================= */

class JarvisBrain {


    async process(
        rawText
    ) {

        const text =
            rawText.trim();


        if (!text) {
            return;
        }


        userMessage(
            text
        );


        memory.addHistory(
            "user",
            text
        );


        ui.commandCount.textContent =
            String(
                this.getCommandCount()
            );


        /*
         * Confirmation comes first.
         */

        if (
            confirmation.hasPending()
        ) {

            await this.handleConfirmation(
                text
            );

            return;
        }


        /*
         * Route.
         */

        const route =
            IntentRouter.route(
                text
            );


        if (
            !route.matched
        ) {

            await this.handleUnknown(
                text
            );

            return;
        }


        /*
         * Special conversational/system actions.
         */

        if (
            route.action ===
            "greeting"
        ) {

            const response =
                this.getGreeting();


            this.respond(
                response
            );

            return;
        }


        if (
            route.action ===
            "conversation"
        ) {

            const response =
                this.getConversationResponse(
                    route.payload
                );


            this.respond(
                response
            );

            return;
        }


        if (
            route.action ===
            "system_status"
        ) {

            this.respond(
                this.getSystemStatus()
            );

            return;
        }


        if (
            route.action ===
            "help"
        ) {

            this.respond(
                this.getHelp()
            );

            return;
        }


        if (
            route.action ===
            "memory_list"
        ) {

            this.respond(
                this.getMemoryResponse()
            );

            return;
        }


        if (
            route.action ===
            "memory_clear"
        ) {

            this.handleMemoryClear();

            return;
        }


        if (
            route.action ===
            "remember"
        ) {

            this.handleRemember(
                route.payload
            );

            return;
        }


        if (
            route.action ===
            "forget"
        ) {

            this.handleForget(
                route.payload
            );

            return;
        }


        if (
            route.action ===
            "calculator"
        ) {

            this.handleCalculator(
                route.payload
            );

            return;
        }


        /*
         * Security.
         */

        const validation =
            SecurityPolicy.validate(
                route.action,
                route.payload
            );


        if (
            !validation.valid
        ) {

            securityMessage(
                validation.error
            );


            voiceOutput.speak(
                "تم رفض الأمر أمنيًا."
            );


            return;
        }


        /*
         * High-risk actions require confirmation.
         */

        if (
            validation.requiresConfirmation
        ) {

            confirmation.request({

                action:
                    route.action,

                payload:
                    route.payload
            });


            setStatus(
                "WAITING FOR CONFIRMATION"
            );


            securityMessage(
                `تنبيه أمني: سيتم تنفيذ ${this.actionLabel(route.action)} للرقم ${route.payload}. هل تؤكد؟`
            );


            voiceOutput.speak(
                "هناك عملية حساسة. هل تؤكد التنفيذ؟ قل نعم أو لا."
            );


            return;
        }


        /*
         * Build atomic plan.
         */

        const plan =
            planner.plan(
                route
            );


        await this.executePlan(
            plan
        );
    }


    async executePlan(
        plan
    ) {

        if (!Array.isArray(plan)) {
            return;
        }


        setStatus(
            "EXECUTING"
        );


        for (
            const step of plan
        ) {

            try {

                const result =
                    await tools.execute(
                        step.action,
                        step.payload
                    );


                if (
                    result &&
                    result.success
                ) {

                    this.respond(
                        result.message
                    );

                } else {

                    errorMessage(
                        "تعذر تنفيذ الأداة."
                    );

                    voiceOutput.speak(
                        "تعذر تنفيذ الأداة."
                    );
                }


            } catch (error) {

                console.error(
                    "[Tool Execution]",
                    error
                );


                errorMessage(
                    "حدث خطأ أثناء تنفيذ الأداة."
                );


                voiceOutput.speak(
                    "حدث خطأ أثناء التنفيذ."
                );
            }
        }


        setStatus(
            "SYSTEM STANDBY"
        );
    }


    async handleConfirmation(
        text
    ) {

        if (
            confirmation.isYes(text)
        ) {

            const pending =
                confirmation.getPending();


            confirmation.clear();


            const validation =
                SecurityPolicy.validate(
                    pending.action,
                    pending.payload
                );


            if (
                !validation.valid
            ) {

                securityMessage(
                    "تعذر اعتماد العملية مرة أخرى."
                );

                voiceOutput.speak(
                    "تعذر اعتماد العملية."
                );

                return;
            }


            const plan =
                planner.plan({

                    matched: true,

                    action:
                        pending.action,

                    payload:
                        pending.payload
                });


            await this.executePlan(
                plan
            );


            return;
        }


        if (
            confirmation.isNo(text)
        ) {

            confirmation.clear();


            this.respond(
                "تم إلغاء العملية بأمان."
            );


            return;
        }


        securityMessage(
            "لم أفهم التأكيد. قل نعم أو لا."
        );


        voiceOutput.speak(
            "يرجى الرد بنعم أو لا."
        );
    }


    handleRemember(
        fact
    ) {

        const saved =
            memory.remember(
                fact
            );


        if (saved) {

            this.respond(
                `حسنًا، سأحتفظ بهذه المعلومة: ${fact}`
            );

        } else {

            this.respond(
                "هذه المعلومة موجودة بالفعل في ذاكرتي."
            );
        }
    }


    handleForget(
        fact
    ) {

        /*
         * Deleting memory is intentionally
         * confirmation-protected.
         */

        confirmation.request({

            action:
                "forget",

            payload:
                fact
        });


        setStatus(
            "WAITING FOR CONFIRMATION"
        );


        securityMessage(
            `هل تؤكد حذف هذه المعلومة من الذاكرة: ${fact}؟`
        );


        voiceOutput.speak(
            "هل تؤكد حذف هذه المعلومة من الذاكرة؟"
        );
    }


    handleMemoryClear() {

        confirmation.request({

            action:
                "memory_clear",

            payload:
                null
        });


        setStatus(
            "WAITING FOR CONFIRMATION"
        );


        securityMessage(
            "هذا سيمسح الذاكرة المحلية بالكامل. هل تؤكد؟"
        );


        voiceOutput.speak(
            "سيتم مسح الذاكرة المحلية بالكامل. هل تؤكد؟"
        );
    }


    handleCalculator(
        expression
    ) {

        const result =
            calculateExpression(
                expression
            );


        if (
            result === null
        ) {

            errorMessage(
                "لم أستطع فهم المعادلة."
            );


            voiceOutput.speak(
                "لم أستطع فهم المعادلة."
            );


            return;
        }


        this.respond(
            `النتيجة: ${result}`
        );
    }


    getMemoryResponse() {

        const facts =
            memory.getFacts();


        if (
            facts.length === 0
        ) {

            return "ذاكرتي المحلية فارغة حاليًا.";
        }


        return [
            "هذه المعلومات المحفوظة لدي:",
            ...facts.map(
                (fact, index) =>
                    `${index + 1}. ${fact}`
            )
        ].join("\n");
    }


    getSystemStatus() {

        const facts =
            memory.getFacts().length;


        return [
            "كل الأنظمة الأساسية تعمل.",

            "العقل: ONLINE",

            "الموجّه: READY",

            "الأمان: ACTIVE",

            `الذاكرة المحلية: ${facts} معلومة`,

            `عدد الأوامر في الجلسة: ${this.getCommandCount()}`,

            "الوضع الحالي: WEB CORE"
        ].join("\n");
    }


    getHelp() {

        return [
            "أستطيع حاليًا:",

            "• تشغيل/إيقاف الكشاف — محاكاة",

            "• الاهتزاز",

            "• تجهيز فتح التطبيقات — محاكاة",

            "• الاتصال بعد التأكيد — محاكاة",

            "• حفظ معلومات في الذاكرة",

            "• حذف معلومات بعد التأكيد",

            "• حساب المعادلات",

            "• عرض حالة النظام",

            "• إجراء محادثة أساسية",

            "التحكم الحقيقي بالهاتف سيأتي عندما نوصل طبقة Android."
        ].join("\n");
    }


    getGreeting() {

        return "مرحبًا. J.A.R.V.I.S جاهز للعمل.";
    }


    getConversationResponse(
        text
    ) {

        const normalized =
            normalizeArabic(
                text
            );


        if (
            normalized ===
            "ازيك"
        ) {

            return "بخير وجاهز للعمل. ماذا تريد أن نفعل؟";
        }


        if (
            normalized ===
            "عامل ايه"
        ) {

            return "كل الأنظمة الأساسية مستقرة وأنا جاهز.";
        }


        if (
            normalized ===
            "من انت" ||
            normalized ===
            "انت مين"
        ) {

            return "أنا نواة J.A.R.V.I.S التجريبية: ذاكرة، توجيه أوامر، أمان، أدوات، تخطيط وتنفيذ محكوم.";
        }


        if (
            normalized ===
            "اخبارك"
        ) {

            return "الوضع مستقر. الذاكرة والموجّه والحماية تعمل.";
        }


        return "أنا جاهز. قل لي ماذا تريد.";
    }


    getCommandCount() {

        const stored =
            Number(
                sessionStorage.getItem(
                    "jarvis_command_count"
                ) || "0"
            );


        return stored;
    }


    incrementCommandCount() {

        const next =
            this.getCommandCount() + 1;


        sessionStorage.setItem(
            "jarvis_command_count",
            String(next)
        );


        ui.commandCount.textContent =
            String(next);
    }


    actionLabel(
        action
    ) {

        const labels = {

            call:
                "الاتصال",

            forget:
                "حذف المعلومة",

            memory_clear:
                "مسح الذاكرة"

        };


        return (
            labels[action] ||
            action
        );
    }


    respond(
        text
    ) {

        if (!text) {
            return;
        }


        jarvisMessage(
            text
        );


        memory.addHistory(
            "assistant",
            text
        );


        voiceOutput.speak(
            text
        );
    }


    async handleUnknown(
        text
    ) {

        /*
         * This is deliberately conservative.
         *
         * We do not pretend an LLM understood
         * something when the deterministic core
         * actually did not.
         */

        this.respond(
            `أفهم أنك قلت: "${text}".\nلكن هذا الطلب غير موجود بعد في سجل قدراتي.`
        );
    }
}


const brain =
    new JarvisBrain();


/* =========================================================
   15. SPECIAL CONFIRMATION EXECUTION PATCH
========================================================= */

const originalToolExecute =
    tools.execute.bind(tools);


tools.execute = async function(
    name,
    payload
) {

    /*
     * Memory operations are not passed
     * to the external/native tools.
     */

    if (
        name === "forget"
    ) {

        const removed =
            memory.forget(
                payload
            );


        return {

            success: removed,

            message:
                removed
                    ? `تم حذف المعلومة من الذاكرة: ${payload}`
                    : "لم أجد هذه المعلومة في الذاكرة."
        };
    }


    if (
        name === "memory_clear"
    ) {

        memory.clear();


        return {

            success: true,

            message:
                "تم مسح الذاكرة المحلية."
        };
    }


    return originalToolExecute(
        name,
        payload
    );
};


/* =========================================================
   16. CONFIRMATION ROUTE EXTENSION
========================================================= */

const originalHandleConfirmation =
    brain.handleConfirmation.bind(
        brain
    );


brain.handleConfirmation =
    async function(text) {

        if (
            confirmation.isYes(text)
        ) {

            const pending =
                confirmation.getPending();


            if (
                pending &&
                (
                    pending.action ===
                        "memory_clear" ||
                    pending.action ===
                        "forget"
                )
            ) {

                confirmation.clear();


                const result =
                    await tools.execute(
                        pending.action,
                        pending.payload
                    );


                this.respond(
                    result.message
                );


                return;
            }
        }


        await originalHandleConfirmation(
            text
        );
    };


/* =========================================================
   17. COMMAND INPUT
========================================================= */

ui.form.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const text =
            ui.input.value.trim();


        if (!text) {
            return;
        }


        ui.input.value = "";


        brain.incrementCommandCount();


        await brain.process(
            text
        );


        ui.input.focus();
    }
);


/* =========================================================
   18. UNIT TESTS
========================================================= */

function runUnitTests() {

    const tests = [

        {
            input:
                "شغل الكشاف",

            action:
                "torch"
        },

        {
            input:
                "اطفي الكشاف",

            action:
                "torch"
        },

        {
            input:
                "اهتز لمدة 2 ثانية",

            action:
                "vibrate"
        },

        {
            input:
                "افتح واتساب",

            action:
                "open_app"
        },

        {
            input:
                "اتصل بـ 01012345678",

            action:
                "call"
        },

        {
            input:
                "اتصل بـ 010 1234 5678",

            action:
                "call"
        },

        {
            input:
                "افتح تطبيق ضار",

            action:
                null
        },

        {
            input:
                "تذكر أنني أحب الرياضيات",

            action:
                "remember"
        },

        {
            input:
                "ماذا تتذكر عني",

            action:
                "memory_list"
        },

        {
            input:
                "احسب 25 × 4",

            action:
                "calculator"
        },

        {
            input:
                "حالة النظام",

            action:
                "system_status"
        }

    ];


    let passed = 0;


    for (
        const test of tests
    ) {

        const result =
            IntentRouter.route(
                test.input
            );


        if (
            result.action ===
            test.action
        ) {

            passed++;

            console.log(
                "✅ PASS:",
                test.input
            );

        } else {

            console.error(
                "❌ FAIL:",
                test.input,
                result
            );
        }
    }


    console.log(
        `[JARVIS CORE TESTS] ${passed}/${tests.length} passed.`
    );


    return (
        passed ===
        tests.length
    );
}


/* =========================================================
   19. BOOT
========================================================= */

function bootJarvis() {

    console.log(
        "========================================"
    );


    console.log(
        "J.A.R.V.I.S V4 CORE"
    );


    console.log(
        "Booting..."
    );


    const testsPassed =
        runUnitTests();


    ui.memoryStatus.textContent =
        "ONLINE";


    ui.commandCount.textContent =
        String(
            brain.getCommandCount()
        );


    setStatus(
        testsPassed
            ? "SYSTEM READY"
            : "CORE TEST FAILURE"
    );


    jarvisMessage(
        "مرحبًا. J.A.R.V.I.S Core V4 جاهز. اكتب «مساعدة» لمعرفة ما أستطيع فعله."
    );


    voiceOutput.speak(
        "جارفيس جاهز للعمل."
    );


    ui.input.focus();


    console.log(
        "J.A.R.V.I.S Core ready."
    );
}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        bootJarvis
    );

} else {

    bootJarvis();
}
