let currindex = 0;
const userans = [];
const totalq = 10;
let curq = {};

function decodeHTML(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function show() {
  const quizbox = document.getElementById("quiz");
  const optionbtns = [
    document.getElementById("opt1"),
    document.getElementById("opt2"),
    document.getElementById("opt3"),
    document.getElementById("opt4")
  ];
  let diffColor;
if (curq.diff === "easy") diffColor = "green";
else if (curq.diff === "medium") diffColor = "orange";
else diffColor = "red";

quizbox.innerHTML = `Q${currindex + 1}: ${curq.question} - <span style="color: ${diffColor}; font-weight: bold;">${curq.diff.toUpperCase()}</span>`;

  curq.options.forEach((opt, i) => {
    const btn = optionbtns[i];
    btn.innerText = opt;
    btn.disabled = false;
    btn.classList.remove("selected", "correct", "wrong");

    btn.onclick = () => {
      // Deselect all
      optionbtns.forEach(b => {
        b.classList.remove("selected", "correct", "wrong");
        b.disabled = true;
      });

      // Mark selection
      if (btn.innerText === curq.answer) {
        btn.classList.add("correct");
      } else {
        btn.classList.add("wrong");
        optionbtns.forEach(b => {
          if (b.innerText === curq.answer) {
            b.classList.add("correct");
          }
        });
      }

      // Store answer
      userans[currindex] = {
        question: curq.question,
        selected: btn.innerText,
        correct: curq.answer
      };

      // Show next or submit
      if (currindex === totalq - 1) {
        document.getElementById("submit-btn").style.display = "inline-block";
        document.getElementById("next-btn").style.display = "none";
      } else {
        document.getElementById("next-btn").style.display = "inline-block";
        document.getElementById("submit-btn").style.display = "none";
      }
    };
  });

  // Hide buttons initially
  document.getElementById("next-btn").style.display = "none";
  document.getElementById("submit-btn").style.display = "none";
}
let questionsList = [];

function fetchq() {
  fetch("https://opentdb.com/api.php?amount=10&type=multiple")
    .then(res => res.json())
    .then(data => {
      questionsList = data.results.map(q => {
        const options = shuffle([
          decodeHTML(q.correct_answer),
          ...q.incorrect_answers.map(decodeHTML)
        ])
        const diff=decodeHTML(q.difficulty);
        return {
          question: decodeHTML(q.question),
          options: options,
          answer: decodeHTML(q.correct_answer),
          diff:decodeHTML(diff)
        };
      });

      curq = questionsList[currindex];
      show();
    })
    .catch(err => console.log("Fetch error:", err));
}

// Next button handler
document.getElementById("next-btn").addEventListener("click", () => {
  currindex++;
  if (currindex < totalq) {
    curq=questionsList[currindex];
    show();
  }
});

document.getElementById("back-btn").addEventListener("click", () => {
  currindex--;
  if (currindex < totalq) {
    curq=questionsList[currindex];
    show();
  }
});
// Submit button handler
document.getElementById("submit-btn").addEventListener("click", () => {
  let score = 0;
  userans.forEach(ans => {
    if (ans.selected === ans.correct) {
      score++;
    }
  });

  document.getElementById("quiz").innerText = `You scored ${score} out of ${totalq}!`;
  document.getElementById("answers-buttons").style.display = "none";
  document.getElementById("next-btn").style.display = "none";
  document.getElementById("submit-btn").style.display = "none";
});

// Start the quiz
fetchq();
