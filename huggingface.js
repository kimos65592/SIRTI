(function () {
  const ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
  const TOKEN_KEY = "study_jarvis_hf_token_v1";
  const MODEL_KEY = "study_jarvis_model_v1";

  const DEFAULT_MODEL = "Qwen/Qwen3-4B-Thinking-2507:fastest";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getModel() {
    return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
  }

  function setModel(model) {
    localStorage.setItem(MODEL_KEY, (model || DEFAULT_MODEL).trim());
  }

  function cleanAnswer(text) {
    if (!text) return "لم يصل رد من النموذج.";
    let output = String(text);
    output = output.replace(/<think>[\s\S]*?<\/think>/gi, "");
    output = output.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "");
    output = output.replace(/<\/?(?:tool|function)[^>]*>/gi, "");
    output = output.replace(/\n{3,}/g, "\n\n").trim();
    return output;
  }

  function buildSystem({ mode, subject, topic }) {
    return [
      "أنت Study JARVIS، مدرس تعليمي باللغة العربية لطالب ثانوي في مصر.",
      "التزم بالشرح الواضح والدقيق، ولا تخترع قانونًا أو معلومة.",
      "إذا كانت المسألة حسابية، اكتب المعطيات ثم القانون ثم التعويض ثم النتيجة، وراجع الحساب قبل إعطاء الناتج.",
      "إذا لم تكن متأكدًا، قل إن هناك عدم يقين بدل اختلاق إجابة.",
      "لا تعرض التفكير الداخلي الخفي أو سلاسل الاستدلال الخاصة بالنموذج؛ اعرض تفسيرًا تعليميًا موجزًا ومفيدًا فقط.",
      mode === "practice" ? "في وضع التدريب: ابدأ بتلميح مناسب، ولا تعطِ الحل النهائي إلا إذا طلب الطالب ذلك." : "",
      mode === "solve" ? "في وضع حل السؤال: أعطِ الحل خطوة بخطوة مع سبب كل خطوة." : "",
      mode === "explain" ? "في وضع الشرح: ابدأ من الأساس وباستخدام مثال بسيط ثم مثال دراسي." : "",
      subject ? `المادة الحالية: ${subject}.` : "",
      topic ? `الموضوع المحتمل: ${topic}.` : ""
    ].filter(Boolean).join("\n");
  }

  async function chat({ messages, mode = "explain", subject = "", topic = "" }) {
    const token = getToken();
    if (!token) {
      throw new Error("أدخل HF Token من الإعدادات أولًا.");
    }

    const payload = {
      model: getModel(),
      messages: [
        { role: "system", content: buildSystem({ mode, subject, topic }) },
        ...messages
      ],
      temperature: 0.2,
      max_tokens: 900,
      stream: false
    };

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let data = null;
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
      const detail = data?.error || data?.message || `HTTP ${response.status}`;
      throw new Error(String(detail));
    }

    const text = data?.choices?.[0]?.message?.content;
    return cleanAnswer(text);
  }

  window.HuggingFaceAI = {
    ENDPOINT,
    DEFAULT_MODEL,
    getToken,
    setToken,
    getModel,
    setModel,
    chat,
    cleanAnswer
  };
})();
