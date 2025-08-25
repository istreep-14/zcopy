// Complete fixed inject.js - Smart Zetamac Coach extension
// NO FIREBASE CODE - Apps Script only with improved error handling

let currentProblem = null;
let problemStartTime = null;
let gameData = [];
let userAnswer = "";
let gameActive = false;
let sessionSaved = false;
let lastScore = 0;
let lastScoreCheck = 0;
let initialGameDuration = null;
let maxTimerSeen = 0;
let answerForCurrentProblem = "";

function getCurrentProblem() {
  const allElements = document.querySelectorAll('*');
  
  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (!text) continue;
    
    const mathMatch = text.match(/(\d+\s*[+\-×÷*\/]\s*\d+)\s*=/);
    if (mathMatch) {
      const problem = mathMatch[1].replace(/\s+/g, ' ').trim();
      if (problem.length < 20 && element.offsetHeight > 0) {
        return problem;
      }
    }
  }
  
  return null;
}

function getScoreValue() {
  const allElements = document.querySelectorAll('*');
  let foundScore = 0;
  
  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (text) {
      let scoreMatch = text.match(/Score:\s*(\d+)/);
      if (scoreMatch) {
        const score = parseInt(scoreMatch[1]);
        foundScore = Math.max(foundScore, score);
      }
    }
  }
  
  return foundScore;
}

function getGameScore() {
  const allElements = document.querySelectorAll('*');
  let foundScore = 0;
  
  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (text) {
      let scoreMatch = text.match(/Score:\s*(\d+)/);
      if (!scoreMatch) {
        scoreMatch = text.match(/Final score:\s*(\d+)/);
      }
      if (!scoreMatch) {
        scoreMatch = text.match(/Your final score:\s*(\d+)/);
      }
      
      if (scoreMatch) {
        const score = parseInt(scoreMatch[1]);
        foundScore = Math.max(foundScore, score);
      }
    }
  }
  
  return foundScore;
}

function getTimeRemaining() {
  const selectors = [
    '#game .left',
    'span.left', 
    '#game span:first-child',
    'body > div:nth-child(2) > span:first-child'
  ];
  
  for (let selector of selectors) {
    const timerElement = document.querySelector(selector);
    if (timerElement) {
      const text = timerElement.textContent?.trim();
      
      if (text) {
        let timeMatch = text.match(/Seconds left:\s*(\d+)/i);
        if (timeMatch) {
          const seconds = parseInt(timeMatch[1]);
          return seconds;
        }
      }
    }
  }
  
  const allElements = document.querySelectorAll('*');
  
  for (let element of allElements) {
    const text = element.textContent?.trim();
    if (text && text.length < 100) {
      let timeMatch = text.match(/Seconds left:\s*(\d+)/i);
      if (!timeMatch) {
        timeMatch = text.match(/Time:\s*(\d+)/i);
      }
      if (!timeMatch) {
        timeMatch = text.match(/(\d+)\s*seconds/i);
      }
      if (!timeMatch) {
        timeMatch = text.match(/(\d{1,2}):(\d{2})/);
      }
      
      if (timeMatch) {
        let seconds;
        if (timeMatch[2] !== undefined) {
          seconds = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
        } else {
          seconds = parseInt(timeMatch[1]);
        }
        
        if (seconds >= 0 && seconds <= 300) {
          return seconds;
        }
      }
    }
  }
  
  return null;
}

function detectGameDuration() {
  const timerValue = maxTimerSeen;
  
  if (timerValue === 0) {
    return null;
  }
  
  if (timerValue > 90) {
    return 120;
  } else if (timerValue > 60) {
    return 90;
  } else if (timerValue > 30) {
    return 60;
  } else if (timerValue > 0) {
    return 30;
  }
  
  return null;
}

function checkGameEnd() {
  const timeRemaining = getTimeRemaining();
  
  if (timeRemaining !== null && timeRemaining > maxTimerSeen) {
    maxTimerSeen = timeRemaining;
  }
  
  if (timeRemaining !== null && gameActive && initialGameDuration === null) {
    const detectedDuration = detectGameDuration();
    if (detectedDuration) {
      initialGameDuration = detectedDuration;
      console.log(`Game duration detected: ${initialGameDuration}s`);
    }
  }
  
  if (timeRemaining !== null) {
    if (timeRemaining === 0 && gameActive && !sessionSaved) {
      console.log("Game ended - timer reached 0");
      sessionSaved = true;
      
      setTimeout(() => {
        const score = getGameScore();
        
        if (currentProblem && problemStartTime) {
          const latency = Date.now() - problemStartTime;
          const finalAnswer = answerForCurrentProblem || userAnswer || "unknown";
          logProblemData(currentProblem, finalAnswer, latency);
        }
        
        const deficit = score - gameData.length;
        if (deficit > 0) {
          console.log(`Adding ${deficit} final placeholders to match score`);
          for (let i = 0; i < deficit; i++) {
            const placeholderProblem = {
              question: `final-missed-${gameData.length + 1}`,
              answer: "ultra-fast",
              latency: 0,
              operationType: "unknown"
            };
            gameData.push(placeholderProblem);
          }
        } else if (deficit < 0) {
          gameData = gameData.slice(0, score);
        }
        
        const pageUrl = window.location.href;
        const durationSeconds = initialGameDuration || null;
        console.log(`Saving game session with score: ${score}`);
        saveSessionToAppsScript(score, gameData, { pageUrl, durationSeconds });
        
        resetGame();
      }, 1000);
    } else if (timeRemaining > 0 && sessionSaved) {
      console.log("New game detected");
      sessionSaved = false;
      gameActive = true;
      gameData = [];
      lastScoreCheck = 0;
      answerForCurrentProblem = "";
      maxTimerSeen = timeRemaining;
      initialGameDuration = null;
    }
  }
}

function resetGame() {
  gameActive = false;
  gameData = [];
  lastScore = 0;
  lastScoreCheck = 0;
  currentProblem = null;
  problemStartTime = null;
  answerForCurrentProblem = "";
  initialGameDuration = null;
  maxTimerSeen = 0;
}

function getOperationType(problemText) {
  if (problemText.includes('+')) return 'addition';
  if (problemText.includes('-')) return 'subtraction';
  if (problemText.includes('×') || problemText.includes('*')) return 'multiplication';
  if (problemText.includes('÷') || problemText.includes('/')) return 'division';
  return 'unknown';
}

function logProblemData(question, answer, latency) {
  const operationType = getOperationType(question);
  const problemData = { question, answer, latency, operationType };
  gameData.push(problemData);
  console.log(`Problem #${gameData.length}: ${question} → ${answer} (${latency}ms)`);
}

function getUserAnswer() {
  let inputField = document.querySelector('input[type="text"]');
  if (!inputField) {
    inputField = document.querySelector('input[type="number"]');
  }
  if (!inputField) {
    inputField = document.querySelector('input');
  }
  if (!inputField) {
    inputField = document.querySelector('#answer');
  }
  
  return inputField ? inputField.value.trim() : "";
}

function extractGameKey(url) {
  try {
    const match = url.match(/[?&]key=([^&#]+)/);
    return match ? decodeURIComponent(match[1]) : 'zetamac-arithmetic';
  } catch (_) {
    return 'zetamac-arithmetic';
  }
}

// FIXED: Improved saveSessionToAppsScript with better error handling
async function saveSessionToAppsScript(score, problems, meta = {}) {
  try {
    // Get Apps Script URL from storage
    const result = await chrome.storage.local.get(['apps_script_url']);
    const url = result.apps_script_url;
    
    if (!url) {
      console.error('Apps Script URL not configured. Set it with: chrome.storage.local.set({apps_script_url: "YOUR_URL"})');
      return;
    }
    
    const payload = {
      userId: 'user-' + Date.now(), // Simple user ID
      score,
      timestamp: new Date().toISOString(),
      pageUrl: meta.pageUrl || window.location.href,
      gameKey: extractGameKey(meta.pageUrl || window.location.href),
      durationSeconds: meta.durationSeconds,
      problems
    };
    
    console.log('Sending to Apps Script:', { url, payload });
    
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'postToAppsScript', url, payload },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          if (!response) {
            reject(new Error('No response received from background script'));
            return;
          }
          if (response.ok !== true) {
            console.error('Apps Script response error:', response);
            reject(new Error(response.error || `HTTP ${response.status}: ${response.body}`));
          } else {
            resolve(response);
          }
        }
      );
    });
    
    console.log('Session saved to Apps Script successfully:', response);
    
  } catch (error) {
    console.error('Error saving session to Apps Script:', error);
    
    // Show user-friendly notification
    const errorMsg = `Failed to save game data: ${error.message}. Check console for details.`;
    
    // Try to show a non-blocking notification
    try {
      if (Notification.permission === 'granted') {
        new Notification('Zetamac Coach Error', { body: errorMsg });
      } else {
        console.warn('Save failed notification:', errorMsg);
      }
    } catch (notifError) {
      console.warn('Could not show notification:', notifError);
    }
    
    // Optional: Retry logic (uncomment if desired)
    // setTimeout(() => {
    //   console.log('Retrying save to Apps Script...');
    //   saveSessionToAppsScript(score, problems, meta);
    // }, 5000);
  }
}

function startProblemObserver() {
  console.log("Starting problem monitoring...");
  
  gameActive = true;
  lastScore = 0;
  lastScoreCheck = 0;
  gameData = [];
  
  const timeRemaining = getTimeRemaining();
  if (timeRemaining !== null) {
    maxTimerSeen = timeRemaining;
    const detectedDuration = detectGameDuration();
    if (detectedDuration) {
      initialGameDuration = detectedDuration;
      console.log(`Initial game duration: ${initialGameDuration}s`);
    }
  }

  let lastAnswer = "";

  const observer = new MutationObserver((mutations) => {
    // Check score changes
    const currentScore = getScoreValue();
    if (currentScore > lastScoreCheck && gameActive) {
      const scoreIncrease = currentScore - lastScoreCheck;
      console.log(`Score increased: ${lastScoreCheck} → ${currentScore}`);
      
      const missedProblems = scoreIncrease - 1;
      
      if (missedProblems > 0) {
        for (let i = 0; i < missedProblems; i++) {
          const placeholderProblem = {
            question: `missed-problem-${gameData.length + 1}`,
            answer: "ultra-fast",
            latency: 0,
            operationType: "unknown"
          };
          gameData.push(placeholderProblem);
        }
      }
      lastScoreCheck = currentScore;
    }
    
    // Check problem changes
    const newProblem = getCurrentProblem();
    
    if (newProblem && newProblem !== currentProblem && gameActive) {
      console.log(`Problem change: "${currentProblem}" → "${newProblem}"`);
      
      if (currentProblem && problemStartTime) {
        const latency = Date.now() - problemStartTime;
        const finalAnswer = answerForCurrentProblem || lastAnswer || "unknown";
        logProblemData(currentProblem, finalAnswer, latency);
      }
      
      currentProblem = newProblem;
      problemStartTime = Date.now();
      answerForCurrentProblem = "";
    } else if (!currentProblem && newProblem && gameActive) {
      console.log(`First problem detected: ${newProblem}`);
      currentProblem = newProblem;
      problemStartTime = Date.now();
      answerForCurrentProblem = "";
    }
    
    // Capture answers
    const currentAnswer = getUserAnswer();
    if (currentAnswer && currentAnswer !== lastAnswer) {
      lastAnswer = currentAnswer;
      answerForCurrentProblem = currentAnswer;
      console.log(`Answer captured: ${currentAnswer}`);
    }
    
    checkGameEnd();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
    characterDataOldValue: true
  });
  
  // Answer capture events
  document.addEventListener('input', (event) => {
    if (event.target.tagName === 'INPUT') {
      userAnswer = event.target.value;
      if (event.target.value !== lastAnswer && event.target.value.length > 0) {
        lastAnswer = event.target.value;
        answerForCurrentProblem = event.target.value;
        console.log(`Answer from input: ${event.target.value}`);
      }
    }
  });
  
  ['keydown', 'keyup', 'change', 'paste'].forEach(eventType => {
    document.addEventListener(eventType, (event) => {
      if (event.target.tagName === 'INPUT') {
        setTimeout(() => {
          const value = event.target.value;
          if (value && value !== lastAnswer) {
            lastAnswer = value;
            answerForCurrentProblem = value;
          }
        }, 1);
      }
    });
  });
  
  // Polling backup
  setInterval(() => {
    if (gameActive) {
      const currentAnswer = getUserAnswer();
      if (currentAnswer && currentAnswer !== lastAnswer) {
        lastAnswer = currentAnswer;
        answerForCurrentProblem = currentAnswer;
      }
    }
  }, 10);
}

// Start monitoring after page loads
setTimeout(() => {
  console.log("Starting Zetamac monitoring...");
  startProblemObserver();
}, 1000);
