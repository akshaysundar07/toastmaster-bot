const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeStructure(transcript) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an experienced Toastmasters speech structure evaluator. Your job is to:
- Extract the speech topic and objective from the transcript
- Evaluate if the speech has a clear introduction, body and conclusion
- Check if the speaker used transitions between sections
- Give a structure score out of 10
- Give constructive positive feedback
Always respond ONLY with valid JSON, no extra text.`
        },
        {
          role: 'user',
          content: `Analyze the structure of this Prepared Speech transcript:

"${transcript}"

Extract the topic from the speech itself and evaluate its structure.

Respond ONLY with this JSON:
{
  "speechTopic": "extracted topic from the speech",
  "speechObjective": "what the speaker was trying to achieve",
  "introduction": {
    "present": true,
    "effective": true,
    "feedback": "feedback about introduction"
  },
  "body": {
    "present": true,
    "mainPoints": ["point 1", "point 2", "point 3"],
    "hasTransitions": true,
    "feedback": "feedback about body"
  },
  "conclusion": {
    "present": true,
    "effective": true,
    "callToAction": true,
    "feedback": "feedback about conclusion"
  },
  "overallStructureScore": 8,
  "feedback": "2-3 sentences of overall constructive feedback about speech structure"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const text = completion.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {
      speechTopic: 'Unknown',
      speechObjective: 'Unknown',
      introduction: { present: false, effective: false, feedback: 'Could not analyze' },
      body: { present: false, mainPoints: [], hasTransitions: false, feedback: 'Could not analyze' },
      conclusion: { present: false, effective: false, callToAction: false, feedback: 'Could not analyze' },
      overallStructureScore: 'N/A',
      feedback: 'Analysis unavailable'
    };

    let jsonStr = jsonMatch[0];
    const open = (jsonStr.match(/\{/g) || []).length;
    const close = (jsonStr.match(/\}/g) || []).length;
    for (let i = 0; i < open - close; i++) jsonStr += '}';
    return JSON.parse(jsonStr);

  } catch (e) {
    return {
      speechTopic: 'Unknown',
      speechObjective: 'Unknown',
      introduction: { present: false, effective: false, feedback: 'Error: ' + e.message },
      body: { present: false, mainPoints: [], hasTransitions: false, feedback: 'Error: ' + e.message },
      conclusion: { present: false, effective: false, callToAction: false, feedback: 'Error: ' + e.message },
      overallStructureScore: 'N/A',
      feedback: 'Analysis unavailable: ' + e.message
    };
  }
}

module.exports = { analyzeStructure };