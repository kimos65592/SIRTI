/*
 * =========================================================
 * J.A.R.V.I.S V3.1
 * WEB PROTOTYPE
 *
 * Architecture:
 *
 * User
 *   ↓
 * Normalizer
 *   ↓
 * Intent Router
 *   ↓
 * Security Validator
 *   ↓
 * Confirmation Manager
 *   ↓
 * Action Executor
 *   ↓
 * Voice Output
 *
 * No Android APIs.
 * No external APIs.
 * No network required.
 * =========================================================
 */


/* =========================================================
   ARABIC NORMALIZER
========================================================= */

function normalizeArabic(text) {

    if (!text) {
        return "";
    }

    const arabicNumbers = [
        "٠", "١", "٢", "٣", "٤",
        "٥", "٦", "٧", "٨", "٩"
    ];

    let normalized = String(text)
        .toLowerCase()

        // Arabic letter normalization
        .replace(/[إأآٱا]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")

        // Remove tashkeel
        .replace(/[\u0617-\u061A\u064B-\u0652]/g, "")

        // Normalize whitespace
        .replace(/\s+/g, " ")
        .trim();

    for (let i = 0; i < arabicNumbers.length; i++) {

        normalized = normalized.replace(
            new RegExp(arabicNumbers[i], "g"),
            String(i)
        );
    }

    return normalized;
}


/* =========================================================
   APPLICATION REGISTRY
========================================================= */

const APP_REGISTRY = Object.freeze({

    "واتساب": {
        id: "whatsapp",
        displayName: "واتساب"
    },

    "واتس": {
        id: "whatsapp",
        displayName: "واتساب"
    },

    "يوتيوب": {
        id: "youtube",
        displayName: "يوتيوب"
    },

    "كروم": {
        id: "chrome",
        displayName: "Google Chrome"
    },

    "الكاميرا": {
        id: "camera",
        displayName: "الكاميرا"
    },

    "الاعدادات": {
        id: "settings",
        displayName: "الإعدادات"
    }

});


/* =========================================================
   SYSTEM STATE
========================================================= */

const jarvisState = {

    mode: "IDLE",

    pendingAction: null,

    lastIntent: null,

    lastCommand: null,

    commandCount: 0,

    sessionStarted: Date.now()

};


/* =========================================================
   UI
========================================================= */

const ui = {

    form: document.getElementById("command-form"),

    input: document.getElementById("user-input"),

    status: document.getElementById("status-text"),

    voiceStatus: document.getElementById("voice-status"),

    log: document.getElementById("chat-log")

};


/* =========================================================
   UI HELPERS
========================================================= */

function appendMessage(type, sender, text) {

    const message = document.createElement("div");

    message.className = `message ${type}`;

    const senderElement =
        document.createElement("span");

    senderElement.className = "sender";

    senderElement.textContent = sender;

    const body =
        document.createElement("div");

    body.textContent = text;

    message.append(
        senderElement,
        body
    );

    ui.log.appendChild(message);

    ui.log.scrollTop = ui.log.scrollHeight;
}


function setStatus(status) {

    ui.status.textContent = status;
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
        "SYSTEM ERROR",
        text
    );
}


/* =========================================================
   VOICE OUTPUT
========================================================= */

class VoiceOutput {

    constructor() {

        this.engine =
            window.speechSynthesis || null;

        this.enabled = !!this.engine;

        this.voice = null;

        this.loadVoices();

        if (this.enabled) {

            window.speechSynthesis.onvoiceschanged =
                () => this.loadVoices();
        }
    }


    loadVoices() {

        if (!this.enabled) {
            return;
        }

        const voices =
            window.speechSynthesis.getVoices();

        if (!voices.length) {
            return;
        }

        // Prefer Arabic Egypt
        this.voice =
            voices.find(
                voice =>
                    voice.lang &&
                    voice.lang.toLowerCase() === "ar-eg"
            )

            ||

            voices.find(
                voice =>
                    voice.lang &&
                    voice.lang.toLowerCase().startsWith("ar")
            )

            ||

            null;

        ui.voiceStatus.textContent =
            this.voice
                ? "ARABIC READY"
                : "TTS READY";
    }


    speak(text) {

        if (!this.enabled || !text) {
            return;
        }

        try {

            this.engine.cancel();

            const utterance =
                new SpeechSynthesisUtterance(text);

            utterance.lang = "ar-EG";

            utterance.rate = 0.95;

            utterance.pitch = 1.0;

            utterance.volume = 1.0;

            if (this.voice) {
                utterance.voice = this.voice;
            }

            this.engine.speak(utterance);

        } catch (error) {

            console.error(
                "[JARVIS TTS ERROR]",
                error
            );
        }
    }
}


const voiceOutput =
    new VoiceOutput();


/* =========================================================
   SIMULATED NATIVE BRIDGE
========================================================= */

class WebSimulationBridge {


    static vibrate(milliseconds) {

        console.log(
            `[SIMULATION] Vibrate: ${milliseconds}ms`
        );

        if (
            "vibrate" in navigator
        ) {

            navigator.vibrate(
                milliseconds
            );
        }

        return true;
    }


    static toggleTorch(state) {

        console.log(
            `[SIMULATION] Torch: ${state}`
        );

        return true;
    }


    static openApp(appId) {

        console.log(
            `[SIMULATION] Open App: ${appId}`
        );

        return true;
    }


    static call(phoneNumber) {

        console.log(
            `[SIMULATION] Call: ${phoneNumber}`
        );

        return true;
    }

}


/* =========================================================
   INTENT ROUTER
========================================================= */

class IntentRouter {


    static route(rawText) {

        const text =
            normalizeArabic(rawText);


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
            /^(اهتز|اهتزاز)$/
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

            return {
                matched: true,
                action: "vibrate",
                payload:
                    Number(vibration[1]) * 1000
            };
        }


        /* =========================
           OPEN APP
        ========================= */

        const appMatch =
            text.match(/^افتح (.+)$/);


        if (appMatch) {

            const appName =
                appMatch[1].trim();

            const app =
                APP_REGISTRY[appName];

            if (app) {

                return {
                    matched: true,
                    action: "open_app",
                    payload: app.id,
                    displayName: app.displayName
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
                    .replace(/[\s\-()]/g, "");


            if (
                /^\d+$/.test(candidate)
            ) {

                if (
                    /^01[0125]\d{8}$/
                        .test(candidate)
                ) {

                    return {
                        matched: true,
                        action: "call",
                        payload: candidate
                    };
                }
            }
        }


        /* =========================
           SYSTEM STATUS
        ========================= */

        if (
            /^(حاله النظام|حالة النظام|النظام|status)$/
                .test(text)
        ) {

            return {
                matched: true,
                action: "system_status",
                payload: null
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
                action: "help",
                payload: null
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
   ACTION VALIDATOR
========================================================= */

class ActionValidator {


    static validate(action, payload) {

        switch (action) {


            case "torch":

                return {
                    isValid:
                        payload === "on" ||
                        payload === "off",

                    requiresConfirmation: false,

                    error:
                        "حالة الكشاف غير صالحة."
                };


            case "vibrate":

                return {

                    isValid:
                        Number.isInteger(payload) &&
                        payload > 0 &&
                        payload <= 10000,

                    requiresConfirmation: false,

                    error:
                        "مدة الاهتزاز غير صالحة."
                };


            case "open_app":

                return {

                    isValid:
                        Object
                            .values(APP_REGISTRY)
                            .some(
                                app =>
                                    app.id === payload
                            ),

                    requiresConfirmation: false,

                    error:
                        "التطبيق غير موجود في القائمة الآمنة."
                };


            case "call":

                return {

                    isValid:
                        /^01[0125]\d{8}$/
                            .test(payload),

                    requiresConfirmation: true,

                    error:
                        "رقم الهاتف غير مطابق للصيغة المصرية."
                };


            case "system_status":

                return {
                    isValid: true,
                    requiresConfirmation: false,
                    error: null
                };


            case "help":

                return {
                    isValid: true,
                    requiresConfirmation: false,
                    error: null
                };


            default:

                return {
                    isValid: false,
                    requiresConfirmation: false,
                    error: "Action غير مسجلة."
                };
        }
    }

}


/* =========================================================
   CONFIRMATION MANAGER
========================================================= */

class ConfirmationManager {


    static isYes(text) {

        return /^(نعم|ايوه|أيوه|موافق|اوافق|وافق|تاكيد|تأكيد|اكد|أكد)$/
            .test(
                normalizeArabic(text)
            );
    }


    static isNo(text) {

        return /^(لا|لأ|الغاء|إلغاء|رفض|مش موافق)$/
            .test(
                normalizeArabic(text)
            );
    }


    static request(action) {

        jarvisState.mode =
            "WAITING_FOR_CONFIRMATION";

        jarvisState.pendingAction =
            action;

        setStatus(
            "WAITING FOR CONFIRMATION"
        );
    }


    static clear() {

        jarvisState.mode = "IDLE";

        jarvisState.pendingAction = null;

        setStatus(
            "SYSTEM STANDBY"
        );
    }
}


/* =========================================================
   ACTION EXECUTOR
========================================================= */

class ActionExecutor {


    static execute(action, payload) {


        switch (action) {


            case "torch": {

                const success =
                    WebSimulationBridge
                        .toggleTorch(payload);

                if (success) {

                    jarvisMessage(
                        payload === "on"
                            ? "تم تفعيل الكشاف — محاكاة Web فقط."
                            : "تم إيقاف الكشاف — محاكاة Web فقط."
                    );

                    voiceOutput.speak(
                        payload === "on"
                            ? "تم تفعيل الكشاف."
                            : "تم إيقاف الكشاف."
                    );

                    return true;
                }

                break;
            }


            case "vibrate": {

                const success =
                    WebSimulationBridge
                        .vibrate(payload);

                if (success) {

                    jarvisMessage(
                        `تم تنفيذ الاهتزاز لمدة ${payload / 1000} ثانية.`
                    );

                    voiceOutput.speak(
                        "تم تنفيذ الاهتزاز."
                    );

                    return true;
                }

                break;
            }


            case "open_app": {

                const success =
                    WebSimulationBridge
                        .openApp(payload);

                if (success) {

                    const app =
                        Object
                            .values(APP_REGISTRY)
                            .find(
                                item =>
                                    item.id === payload
                            );

                    jarvisMessage(
                        `تم طلب فتح ${app?.displayName || payload} — محاكاة Web فقط.`
                    );

                    voiceOutput.speak(
                        `تم طلب فتح ${app?.displayName || payload}.`
                    );

                    return true;
                }

                break;
            }


            case "call": {

                const success =
                    WebSimulationBridge
                        .call(payload);

                if (success) {

                    jarvisMessage(
                        `تم اعتماد الاتصال بالرقم ${payload} — التنفيذ الحقيقي سيتم في طبقة Android.`
                    );

                    voiceOutput.speak(
                        "تم اعتماد أمر الاتصال."
                    );

                    return true;
                }

                break;
            }


            case "system_status": {

                jarvisMessage(
                    "جميع أنظمة الـWeb Prototype تعمل بشكل طبيعي. الـRouter والـSecurity والـConfirmation والـTTS جاهزون."
                );

                voiceOutput.speak(
                    "جميع الأنظمة تعمل بشكل طبيعي."
                );

                return true;
            }


            case "help": {

                const helpText =
                    "الأوامر الحالية: شغل الكشاف، اطفي الكشاف، اهتز، اهتز لمدة ثانيتين، افتح واتساب، افتح يوتيوب، حالة النظام، واتصل برقم مصري بعد التأكيد.";

                jarvisMessage(
                    helpText
                );

                voiceOutput.speak(
                    helpText
                );

                return true;
            }

        }


        return false;
    }
}


/* =========================================================
   COMMAND PROCESSOR
========================================================= */

function processCommand(rawText) {


    if (!rawText || !rawText.trim()) {
        return;
    }


    const text =
        rawText.trim();


    jarvisState.lastCommand =
        text;

    jarvisState.commandCount++;


    userMessage(text);


    /* =====================================================
       CONFIRMATION MODE
    ===================================================== */

    if (
        jarvisState.mode ===
        "WAITING_FOR_CONFIRMATION"
    ) {


        if (
            ConfirmationManager
                .isYes(text)
        ) {

            const pending =
                jarvisState.pendingAction;


            ConfirmationManager.clear();


            const success =
                ActionExecutor.execute(
                    pending.action,
                    pending.payload
                );


            if (!success) {

                errorMessage(
                    "تعذر تنفيذ الأمر."
                );

                voiceOutput.speak(
                    "تعذر تنفيذ الأمر."
                );
            }


            return;
        }


        if (
            ConfirmationManager
                .isNo(text)
        ) {

            ConfirmationManager.clear();


            jarvisMessage(
                "تم إلغاء العملية بأمان."
            );

            voiceOutput.speak(
                "تم إلغاء العملية."
            );

            return;
        }


        securityMessage(
            "لم أفهم التأكيد. يجب أن يكون الرد نعم أو لا."
        );

        voiceOutput.speak(
            "يرجى الرد بنعم أو لا."
        );

        return;
    }


    /* =====================================================
       ROUTING
    ===================================================== */

    const route =
        IntentRouter.route(text);


    if (!route.matched) {

        jarvisMessage(
            "لم أتعرف على هذا الأمر. اكتب «مساعدة» لمعرفة الأوامر المتاحة."
        );

        voiceOutput.speak(
            "لم أتعرف على هذا الأمر."
        );

        return;
    }


    jarvisState.lastIntent =
        route.action;


    /* =====================================================
       VALIDATION
    ===================================================== */

    const validation =
        ActionValidator.validate(
            route.action,
            route.payload
        );


    if (!validation.isValid) {

        securityMessage(
            `تم رفض الأمر أمنيًا: ${validation.error}`
        );

        voiceOutput.speak(
            "تم رفض الأمر أمنيًا."
        );

        return;
    }


    /* =====================================================
       CONFIRMATION
    ===================================================== */

    if (
        validation.requiresConfirmation
    ) {


        ConfirmationManager.request(
            {
                action: route.action,
                payload: route.payload
            }
        );


        securityMessage(
            `تنبيه أمني: طلب اتصال بالرقم ${route.payload}. هل أنت متأكد؟`
        );

        voiceOutput.speak(
            "هناك طلب اتصال. هل أنت متأكد؟ قل نعم أو لا."
        );

        return;
    }


    /* =====================================================
       EXECUTION
    ===================================================== */

    const success =
        ActionExecutor.execute(
            route.action,
            route.payload
        );


    if (!success) {

        errorMessage(
            "تعذر تنفيذ الأمر حاليًا."
        );

        voiceOutput.speak(
            "تعذر تنفيذ الأمر."
        );
    }
}


/* =========================================================
   UNIT TESTS
========================================================= */

function runJarvisUnitTests() {


    const tests = [

        {
            input: "شغل الكشاف",
            matched: true,
            action: "torch"
        },

        {
            input: "اطفي الكشاف",
            matched: true,
            action: "torch"
        },

        {
            input: "اهتز",
            matched: true,
            action: "vibrate"
        },

        {
            input: "اهتز لمدة 2 ثانية",
            matched: true,
            action: "vibrate"
        },

        {
            input: "افتح واتساب",
            matched: true,
            action: "open_app"
        },

        {
            input: "افتح يوتيوب",
            matched: true,
            action: "open_app"
        },

        {
            input: "اتصل على 01012345678",
            matched: true,
            action: "call"
        },

        {
            input: "اتصل بـ 010-1234-5678",
            matched: true,
            action: "call"
        },

        {
            input: "اتصل بـ ٠١٠ ١٢٣٤ ٥٦٧٨",
            matched: true,
            action: "call"
        },

        {
            input: "اتصل بـ 01012345678 كلام",
            matched: false,
            action: null
        },

        {
            input: "أمر وهمي",
            matched: false,
            action: null
        },

        {
            input: "افتح تطبيق ضار",
            matched: false,
            action: null
        },

        {
            input: "اتصل بـ 123",
            matched: false,
            action: null
        },

        {
            input: "حالة النظام",
            matched: true,
            action: "system_status"
        },

        {
            input: "مساعدة",
            matched: true,
            action: "help"
        }

    ];


    let passed = 0;


    for (const test of tests) {

        const result =
            IntentRouter.route(
                test.input
            );


        const success =
            result.matched ===
                test.matched &&

            result.action ===
                test.action;


        if (success) {
            passed++;
        }


        console.log(
            success ? "PASS" : "FAIL",
            "|",
            test.input
        );
    }


    console.log(
        `[JARVIS TESTS] ${passed}/${tests.length} passed.`
    );


    return passed === tests.length;
}


/* =========================================================
   INITIALIZATION
========================================================= */

function initializeJarvis() {


    console.log(
        "===================================="
    );

    console.log(
        "J.A.R.V.I.S V3.1"
    );

    console.log(
        "Web Prototype Initializing..."
    );


    const testsPassed =
        runJarvisUnitTests();


    if (testsPassed) {

        console.log(
            "[CORE] All unit tests passed."
        );

    } else {

        console.error(
            "[CORE] Some unit tests failed."
        );
    }


    /* ================================
       FORM
    ================================= */

    ui.form.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const text =
                ui.input.value.trim();


            if (!text) {
                return;
            }


            ui.input.value = "";


            processCommand(text);


            ui.input.focus();
        }
    );


    /* ================================
       VOICE STATUS
    ================================= */

    if (
        voiceOutput.enabled
    ) {

        ui.voiceStatus.textContent =
            "TTS READY";

    } else {

        ui.voiceStatus.textContent =
            "TTS UNAVAILABLE";
    }


    /* ================================
       STARTUP MESSAGE
    ================================= */

    setStatus(
        "SYSTEM STANDBY"
    );


    jarvisMessage(
        "مرحبًا. J.A.R.V.I.S V3.1 جاهز. اكتب «مساعدة» لرؤية الأوامر المتاحة."
    );


    console.log(
        "[JARVIS] System ready."
    );
}


/* =========================================================
   START
========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeJarvis
    );

} else {

    initializeJarvis();
}
