const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeWordOfDay(transcript, wordOfDay) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a Toastmasters Word of the Day evaluator. Your role is to:
- Check if the speaker used the word of the day or any of its derivatives
- Check if it was used correctly in context
- Note how many times it was used
- Give encouraging feedback
Always respond ONLY with valid JSON, no extra text.`
        },
        {
          role: 'user',
          content: `The Word of the Day is: "${wordOfDay}"

Analyze this speech transcript:
"${transcript}"

Check if the speaker used "${wordOfDay}" or derivatives like ${wordOfDay}ly, ${wordOfDay}ed, ${wordOfDay}ing, ${wordOfDay}ness etc.

Respond ONLY with this JSON:
{
  "wordOfDay": "${wordOfDay}",
  "used": true,
  "usedCorrectly": true,
  "occurrences": 1,
  "quotedSentences": ["exact sentence where word was used"],
  "derivatives": ["any derivative used"],
  "feedback": "2-3 sentences of encouraging feedback about word usage"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const text = completion.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { wordOfDay, used: false, usedCorrectly: false, occurrences: 0, quotedSentences: [], derivatives: [], feedback: text };

    let jsonStr = jsonMatch[0];
    const open = (jsonStr.match(/\{/g) || []).length;
    const close = (jsonStr.match(/\}/g) || []).length;
    for (let i = 0; i < open - close; i++) jsonStr += '}';
    return JSON.parse(jsonStr);
  } catch (e) {
    return { wordOfDay, used: false, usedCorrectly: false, occurrences: 0, quotedSentences: [], derivatives: [], feedback: 'Error: ' + e.message };
  }
}

module.exports = { analyzeWordOfDay };