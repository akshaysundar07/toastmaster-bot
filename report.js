function generateReport(grammarResult, ahCountResult, timerResult, wordOfDayResult, speakerName, speechType, structureResult) {
  const report = {
    speakerName: speakerName || 'Speaker',
    speechType: speechType || 'table_topics',
    generatedAt: new Date().toLocaleString(),
    summary: {
      grammarScore: grammarResult.overallGrammarScore || 'N/A',
      totalFillers: ahCountResult.totalFillerCount || 0,
      timeSignal: timerResult.signalEmoji + ' ' + timerResult.signal,
      timeTaken: timerResult.timeFormatted,
      usedWordOfDay: wordOfDayResult.used ? '✅ Yes' : '❌ No',
      structureScore: structureResult ? (structureResult.overallStructureScore || 'N/A') : null,
      speechTopic: structureResult ? (structureResult.speechTopic || 'N/A') : null
    },
    details: {
      grammarian: grammarResult,
      ahCounter: ahCountResult,
      timer: timerResult,
      wordOfDay: wordOfDayResult,
      structure: structureResult
    }
  };

  return report;
}

function formatReportAsText(report) {
  let text = `
╔════════════════════════════════════════╗
║     TOASTMASTER EVALUATION REPORT     ║
╚════════════════════════════════════════╝

👤 Speaker: ${report.speakerName}
📋 Speech Type: ${report.speechType === 'prepared_speech' ? 'Prepared Speech' : 'Table Topics'}
🕐 Generated: ${report.generatedAt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Grammar Score     : ${report.summary.grammarScore}/10
🗣️  Total Fillers    : ${report.summary.totalFillers}
⏱️  Time Signal      : ${report.summary.timeSignal}
⌛ Time Taken        : ${report.summary.timeTaken}
💡 Word of Day Used  : ${report.summary.usedWordOfDay}`;

  if (report.speechType === 'prepared_speech' && report.summary.structureScore) {
    text += `
🏗️  Structure Score  : ${report.summary.structureScore}/10
🎯 Speech Topic      : ${report.summary.speechTopic}`;
  }

  text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              GRAMMARIAN REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatGrammarReport(report.details.grammarian)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              AH COUNTER REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatAhCountReport(report.details.ahCounter)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                TIMER REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatTimerReport(report.details.timer)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             WORD OF DAY REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatWordOfDayReport(report.details.wordOfDay)}`;

  if (report.speechType === 'prepared_speech' && report.details.structure) {
    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             STRUCTURE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatStructureReport(report.details.structure)}`;
  }

  return text;
}

function formatGrammarReport(data) {
  if (data.error) return `Error: ${data.error}`;
  let text = '';
  if (data.grammarMistakes && data.grammarMistakes.length > 0) {
    text += `Grammar Mistakes (${data.grammarMistakes.length}):\n`;
    data.grammarMistakes.forEach((m, i) => {
      text += `  ${i + 1}. ❌ "${m.mistake}"\n`;
      text += `     ✅ Should be: "${m.correction}"\n`;
      text += `     💡 ${m.explanation}\n`;
    });
  } else {
    text += '  ✅ No grammar mistakes found!\n';
  }
  if (data.goodVocabulary && data.goodVocabulary.length > 0) {
    text += `\nGood Vocabulary Used: ${data.goodVocabulary.join(', ')}\n`;
  }
  text += `\nFeedback: ${data.feedback}`;
  return text;
}

function formatAhCountReport(data) {
  if (data.error) return `Error: ${data.error}`;
  let text = '';
  text += 'Filler Sounds:\n';
  Object.entries(data.fillerSounds || {}).forEach(([word, count]) => {
    if (count > 0) text += `  "${word}": ${count} times\n`;
  });
  text += '\nFiller Words:\n';
  Object.entries(data.fillerWords || {}).forEach(([word, count]) => {
    if (count > 0) text += `  "${word}": ${count} times\n`;
  });
  if (data.overusedWords && data.overusedWords.length > 0) {
    text += '\nOverused Words (3+ times):\n';
    data.overusedWords.forEach(w => {
      text += `  "${w.word}": ${w.count} times\n`;
    });
  }
  text += `\nTop Offenders: ${(data.topOffenders || []).join(', ')}\n`;
  text += `\nFeedback: ${data.feedback}`;
  return text;
}

function formatTimerReport(data) {
  return `
  Signal       : ${data.signalEmoji} ${data.signal}
  Time Taken   : ${data.timeFormatted}
  Status       : ${data.timeStatus}
  Word Count   : ${data.wordCount}
  Speaking Pace: ${data.wordsPerMinute} words/min (${data.paceAnalysis})
  Speech Type  : ${data.speechType === 'prepared_speech' ? 'Prepared Speech (5-7 mins)' : 'Table Topics (1-2 mins)'}

  Timing Rules :
    🟢 Green  : ${data.timingRules.green}
    🟡 Yellow : ${data.timingRules.yellow}
    🔴 Red    : ${data.timingRules.red}

  Feedback: ${data.feedback}`;
}

function formatWordOfDayReport(data) {
  if (data.error) return `Error: ${data.error}`;
  let text = '';
  text += `  Word of Day  : "${data.wordOfDay}"\n`;
  text += `  Used         : ${data.used ? '✅ Yes' : '❌ No'}\n`;
  if (data.used) {
    text += `  Used Correctly: ${data.usedCorrectly ? '✅ Yes' : '❌ No'}\n`;
    text += `  Occurrences  : ${data.occurrences}\n`;
    if (data.quotedSentences && data.quotedSentences.length > 0) {
      text += `  Used in      : "${data.quotedSentences[0]}"\n`;
    }
  }
  text += `\n  Feedback: ${data.feedback}`;
  return text;
}

function formatStructureReport(data) {
  if (!data) return 'N/A';
  let text = '';
  text += `  Speech Topic    : ${data.speechTopic}\n`;
  text += `  Speech Objective: ${data.speechObjective}\n\n`;
  text += `  Introduction    : ${data.introduction?.present ? '✅ Present' : '❌ Missing'}\n`;
  text += `  Feedback        : ${data.introduction?.feedback}\n\n`;
  text += `  Body            : ${data.body?.present ? '✅ Present' : '❌ Missing'}\n`;
  if (data.body?.mainPoints && data.body.mainPoints.length > 0) {
    text += `  Main Points     :\n`;
    data.body.mainPoints.forEach((point, i) => {
      text += `    ${i + 1}. ${point}\n`;
    });
  }
  text += `  Transitions     : ${data.body?.hasTransitions ? '✅ Yes' : '❌ No'}\n`;
  text += `  Feedback        : ${data.body?.feedback}\n\n`;
  text += `  Conclusion      : ${data.conclusion?.present ? '✅ Present' : '❌ Missing'}\n`;
  text += `  Call to Action  : ${data.conclusion?.callToAction ? '✅ Yes' : '❌ No'}\n`;
  text += `  Feedback        : ${data.conclusion?.feedback}\n\n`;
  text += `  Structure Score : ${data.overallStructureScore}/10\n`;
  text += `  Feedback        : ${data.feedback}`;
  return text;
}

module.exports = { generateReport, formatReportAsText };