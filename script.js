
"use strict";

/* ===== DOM ELEMENTS ===== */

const keypad = document.getElementById("keypad");
const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const themeToggle = document.getElementById("themeToggle");

const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const clearHistoryButton = document.getElementById("clearHistory");
const copyResultButton = document.getElementById("copyResult");
const toggleHistoryButton = document.getElementById("toggleHistory");

/* ===== VALIDATE HTML ===== */

if (!keypad || !expressionDisplay || !resultDisplay || !themeToggle) {
    throw new Error("Required calculator HTML elements are missing.");
}

/* ===== STATE ===== */

let expression = "";
let justCalculated = false;
let hasError = false;
let lastAnswer = null;

/* ===== LOCAL STORAGE HELPERS ===== */

const HISTORY_KEY = "calc_history";
const THEME_KEY = "calc_theme";

function readStorage(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

/* ===== PERSISTENT HISTORY ===== */

const savedHistory = readStorage(HISTORY_KEY, []);

let calculationHistory = Array.isArray(savedHistory)
    ? savedHistory.filter(item =>
        item &&
        typeof item.expression === "string" &&
        typeof item.result === "string"
    ).slice(0, 10)
    : [];


const operators = ["+", "-", "*", "/"];

const operatorSymbols = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷"
};

/* ===== FORMATTING ===== */

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        throw new Error("Invalid result");
    }

    if (Object.is(value, -0) || value === 0) {
        return "0";
    }

    return String(Number(value.toPrecision(12)));
}

function formatExpression(value) {
    return value.replace(/[+\-*/]/g, symbol => operatorSymbols[symbol]);
}

/* ===== SAFE CALCULATION PARSER ===== */

function calculateExpression(input) {
    const tokens = input.match(
        /(?:\d+(?:\.\d*)?|\.\d+)|[+\-*/%]/g
    );

    if (!tokens || tokens.join("") !== input) {
        throw new Error("Invalid expression");
    }

    let position = 0;

    function parsePrimary() {
        const token = tokens[position];

        if (token === "+" || token === "-") {
            position++;

            const value = parsePrimary();

            return token === "-" ? -value : value;
        }

        if (
            token === undefined ||
            !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)
        ) {
            throw new Error("Invalid expression");
        }

        position++;

        let value = Number(token);

        if (!Number.isFinite(value)) {
            throw new Error("Invalid number");
        }

        while (tokens[position] === "%") {
            value /= 100;
            position++;
        }

        return value;
    }

    function parseMultiplication() {
        let value = parsePrimary();

        while (
            tokens[position] === "*" ||
            tokens[position] === "/"
        ) {
            const operator = tokens[position++];
            const right = parsePrimary();

            if (operator === "/" && right === 0) {
                throw new Error("Cannot divide by zero");
            }

            value = operator === "*"
                ? value * right
                : value / right;

            if (!Number.isFinite(value)) {
                throw new Error("Result is too large");
            }
        }

        return value;
    }

    function parseAddition() {
        let value = parseMultiplication();

        while (
            tokens[position] === "+" ||
            tokens[position] === "-"
        ) {
            const operator = tokens[position++];
            const right = parseMultiplication();

            value = operator === "+"
                ? value + right
                : value - right;

            if (!Number.isFinite(value)) {
                throw new Error("Result is too large");
            }
        }

        return value;
    }

    const result = parseAddition();

    if (position !== tokens.length) {
        throw new Error("Invalid expression");
    }

    return result;
}

/* ===== DISPLAY ===== */

function updateDisplay(preview = true) {
    expressionDisplay.textContent = expression
        ? formatExpression(expression)
        : "Ready to calculate";

    if (hasError) {
        resultDisplay.textContent = "Error";
        return;
    }

    if (!expression) {
        resultDisplay.textContent = "0";
        return;
    }

    if (!preview) return;

    try {
        resultDisplay.textContent = formatNumber(
            calculateExpression(expression)
        );
    } catch {
        resultDisplay.textContent = "0";
    }
}

/* ===== INPUT HELPERS ===== */

function resetAfterError() {
    if (hasError) {
        expression = "";
        hasError = false;
        lastAnswer = null;
    }
}

function getCurrentNumberStart() {
    let i = expression.length - 1;

    while (i >= 0 && /[\d.]/.test(expression[i])) {
        i--;
    }

    return i + 1;
}

function appendNumber(number) {
    resetAfterError();

    if (justCalculated) {
        expression = "";
        justCalculated = false;
        lastAnswer = null;
    }

    const start = getCurrentNumberStart();
    const currentNumber = expression.slice(start);

    if (currentNumber === "0") {
        if (number === "0") return;

        expression = expression.slice(0, start) + number;
    } else {
        expression += number;
    }

    updateDisplay();
}

function appendDecimal() {
    resetAfterError();

    if (justCalculated) {
        expression = "";
        justCalculated = false;
        lastAnswer = null;
    }

    const start = getCurrentNumberStart();
    const currentNumber = expression.slice(start);

    if (currentNumber.includes(".")) return;

    expression += currentNumber ? "." : "0.";

    updateDisplay();
}

function appendOperator(operator) {
    resetAfterError();

    if (!expression) {
        if (operator === "-") {
            expression = "-";
            updateDisplay(false);
        }
        return;
    }

    justCalculated = false;
    lastAnswer = null;

    const last = expression.at(-1);

    if (operators.includes(last)) {
        if (operator === "-" && last !== "-") {
            expression += "-";
        } else {
            expression = expression.slice(0, -1) + operator;
        }
    } else if (last === ".") {
        expression += "0" + operator;
    } else {
        expression += operator;
    }

    updateDisplay();
}

/* ===== HISTORY ===== */

function renderHistory() {
    if (!historyList) return;

    historyList.replaceChildren();

    if (calculationHistory.length === 0) {
        const item = document.createElement("li");
        item.textContent = "No calculations yet.";
        historyList.appendChild(item);
        return;
    }

    calculationHistory.forEach(entry => {
        const item = document.createElement("li");
        const details = document.createElement("span");
        const useButton = document.createElement("button");

        details.textContent = `${entry.expression} = ${entry.result}`;
        useButton.type = "button";
        useButton.textContent = "Use";

        useButton.addEventListener("click", () => {
            expression = entry.result;
            justCalculated = true;
            hasError = false;
            lastAnswer = Number(entry.result);
            updateDisplay();
        });

        item.append(details, useButton);
        historyList.appendChild(item);
    });
}


function saveHistory(originalExpression, answer) {
    calculationHistory.unshift({
        expression: formatExpression(originalExpression),
        result: formatNumber(answer)
    });

    calculationHistory = calculationHistory.slice(0, 10);

    writeStorage(HISTORY_KEY, calculationHistory);

    renderHistory();
}


/* ===== CALCULATE ===== */

function calculate() {
    if (!expression || hasError) return;

    const originalExpression = expression;

    try {
        const answer = calculateExpression(originalExpression);
        const formattedAnswer = formatNumber(answer);

        saveHistory(originalExpression, answer);

        expressionDisplay.textContent =
            formatExpression(originalExpression) + " =";

        resultDisplay.textContent = formattedAnswer;

        expression = formattedAnswer;
        lastAnswer = answer;
        justCalculated = true;
        hasError = false;
    } catch (error) {
        hasError = true;

        resultDisplay.textContent =
            error.message === "Cannot divide by zero"
                ? "Cannot divide by zero"
                : "Invalid expression";

        expressionDisplay.textContent =
            formatExpression(originalExpression);
    }
}

/* ===== CLEAR AND DELETE ===== */

function clearCalculator() {
    expression = "";
    justCalculated = false;
    hasError = false;
    lastAnswer = null;

    updateDisplay();
}

function deleteLast() {
    if (hasError || justCalculated) {
        clearCalculator();
        return;
    }

    expression = expression.slice(0, -1);

    updateDisplay();
}

/* ===== PERCENTAGE ===== */

function applyPercentage() {
    resetAfterError();

    if (!expression) return;

    if (justCalculated) {
        expression = formatNumber(Number(expression) / 100);
        justCalculated = false;
        lastAnswer = null;
        updateDisplay();
        return;
    }

    const start = getCurrentNumberStart();
    const currentNumber = expression.slice(start);

    if (!currentNumber || currentNumber === ".") return;

    const value = Number(currentNumber);

    if (!Number.isFinite(value)) return;

    expression =
        expression.slice(0, start) +
        formatNumber(value / 100);

    updateDisplay();
}

/* ===== SIGN CHANGE ===== */

function toggleSign() {
    resetAfterError();

    if (justCalculated) {
        expression = formatNumber(-Number(expression));
        justCalculated = false;
        lastAnswer = null;
        updateDisplay();
        return;
    }

    if (!expression) {
        expression = "-";
        updateDisplay(false);
        return;
    }

    const start = getCurrentNumberStart();
    const currentNumber = expression.slice(start);
    const prefix = expression.slice(0, start);

    if (!currentNumber || currentNumber === ".") {
        if (expression.endsWith("-")) {
            expression = expression.slice(0, -1);
        } else {
            expression += "-";
        }

        updateDisplay(false);
        return;
    }

    const hasUnaryMinus =
        prefix.endsWith("-") &&
        (
            prefix.length === 1 ||
            operators.includes(prefix.at(-2))
        );

    expression = hasUnaryMinus
        ? prefix.slice(0, -1) + currentNumber
        : prefix + "-" + currentNumber;

    updateDisplay();
}

/* ===== BUTTON EVENTS ===== */

keypad.addEventListener("click", event => {
    const button = event.target.closest("button.key");

    if (!button || !keypad.contains(button)) return;

    if (button.dataset.number !== undefined) {
        appendNumber(button.dataset.number);
        return;
    }

    if (button.dataset.operator) {
        appendOperator(button.dataset.operator);
        return;
    }

    switch (button.dataset.action) {
        case "clear":
            clearCalculator();
            break;

        case "delete":
            deleteLast();
            break;

        case "decimal":
            appendDecimal();
            break;

        case "calculate":
            calculate();
            break;

        case "percent":
            applyPercentage();
            break;

        case "sign":
            toggleSign();
            break;
    }
});

/* ===== KEYBOARD ===== */

document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;

    if (/^\d$/.test(key)) {
        event.preventDefault();
        appendNumber(key);
    } else if (key === ".") {
        event.preventDefault();
        appendDecimal();
    } else if (operators.includes(key)) {
        event.preventDefault();
        appendOperator(key);
    } else if (key === "Enter" || key === "=") {
        event.preventDefault();
        calculate();
    } else if (key === "Backspace") {
        event.preventDefault();
        deleteLast();
    } else if (key === "Escape" || key === "Delete") {
        event.preventDefault();
        clearCalculator();
    } else if (key === "%") {
        event.preventDefault();
        applyPercentage();
    }
});

/* ===== COPY RESULT ===== */

if (copyResultButton) {
    copyResultButton.addEventListener("click", async () => {
        const result = resultDisplay.textContent;

        if (
            !result ||
            result === "Error" ||
            result === "Invalid expression" ||
            result === "Cannot divide by zero"
        ) {
            return;
        }

        try {
            await navigator.clipboard.writeText(result);

            copyResultButton.textContent = "Copied!";

            setTimeout(() => {
                copyResultButton.textContent = "Copy result";
            }, 1200);
        } catch {
            copyResultButton.textContent = "Copy unavailable";

            setTimeout(() => {
                copyResultButton.textContent = "Copy result";
            }, 1500);
        }
    });
}

/* ===== HISTORY CONTROLS ===== */

if (toggleHistoryButton && historyPanel) {
    toggleHistoryButton.addEventListener("click", () => {
        historyPanel.hidden = !historyPanel.hidden;

        if (!historyPanel.hidden) {
            renderHistory();
        }
    });
}


if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", () => {
        calculationHistory = [];

        writeStorage(HISTORY_KEY, calculationHistory);

        renderHistory();
    });
}



/* ===== PERSISTENT THEME ===== */

function setTheme(isLight, persist = true) {
    document.body.classList.toggle("light-theme", isLight);

    themeToggle.textContent = isLight ? "☾" : "☼";

    themeToggle.setAttribute(
        "aria-label",
        isLight ? "Switch to dark theme" : "Switch to light theme"
    );

    if (persist) {
        writeStorage(THEME_KEY, isLight ? "light" : "dark");
    }
}

themeToggle.addEventListener("click", () => {
    const isCurrentlyLight =
        document.body.classList.contains("light-theme");

    setTheme(!isCurrentlyLight);
});

/* Restore saved theme on page load */

const savedTheme = readStorage(THEME_KEY, "dark");

setTheme(savedTheme === "light", false);


/* ===== INITIALIZE ===== */

renderHistory();
updateDisplay();
