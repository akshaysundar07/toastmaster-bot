const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function analyzeGrammar(
  transcript,
  speakerName,
  wordOfDay,
  speechType,
  durationSeconds,
) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",

      messages: [
        {
          role: "system",

          content: `
You are a COMPLETE Toastmasters Evaluation Panel.

You simultaneously perform ALL these roles:

1. GRAMMARIAN
- Identify grammar mistakes
- Identify incomplete sentences
- Identify awkward phrasing
- Identify malapropisms
- Highlight good vocabulary
- Give constructive grammar feedback

2. AH COUNTER
- Count filler sounds:
  ah, um, uh, er, 
- Count filler words:
  and, well, but, so, like,
  you know, actually, basically,
  literally, right, okay
- Detect overused words > 3 occurrences
- Give filler feedback

3. WORD OF DAY EVALUATOR
- Detect word of day usage
- Detect derivatives
- Check contextual correctness
- Count occurrences
- Give encouraging feedback

4. STRUCTURE EVALUATOR
- Identify speech topic
- Identify speech objective
- Evaluate introduction
- Evaluate body
- Evaluate conclusion
- Evaluate transitions
- Give structure feedback

5. GENERAL EVALUATOR
- Give holistic Toastmasters evaluation
- Mention strengths
- Mention improvements
- Encourage speaker positively
- Sound like experienced evaluator

IMPORTANT:
- Be accurate
- Be constructive
- Be encouraging
- Return ONLY valid JSON
- NO markdown
- NO explanations outside JSON
`,
        },

        {
          role: "user",

          content: `
SPEAKER:
${speakerName}

SPEECH TYPE:
${speechType}

WORD OF THE DAY:
${wordOfDay}

DURATION:
${durationSeconds} seconds

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY this JSON:

{
  "grammarian": {

    "grammarMistakes": [
      {
        "mistake": "",
        "correction": "",
        "explanation": ""
      }
    ],

    "incompleteSentences": [],

    "goodVocabulary": [],

    "overallGrammarScore": 0,

    "feedback": ""
  },

  "ahCounter": {

    "fillerSounds": {
      "ah": 0,
      "um": 0,
      "er": 0,
      "uh": 0
    },

    "fillerWords": {
      "and": 0,
      "well": 0,
      "but": 0,
      "so": 0,
      "you know": 0,
      "like": 0,
      "basically": 0,
      "literally": 0,
      "actually": 0,
      "right": 0,
      "okay": 0
    },

    "overusedWords": [
      {
        "word": "",
        "count": 0
      }
    ],

    "totalFillerCount": 0,

    "topOffenders": [],

    "feedback": ""
  },

  "wordOfDay": {

    "wordOfDay": "${wordOfDay}",

    "used": true,

    "usedCorrectly": true,

    "occurrences": 0,

    "quotedSentences": [],

    "derivatives": [],

    "feedback": ""
  },

  "structure": {

    "speechTopic": "",

    "speechObjective": "",

    "introduction": {
      "present": true,
      "effective": true,
      "feedback": ""
    },

    "body": {
      "present": true,
      "mainPoints": [],
      "hasTransitions": true,
      "feedback": ""
    },

    "conclusion": {
      "present": true,
      "effective": true,
      "callToAction": true,
      "feedback": ""
    },

    "overallStructureScore": 0,

    "feedback": ""
  },

  "generalEvaluation": {

    "strengths": [],

    "improvements": [],

    "overallScore": 0,

    "evaluationText": ""
  }
}
`,
        },
      ],

      temperature: 0.3,

      max_tokens: 1800,
    });

    const text = completion.choices[0].message.content;
    // CALCULATE WORD OF DAY OCCURRENCES SAFELY
    const occurrences = (
      transcript
        .toLowerCase()
        .match(new RegExp(`\\b${wordOfDay.toLowerCase()}\\b`, "g")) || []
    ).length;

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        error: "Could not parse evaluation",
      };
    }

    let jsonStr = jsonMatch[0];

    const open = (jsonStr.match(/\{/g) || []).length;

    const close = (jsonStr.match(/\}/g) || []).length;

    for (let i = 0; i < open - close; i++) {
      jsonStr += "}";
    }

    const parsed = JSON.parse(jsonStr);

    // OVERRIDE AI OCCURRENCE COUNT
    parsed.wordOfDay.occurrences = occurrences;

    return parsed;
  } catch (e) {
    console.log("Master evaluator error:", e.message);

    return {
      error: e.message,
    };
  }
}

module.exports = {
  analyzeGrammar,
};
