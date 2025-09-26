let currentQuestionIndex = 0;
let questionsData = [];
let userAnswers = []; // to store user's answers

// Fetch the questions from JSON
fetch('questions.json')
  .then((response) => response.json())
  .then((data) => {
    questionsData = data;
    showQuestion();
  })
  .catch((error) => {
    console.log("ERROR:", error);
  });

function showQuestion() {
  const question = questionsData[currentQuestionIndex];
  document.getElementById('quiz').innerText = `Q${currentQuestionIndex + 1}: ${question.question}`;

  // Set options
  question.options.forEach((opt, i) => {
    const btn = document.getElementById(`opt${i + 1}`);
    btn.innerText = opt;
    btn.disabled = false;
    btn.style.backgroundColor = ''; // reset style
  });

  // Hide buttons
  document.getElementById('submit-btn').style.display = 'none';
}

// Handle option button clicks
for (let i = 1; i <= 4; i++) {
  document.getElementById(`opt{i}`).addEventListener('click', function () {
    const selected = this.innerText;

    // Store the selected answer
    userAnswers.push({
      question: questionsData[currentQuestionIndex].question,
      selectedAnswer: selected,
      correctAnswer: questionsData[currentQuestionIndex].answer
    });

    // Go to next question or submit
    currentQuestionIndex++;

    if (currentQuestionIndex < questionsData.length) {
      showQuestion();
    } else {
      finishQuiz();
    }
  });
}

// Show submit screen
function finishQuiz() {
  document.getElementById('quiz').innerText = "Quiz Completed!";
  document.getElementById('answers-buttons').style.display = 'none';
  document.getElementById('submit-btn').style.display = 'inline-block';
}

// Optional: show results on submit
document.getElementById('submit-btn').addEventListener('click', () => {
  let score = 0;
  userAnswers.forEach(ans => {
    if (ans.selectedAnswer === ans.correctAnswer) score++;
  });

  document.getElementById('quiz').innerText = `You scored ${score} out of ${questionsData.length}!`;
});
