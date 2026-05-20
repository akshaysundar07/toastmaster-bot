const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeGrammar(transcript) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an experienced Toastmasters Grammarian. Your role is to:
- Identify grammatical mistakes, incomplete sentences, mispronunciations, non-sequiturs, and malapropisms
- Highlight good vocabulary used by the speaker
- Give a grammar score out of 10
- Provide constructive, positive feedback that encourages improvement
Always respond ONLY with valid JSON, no extra text.`
        },
        {
          role: 'user',
          content: `Analyze this speech transcript as a Toastmasters Grammarian:

"${transcript}"

Respond ONLY with this JSON:
{
  "grammarMistakes": [
    {
      "mistake": "exact wrong phrase from speech",
      "correction": "corrected version",
      "explanation": "why this is wrong"
    }
  ],
  "incompleteSentences": ["any incomplete sentence found"],
  "goodVocabulary": ["impressive words used correctly"],
  "overallGrammarScore": 8,
  "feedback": "2-3 sentences of positive but honest constructive feedback"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const text = completion.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { grammarMistakes: [], goodVocabulary: [], overallGrammarScore: 'N/A', feedback: text };

    let jsonStr = jsonMatch[0];
    const open = (jsonStr.match(/\{/g) || []).length;
    const close = (jsonStr.match(/\}/g) || []).length;
    for (let i = 0; i < open - close; i++) jsonStr += '}';
    return JSON.parse(jsonStr);
  } catch (e) {
    return { grammarMistakes: [], goodVocabulary: [], overallGrammarScore: 'N/A', feedback: 'Error: ' + e.message };
  }
}

module.exports = { analyzeGrammar };