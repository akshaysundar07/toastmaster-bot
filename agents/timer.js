function analyzeTimer(transcript, durationSeconds, speechType = 'table_topics') {
  let signal, signalEmoji, timeStatus, feedback;
  let minTime, maxTime, greenMax, yellowMax;

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const timeFormatted = `${minutes}m ${seconds}s`;

  if (speechType === 'prepared_speech') {
    // Prepared Speech: 5-7 minutes
    minTime = 300; // 5 mins
    greenMax = 360; // 6 mins
    yellowMax = 420; // 7 mins

    if (durationSeconds < minTime) {
      signal = 'RED';
      signalEmoji = '🔴';
      timeStatus = 'Under time';
      feedback = `You finished in ${timeFormatted}, which is under the 5-minute minimum for a Prepared Speech. Try to elaborate more on your points and add more details to fill the time effectively.`;
    } else if (durationSeconds <= greenMax) {
      signal = 'GREEN';
      signalEmoji = '🟢';
      timeStatus = 'On track';
      feedback = 'Great pacing! You are within the ideal time range for a Prepared Speech. Well done!';
    } else if (durationSeconds <= yellowMax) {
      signal = 'YELLOW';
      signalEmoji = '🟡';
      timeStatus = 'Approaching limit';
      feedback = 'You are approaching the 7-minute limit. Start wrapping up your conclusion soon.';
    } else {
      signal = 'RED';
      signalEmoji = '🔴';
      timeStatus = 'Over time';
      feedback = `You exceeded the 7-minute limit by ${durationSeconds - 420} seconds. Practice wrapping up on time — try rehearsing with a timer at home!`;
    }
  } else {
    // Table Topics: 1-2 minutes
    if (durationSeconds <= 60) {
      signal = 'GREEN';
      signalEmoji = '🟢';
      timeStatus = 'Under time';
      feedback = 'You finished under 1 minute. While concise, try to elaborate more on your points to fill the time effectively.';
    } else if (durationSeconds <= 90) {
      signal = 'YELLOW';
      signalEmoji = '🟡';
      timeStatus = 'On track';
      feedback = 'Great pacing! You are within the ideal time range for a Table Topics speech. Well done!';
    } else if (durationSeconds <= 120) {
      signal = 'YELLOW';
      signalEmoji = '🟡';
      timeStatus = 'Approaching limit';
      feedback = 'You are approaching the 2-minute limit. Practice wrapping up your thoughts concisely.';
    } else {
      signal = 'RED';
      signalEmoji = '🔴';
      timeStatus = 'Over time';
      feedback = `You exceeded the 2-minute limit by ${durationSeconds - 120} seconds. Work on time management — try practicing with a timer at home!`;
    }
  }

  const wordCount = transcript.split(' ').filter(w => w.length > 0).length;
  const wordsPerMinute = Math.round((wordCount / durationSeconds) * 60);

  const timingRules = speechType === 'prepared_speech'
    ? {
        green: '5 - 6 minutes',
        yellow: '6 - 7 minutes',
        red: 'Under 5 mins or over 7 minutes'
      }
    : {
        green: '0 - 1 minute',
        yellow: '1 minute - 1 minute 30 seconds',
        red: 'More than 2 minutes'
      };

  return {
    durationSeconds,
    timeFormatted,
    signal,
    signalEmoji,
    timeStatus,
    wordCount,
    wordsPerMinute,
    speechType,
    paceAnalysis: wordsPerMinute < 100 ? 'Too slow' : wordsPerMinute > 160 ? 'Too fast' : 'Good pace',
    feedback,
    timingRules
  };
}

module.exports = { analyzeTimer };