const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeAhCount(transcript) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an experienced Toastmasters Ah-Counter. Your role is to:
- Count all filler sounds: ah, um, er, uh
- Count all filler words: and, well, but, so, you know, like, basically, literally, actually, right, okay
- Identify words repeated more than 3 times
- Give constructive feedback to help the speaker improve
Always respond ONLY with valid JSON, no extra text.`
        },
        {
          role: 'user',
          content: `Analyze this speech transcript as a Toastmasters Ah-Counter:

"${transcript}"

Respond ONLY with this JSON:
{
  "fillerSounds": {
    "ah": 0, "um": 0, "er": 0, "uh": 0
  },
  "fillerWords": {
    "and": 0, "well": 0, "but": 0, "so": 0,
    "you know": 0, "like": 0, "basically": 0,
    "literally": 0, "actually": 0, "right": 0, "okay": 0
  },
  "overusedWords": [
    {"word": "word used 3+ times", "count": 4}
  ],
  "totalFillerCount": 0,
  "topOffenders": ["top filler 1", "top filler 2", "top filler 3"],
  "feedback": "2-3 sentences of positive but honest constructive feedback"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const text = completion.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { fillerSounds: {}, fillerWords: {}, overusedWords: [], totalFillerCount: 0, topOffenders: [], feedback: text };

    let jsonStr = jsonMatch[0];
    const open = (jsonStr.match(/\{/g) || []).length;
    const close = (jsonStr.match(/\}/g) || []).length;
    for (let i = 0; i < open - close; i++) jsonStr += '}';
    return JSON.parse(jsonStr);
  } catch (e) {
    return { fillerSounds: {}, fillerWords: {}, overusedWords: [], totalFillerCount: 0, topOffenders: [], feedback: 'Error: ' + e.message };
  }
}

module.exports = { analyzeAhCount };