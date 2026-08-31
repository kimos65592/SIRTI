// ==========================================
// 1. Arabic Normalization
// ==========================================

function normalizeArabic(text) {

    if (!text) return "";

    return text
        .toLowerCase()

        // Remove Arabic diacritics
        .replace(/[\u0617-\u061A\u064B-\u0652]/g, "")

        // Normalize Alef
        .replace(/[إأآا]/g, "ا")

        // Normalize Ta Marbuta
        .replace(/ة/g, "ه")

        .trim();
}



// ==========================================
// 2. Android Bridge
// MVP = Simulation
// ==========================================

class AndroidBridge {


    static vibrate(ms = 1000) {

        if (navigator.vibrate) {

            navigator.vibrate(ms);

            console.log(
                `[محاكاة البيئة] تم تشغيل الاهتزاز لمدة ${ms}ms`
            );

            return true;
        }

        console.log(
            "[محاكاة البيئة] Vibration API غير متاح"
        );

        return false;
    }


    static call(phoneNumber) {

        console.log(
            `[محاكاة البيئة] فتح شاشة الاتصال بالرقم: ${phoneNumber}`
        );

        window.location.href = `tel:${phoneNumber}`;

        return true;
    }


    static openApp(appName) {

        console.log(
            `[محاكاة البيئة] فتح التطبيق المسموح: ${appName}`
        );

        return true;
    }


    static toggleTorch(state) {

        console.log(
            `[محاكاة البيئة] الكشاف أصبح: ${state}`
        );

        return true;
    }

}



// ==========================================
// 3. Voice Layer
// STT + TTS
// ==========================================

class VoiceLayer {

    constructor() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        this.stt =
            SpeechRecognition
                ? new SpeechRecognition()
                : null;


        if (this.stt) {

            this.stt.lang = "ar-EG";

            this.stt.interimResults = false;

            this.stt.continuous = false;
        }


        this.tts = window.speechSynthesis;

        this.isListening = false;
    }


    speak(text) {

        if (!this.tts || !text) return;

        this.tts.cancel();

        const utterance =
            new SpeechSynthesisUtterance(text);

        utterance.lang = "ar-EG";

        utterance.rate = 1.0;

        this.tts.speak(utterance);
    }

}



// ==========================================
// 4. SAFE APPLICATIONS
// ==========================================

const SAFE_APPS = {

    "واتساب": "whatsapp",

    "واتس": "whatsapp",

    "يوتيوب": "youtube",

    "كروم": "chrome",

    "الكاميرا": "camera",

    "الاعدادات": "settings"

};



// ==========================================
// 5. Deterministic Intent Router
// ==========================================

class IntentRouter {


    static route(rawText) {

        const text =
            normalizeArabic(rawText);


        // ------------------------------
        // Torch ON
        // ------------------------------

        if (
            /^(شغل الكشاف|تفعيل الكشاف)$/.test(text)
        ) {

            return {
                matched: true,
                action: "torch",
                payload: "on"
            };

        }


        // ------------------------------
        // Torch OFF
        // ------------------------------

        if (
            /^(اطفي الكشاف|ايقاف الكشاف|طفي الكشاف|اغلق الكشاف)$/.test(text)
        ) {

            return {
                matched: true,
                action: "torch",
                payload: "off"
            };

        }


        // ------------------------------
        // Vibrate Default
        // ------------------------------

        if (
            /^(اهتز|اهتزاز)$/.test(text)
        ) {

            return {
                matched: true,
                action: "vibrate",
                payload: 1000
            };

        }


        // ------------------------------
        // Vibrate Duration
        // ------------------------------

        const vibMatch =
            text.match(
                /^اهتز لمدة (\d+) (ثانيه|ثواني|ثان)$/
            );


        if (vibMatch) {

            const seconds =
                parseInt(vibMatch[1], 10);


            return {
                matched: true,
                action: "vibrate",
                payload: seconds * 1000
            };

        }


        // ------------------------------
        // Open Application
        // ------------------------------

        const appMatch =
            text.match(/^افتح (.+)$/);


        if (appMatch) {

            const requestedApp =
                appMatch[1].trim();


            if (SAFE_APPS[requestedApp]) {

                return {
                    matched: true,
                    action: "open_app",
                    payload: SAFE_APPS[requestedApp]
                };

            }


            return {
                matched: false,
                action: null,
                payload: null
            };
        }



        // ------------------------------
        // Phone Call
        // ------------------------------

        const callMatch =
            text.match(
                /^اتصل بـ? (01[0125]\d{8})$/
            );


        if (callMatch) {

            return {
                matched: true,
                action: "call",
                payload: callMatch[1]
            };

        }


        // ------------------------------
        // Unknown
        // ------------------------------

        return {
            matched: false,
            action: null,
            payload: null
        };

    }

}



// ==========================================
// 6. Action Validator
// ==========================================

class ActionValidator {


    static validate(action, payload) {


        switch (action) {


            case "torch":

                return {

                    isValid:
                        ["on", "off"].includes(payload),

                    requiresConfirmation: false,

                    error: "حالة الكشاف غير صالحة"
                };


            case "vibrate":

                return {

                    isValid:
                        typeof payload === "number" &&
                        payload > 0 &&
                        payload <= 10000,

                    requiresConfirmation: false,

                    error: "مدة الاهتزاز غير صالحة"
                };


            case "open_app":

                return {

                    isValid:
                        typeof payload === "string" &&
                        Object.values(SAFE_APPS)
                            .includes(payload),

                    requiresConfirmation: false,

                    error: "التطبيق غير مسموح به"
                };


            case "call":

                return {

                    isValid:
                        /^01[0125]\d{8}$/.test(payload),

                    requiresConfirmation: true,

                    error:
                        "رقم الهاتف غير مطابق للصيغة المصرية"
                };


            default:

                return {

                    isValid: false,

                    requiresConfirmation: false,

                    error: "أمر غير معروف"
                };

        }

    }

}



// ==========================================
// 7. JARVIS State Machine
// ==========================================

const jarvisState = {

    mode: "IDLE",

    pendingAction: null

};



// ==========================================
// 8. UI
// ==========================================

const ui = {

    btnMic:
        document.getElementById("btn-mic"),

    status:
        document.getElementById("status-text"),

    log:
        document.getElementById("chat-log")

};


const voice =
    new VoiceLayer();



// ==========================================
// 9. Secure Log
// ==========================================

function appendLog(sender, text) {

    const container =
        document.createElement("div");


    container.className =
        `mb-3 p-3 rounded-lg ${
            sender === "User"

            ? "bg-[#00ffcc]/10 text-right ml-8"

            : "bg-gray-900/80 text-left mr-8 border-l-2 border-[#00ffcc]"
        }`;


    const senderSpan =
        document.createElement("span");


    senderSpan.className =
        "text-xs opacity-50 block mb-1 font-bold";


    senderSpan.textContent =
        sender;


    const textP =
        document.createElement("p");


    textP.className =
        "text-sm text-gray-200";


    textP.textContent =
        text;


    container.appendChild(senderSpan);

    container.appendChild(textP);

    ui.log.prepend(container);
}



// ==========================================
// 10. Execute Action
// ==========================================

function executeAction(action, payload) {


    let success = false;


    switch (action) {


        case "vibrate":

            success =
                AndroidBridge.vibrate(payload);

            break;


        case "torch":

            success =
                AndroidBridge.toggleTorch(payload);

            break;


        case "open_app":

            success =
                AndroidBridge.openApp(payload);

            break;


        case "call":

            success =
                AndroidBridge.call(payload);

            break;

    }


    const msg =
        success

        ? `[محاكاة] تم تنفيذ الأمر: ${action}`

        : `[محاكاة] تعذر تنفيذ الأمر: ${action}`;


    appendLog(
        "J.A.R.V.I.S",
        msg
    );


    voice.speak(
        success
            ? "تم التنفيذ"
            : "تعذر تنفيذ الأمر"
    );

}



// ==========================================
// 11. Process Command
// ==========================================

function processCommand(rawText) {


    appendLog(
        "User",
        rawText
    );


    const normalizedText =
        normalizeArabic(rawText);



    // ======================================
    // Confirmation State
    // ======================================

    if (
        jarvisState.mode ===
        "WAITING_FOR_CONFIRMATION"
    ) {


        // YES

        if (
            /^(نعم|اوافق|تاكيد|ايوه|اكد)$/.test(
                normalizedText
            )
        ) {


            const {
                action,
                payload
            } =
                jarvisState.pendingAction;


            jarvisState.mode =
                "IDLE";


            jarvisState.pendingAction =
                null;


            executeAction(
                action,
                payload
            );


            return;
        }



        // NO

        if (
            /^(لا|الغاء|رفض|الغى)$/.test(
                normalizedText
            )
        ) {


            jarvisState.mode =
                "IDLE";


            jarvisState.pendingAction =
                null;


            appendLog(
                "J.A.R.V.I.S",
                "تم إلغاء الأمر."
            );


            voice.speak(
                "تم الإلغاء"
            );


            return;
        }



        // Unknown confirmation

        appendLog(
            "J.A.R.V.I.S",
            "يرجى الرد بنعم أو لا."
        );


        voice.speak(
            "يرجى التأكيد بنعم أو لا"
        );


        return;
    }



    // ======================================
    // Router
    // ======================================

    const route =
        IntentRouter.route(
            rawText
        );


    if (!route.matched) {

        const msg =
            "لم أتعرف على الأمر أو أنه غير مصرح به.";


        appendLog(
            "J.A.R.V.I.S",
            msg
        );


        voice.speak(
            "أمر غير معروف"
        );


        return;
    }



    // ======================================
    // Validator
    // ======================================

    const validation =
        ActionValidator.validate(
            route.action,
            route.payload
        );


    if (!validation.isValid) {

        const err =
            `رفض الأمان: ${validation.error}`;


        appendLog(
            "J.A.R.V.I.S (Security)",
            err
        );


        voice.speak(
            "خطأ أمني"
        );


        return;
    }



    // ======================================
    // Confirmation Required
    // ======================================

    if (
        validation.requiresConfirmation
    ) {


        jarvisState.mode =
            "WAITING_FOR_CONFIRMATION";


        jarvisState.pendingAction = {

            action:
                route.action,

            payload:
                route.payload

        };


        const msg =
            `تنبيه أمني: مطلوب تأكيد للاتصال بالرقم ${route.payload}. هل أنت متأكد؟`;


        appendLog(
            "J.A.R.V.I.S (Security)",
            msg
        );


        voice.speak(
            "هل أنت متأكد من إجراء المكالمة؟ قل نعم أو لا"
        );


        return;
    }



    // ======================================
    // Direct Execution
    // ======================================

    executeAction(
        route.action,
        route.payload
    );

}



// ==========================================
// 12. Unit Tests
// ==========================================

function runJarvisUnitTests() {


    console.log(
        "=== J.A.R.V.I.S Unit Tests ==="
    );


    const testCases = [


        {
            input: "شغل الكشاف",
            expectedMatched: true,
            action: "torch"
        },


        {
            input: "إطفاء الكشاف",
            expectedMatched: true,
            action: "torch"
        },


        {
            input: "اهتز",
            expectedMatched: true,
            action: "vibrate"
        },


        {
            input: "اهتز لمدة 3 ثواني",
            expectedMatched: true,
            action: "vibrate"
        },


        {
            input: "اهتز لمدة 2 ثانية",
            expectedMatched: true,
            action: "vibrate"
        },


        {
            input: "افتح واتساب",
            expectedMatched: true,
            action: "open_app"
        },


        {
            input: "افتح يوتيوب",
            expectedMatched: true,
            action: "open_app"
        },


        {
            input: "افتح تطبيق ضار مجهول",
            expectedMatched: false,
            action: null
        },


        {
            input: "اتصل بـ 01012345678",
            expectedMatched: true,
            action: "call"
        },


        {
            input: "اتصل بـ 123",
            expectedMatched: false,
            action: null
        },


        {
            input: "مش هز الهاتف",
            expectedMatched: false,
            action: null
        }

    ];


    let passed = 0;


    testCases.forEach(
        (test, index) => {


            const route =
                IntentRouter.route(
                    test.input
                );


            const matchOK =
                route.matched ===
                test.expectedMatched;


            const actionOK =
                route.action ===
                test.action;


            if (
                matchOK &&
                actionOK
            ) {

                console.log(
                    `✅ Test ${index + 1} Passed`
                );

                passed++;

            } else {

                console.error(
                    `❌ Test ${index + 1} Failed`,
                    test.input
                );

            }

        }
    );


    console.log(
        `=== ${passed}/${testCases.length} Tests Passed ===`
    );

}



// Run tests

runJarvisUnitTests();



// ==========================================
// 13. Microphone Events
// ==========================================

if (voice.stt) {


    ui.btnMic.addEventListener(
        "click",
        () => {


            if (voice.isListening) {
                return;
            }


            try {

                voice.stt.start();

                voice.isListening =
                    true;


                ui.btnMic.classList.add(
                    "mic-active",
                    "bg-[#00ffcc]/20"
                );


                ui.status.innerText =
                    "LISTENING...";


                ui.status.classList.add(
                    "text-[#00ffcc]"
                );


            } catch (error) {

                console.log(
                    "Mic error:",
                    error
                );

            }

        }
    );



    voice.stt.onresult =
        event => {


            const text =
                event.results[0][0]
                    .transcript;


            processCommand(
                text
            );

        };



    voice.stt.onend =
        () => {


            voice.isListening =
                false;


            ui.btnMic.classList.remove(
                "mic-active",
                "bg-[#00ffcc]/20"
            );


            ui.status.innerText =
                "SYSTEM STANDBY";


            ui.status.classList.remove(
                "text-[#00ffcc]"
            );

        };



    voice.stt.onerror =
        event => {


            voice.isListening =
                false;


            appendLog(
                "System Error",
                event.error
            );


            ui.btnMic.classList.remove(
                "mic-active"
            );

        };



} else {


    appendLog(
        "System Alert",
        "Speech Recognition غير مدعوم في هذا المتصفح."
    );

}
