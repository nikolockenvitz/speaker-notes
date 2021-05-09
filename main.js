let time = {
  started: null,
  offset: 0,
};
const notes = []; // { note: "", el: DomElement, time: { offset: 0, started: 0 } }
let currentNoteId = 0;
let inEditMode = false;

const inputElNotes = document.getElementById("input");
const textHintEditNotes = document.getElementById("hint-edit-notes");
const btnSaveNotes = document.getElementById("btn-save-notes");
const btnEditNotes = document.getElementById("btn-edit-notes");
const btnToggleTime = document.getElementById("btn-toggle-time");
const btnSetTime = document.getElementById("btn-set-time");
const btnResetTime = document.getElementById("btn-reset-time");
const mainContainer = document.getElementById("main-container");

window.onload = function () {
  const notesFromLS = getNotesFromLocalStorage();
  if (!notesFromLS) {
    makeNotesEditable();
  } else {
    loadNotes(notesFromLS);
  }
  time = getTimeFromLocalStorage(time);
  updateTimeTextFields();
  if (isTimerRunning()) {
    autoUpdateTimeTextFields();
  }

  btnSaveNotes.addEventListener("click", saveNotes);
  btnEditNotes.addEventListener("click", makeNotesEditable);
  btnToggleTime.addEventListener("click", () => {
    isTimerRunning() ? stopTimer() : startTimer();
  });
  btnResetTime.addEventListener("click", () => {
    stopTimer();
    time.offset = 0;
    notes.forEach((note) => {
      note.time.offset = 0;
      note.time.started = 0;
    });
    stopTimer();
  });
  btnSetTime.addEventListener("click", () => {});

  document.addEventListener("keydown", (event) => {
    if (!inEditMode && ["ArrowUp", "ArrowDown", " "].includes(event.key)) {
      event.preventDefault();
    }
  });
  document.addEventListener("keyup", (event) => {
    if (["ArrowRight", "ArrowDown"].includes(event.key) && currentNoteId < notes.length - 1) {
      // next note
      do {
        const currentNote = notes[currentNoteId++].el;
        const nextNote = notes[currentNoteId].el;
        currentNote.classList.remove("active");
        currentNote.classList.add("inactive");
        nextNote.classList.add("active");

        notes[currentNoteId - 1].time.offset += getCurrentTimerTimeInSeconds() - notes[currentNoteId - 1].time.started;
        notes[currentNoteId - 1].time.started = null;
        notes[currentNoteId].time.started = getCurrentTimerTimeInSeconds();
      } while (currentNoteId < notes.length - 1 && notes[currentNoteId].note === "");
    } else if (["ArrowLeft", "ArrowUp"].includes(event.key) && currentNoteId > 0) {
      // previous note
      do {
        const currentNote = notes[currentNoteId--].el;
        const previousNote = notes[currentNoteId].el;
        currentNote.classList.remove("active");
        previousNote.classList.add("active");
        previousNote.classList.remove("inactive");

        notes[currentNoteId].time.started = getCurrentTimerTimeInSeconds();
        notes[currentNoteId + 1].time.offset += getCurrentTimerTimeInSeconds() - notes[currentNoteId + 1].time.started;
        notes[currentNoteId + 1].time.started = null;
      } while (currentNoteId > 0 && notes[currentNoteId].note === "");
    } else if (event.key === " ") {
      if (inEditMode) return;
      if (isTimerRunning()) {
        stopTimer();
      } else {
        startTimer();
      }
    }
  });
};

function makeNotesEditable() {
  if (inEditMode) return;
  inEditMode = true;
  stopTimer();
  const notesString = notes.reduce((str, note) => str + (str === "" ? "" : "\n") + note.note, "");
  inputElNotes.value = notesString;
  mainContainer.querySelectorAll(".note").forEach((el) => el.remove());
  inputElNotes.classList.remove("hidden");
  btnSaveNotes.classList.remove("hidden");
  textHintEditNotes.classList.remove("hidden");
  while (notes.length > 0) {
    notes.pop();
  }
  inputElNotes.focus();
}

function saveNotes() {
  const notesString = inputElNotes.value;
  writeNotesToLocalStorage(notesString);
  loadNotes(notesString);
}
function loadNotes(notesString) {
  inEditMode = false;
  currentNoteId = 0;
  for (const note of notesString.split("\n")) {
    const currentNote = { note: note.trim(), time: { offset: 0, started: 0 } };
    currentNote.el = insertNoteIntoDOM(note);
    notes.push(currentNote);
  }
  if (notes.length > 0) {
    notes[0].el.classList.add("active");
  }
  inputElNotes.classList.add("hidden");
  btnSaveNotes.classList.add("hidden");
  textHintEditNotes.classList.add("hidden");
  updateTimeTextFields();
}

function insertNoteIntoDOM(note) {
  const el = document.createElement("div");
  el.classList.add("note");
  el.textContent = note;
  mainContainer.appendChild(el);
  return el;
}

function startTimer() {
  time.started = getCurrentTimeInSeconds();
  if (notes.length > 0) {
    notes[currentNoteId].time.started = getCurrentTimerTimeInSeconds();
  }
  autoUpdateTimeTextFields();
  writeTimeToLocalStorage(time);
}
function stopTimer() {
  time.offset = getCurrentTimerTimeInSeconds();
  time.started = null;
  if (notes.length > 0) {
    notes[currentNoteId].time.offset = time.offset - notes[currentNoteId].time.started;
    notes[currentNoteId].time.started = null;
  }
  stopAutoUpdatingTimeTextFields();
  updateTimeTextFields();
  writeTimeToLocalStorage(time);
}
function isTimerRunning() {
  return time.started !== null;
}

let autoUpdateTimeIntervalId = null;
function autoUpdateTimeTextFields() {
  autoUpdateTimeIntervalId = setInterval(updateTimeTextFields, 100);
}
function updateTimeTextFields() {
  const el = document.getElementById("current-time");
  el.textContent = secondsToTimeString(getCurrentTimerTimeInSeconds());

  btnToggleTime.textContent = isTimerRunning() ? "Pause" : "Start";

  //forecast
  const defaultTimePerChar = 0.054;
  let forecastChars = 0;
  let forecastElapsedTime = 0;
  let forecastAdditionalTime = 0;
  for (let noteId = 0; noteId < notes.length; noteId++) {
    const note = notes[noteId];
    if (note.note === "") {
      continue;
    }
    if (noteId < currentNoteId && !note.note.startsWith("##")) {
      forecastChars += note.note.length;
      forecastElapsedTime += note.time.offset;
    } else {
      const estimatedTimeCurrentNote = note.note.startsWith("##")
        ? noteId >= currentNoteId
          ? Number(note.note.split(" ").pop()) || 0
          : 0
        : note.note.length * (forecastChars > 0 ? forecastElapsedTime / forecastChars : defaultTimePerChar);
      forecastAdditionalTime += estimatedTimeCurrentNote;
      if (noteId === currentNoteId) {
        // for current note, we add difference between estimated and elapsed time
        // if more time elapsed than estimated, we add nothing
        // (elapsed time is already added above)
        const elapsedTimeCurrentNote = note.time.offset + getCurrentTimerTimeInSeconds() - note.time.started;
        forecastAdditionalTime -= Math.min(elapsedTimeCurrentNote, estimatedTimeCurrentNote);
      }
    }
  }
  const elForecast = document.getElementById("forecast");
  if (isNaN(forecastAdditionalTime)) {
    elForecast.textContent = "--:--";
  } else {
    elForecast.textContent = secondsToTimeString(getCurrentTimerTimeInSeconds() + forecastAdditionalTime);
  }
}
function secondsToTimeString(seconds) {
  seconds = Math.floor(seconds);
  const s = seconds % 60;
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  return `${h > 0 ? String(h) + ":" : ""}${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}
function stopAutoUpdatingTimeTextFields() {
  clearInterval(autoUpdateTimeIntervalId);
}

function getCurrentTimerTimeInSeconds() {
  return time.offset + (time.started === null ? 0 : getCurrentTimeInSeconds() - time.started);
}
function getCurrentTimeInSeconds() {
  return new Date().getTime() / 1000;
}

const LS_KEY_PREFIX = new URL(window.location.href).hostname + "-";
const LS_KEY_NOTES = LS_KEY_PREFIX + "notes";
const LS_KEY_TIME = LS_KEY_PREFIX + "time";
function getNotesFromLocalStorage() {
  return localStorage.getItem(LS_KEY_NOTES);
}
function writeNotesToLocalStorage(notes) {
  localStorage.setItem(LS_KEY_NOTES, notes);
}
function getTimeFromLocalStorage(defaultObject) {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_TIME));
  } catch {
    return defaultObject;
  }
}
function writeTimeToLocalStorage(time) {
  localStorage.setItem(LS_KEY_TIME, JSON.stringify(time));
}
