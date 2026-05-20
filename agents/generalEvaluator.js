const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateGeneralEvaluation(grammarResult, ahCountResult, timerResult, wordOfDayResult, speakerName, speechType, structureResult) {
  try {
    const isPrepared = speechType === 'prepared_speech';

    const structureSection = isPrepared && structureResult ? `
Structure Report:
- Speech Topic: ${structureResult.speechTopic}
- Speech Objective: ${structureResult.speechObjective}
- Introduction: ${structureResult.introduction?.present ? 'Present' : 'Missing'} — ${structureResult.introduction?.feedback}
- Body: ${structureResult.body?.present ? 'Present' : 'Missing'} — Main points: ${(structureResult.body?.mainPoints || []).join(', ')}
- Conclusion: ${structureResult.conclusion?.present ? 'Present' : 'Missing'} — ${structureResult.conclusion?.feedback}
- Structure Score: ${structureResult.overallStructureScore}/10
- Feedback: ${structureResult.feedback}` : '';

    const prompt = `You are the General Evaluator in a Toastmasters meeting.
Your job is to give a warm, encouraging and constructive combined evaluation of the speaker.

Speaker Name: ${speakerName}
Speech Type: ${isPrepared ? 'Prepared Speech (5-7 minutes)' : 'Table Topics (1-2 minutes)'}

Grammarian Report:
- Grammar Score: ${grammarResult.overallGrammarScore}/10
- Grammar Mistakes: ${grammarResult.grammarMistakes?.length || 0}
- Feedback: ${grammarResult.feedback}

Ah-Counter Report:
- Total Filler Words: ${ahCountResult.totalFillerCount}
- Top Offenders: ${(ahCountResult.topOffenders || []).join(', ')}
- Feedback: ${ahCountResult.feedback}

Timer Report:
- Signal: ${timerResult.signal}
- Time Taken: ${timerResult.timeFormatted}
- Speaking Pace: ${timerResult.wordsPerMinute} words per minute
- Feedback: ${timerResult.feedback}

Word of the Day Report:
- Word: ${wordOfDayResult.wordOfDay}
- Used: ${wordOfDayResult.used ? 'Yes' : 'No'}
- Feedback: ${wordOfDayResult.feedback}
${structureSection}

Now write a General Evaluation speech that:
1. Starts by warmly addressing the speaker by name
2. Mentions something genuinely positive first
3. Naturally covers grammar, filler words, timing, word of day${isPrepared ? ', and speech structure' : ''} WITHOUT mentioning agent names or role names like "Grammarian", "Ah Counter", "Timer" or "Word of Day"
4. Speaks as ONE unified evaluator giving a holistic evaluation
5. Mentions specific mistakes and observations constructively and positively
6. Ends with strong genuine encouragement
7. Is maximum 250 words (fits within 2 minutes when spoken)
8. Sounds like a real experienced Toastmasters General Evaluator speaking naturally
9. Written as flowing paragraphs — NO bullet points — NO role mentions

Respond with ONLY the evaluation speech text, no JSON, no extra text.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
            role: 'system',
            content: 'You are an experienced Toastmasters General Evaluator. You give warm, constructive, encouraging evaluations in flowing paragraphs. You speak as one unified voice — never mention specific role names like Grammarian, Ah Counter, Timer or Word of Day. Just give natural holistic feedback as if you observed everything yourself.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 400
    });

    const evaluationText = completion.choices[0].message.content.trim();
    const wordCount = evaluationText.split(' ').length;
    const estimatedDuration = Math.round((wordCount / 130) * 60);

    return {
      evaluationText,
      wordCount,
      estimatedDurationSeconds: estimatedDuration,
      estimatedDurationFormatted: `${Math.floor(estimatedDuration / 60)}m ${estimatedDuration % 60}s`
    };

  } catch (e) {
    return {
      evaluationText: 'General evaluation unavailable: ' + e.message,
      wordCount: 0,
      estimatedDurationSeconds: 0,
      estimatedDurationFormatted: '0m 0s'
    };
  }
}

module.exports = { generateGeneralEvaluation };