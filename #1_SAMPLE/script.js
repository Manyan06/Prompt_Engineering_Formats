const STORAGE_KEY = "prompt-library-items";

const form = document.getElementById("prompt-form");
const titleInput = document.getElementById("prompt-title");
const contentInput = document.getElementById("prompt-content");
const promptList = document.getElementById("prompt-list");
const emptyState = document.getElementById("empty-state");
const template = document.getElementById("prompt-template");
const noteTemplate = document.getElementById("note-template");

let prompts = loadPrompts();

renderPrompts();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) {
    return;
  }

  prompts.unshift({
    id: crypto.randomUUID(),
    title,
    content,
    rating: 0,
    notes: [],
  });

  savePrompts();
  renderPrompts();
  form.reset();
  titleInput.focus();
});

promptList.addEventListener("click", (event) => {
  const noteEditButton = event.target.closest(".note-edit-button");

  if (noteEditButton) {
    const noteItem = noteEditButton.closest(".note-item");

    if (!noteItem) {
      return;
    }

    setNoteEditing(noteItem, true);
    return;
  }

  const noteSaveButton = event.target.closest(".note-save-button");

  if (noteSaveButton) {
    const noteItem = noteSaveButton.closest(".note-item");
    const card = noteSaveButton.closest(".prompt-card");
    const promptId = card?.dataset.id;
    const noteId = noteItem?.dataset.noteId;

    if (!noteItem || !promptId || !noteId) {
      return;
    }

    saveEditedNote(promptId, noteId, noteItem);
    return;
  }

  const noteDeleteButton = event.target.closest(".note-delete-button");

  if (noteDeleteButton) {
    const noteItem = noteDeleteButton.closest(".note-item");
    const card = noteDeleteButton.closest(".prompt-card");
    const promptId = card?.dataset.id;
    const noteId = noteItem?.dataset.noteId;

    if (!noteItem || !promptId || !noteId) {
      return;
    }

    deleteNote(promptId, noteId);
    return;
  }

  const starButton = event.target.closest(".star-button");

  if (starButton) {
    const card = starButton.closest(".prompt-card");
    const promptId = card?.dataset.id;
    const ratingValue = Number(starButton.dataset.value);

    if (!promptId || Number.isNaN(ratingValue)) {
      return;
    }

    setRating(promptId, ratingValue);
    return;
  }

  const deleteButton = event.target.closest(".delete-button");

  if (!deleteButton) {
    return;
  }

  const card = deleteButton.closest(".prompt-card");
  const promptId = card?.dataset.id;

  if (!promptId) {
    return;
  }

  prompts = prompts.filter((prompt) => prompt.id !== promptId);
  savePrompts();
  renderPrompts();
});

promptList.addEventListener("submit", (event) => {
  const noteForm = event.target.closest(".note-form");

  if (!noteForm) {
    return;
  }

  event.preventDefault();

  const card = noteForm.closest(".prompt-card");
  const promptId = card?.dataset.id;
  const noteInput = noteForm.querySelector(".note-input");
  const text = noteInput?.value.trim();

  if (!promptId || !text) {
    return;
  }

  addNote(promptId, text);
  noteInput.value = "";
});

promptList.addEventListener("mouseover", (event) => {
  const starButton = event.target.closest(".star-button");

  if (!starButton) {
    return;
  }

  const card = starButton.closest(".prompt-card");
  const hoverValue = Number(starButton.dataset.value);

  if (!card || Number.isNaN(hoverValue)) {
    return;
  }

  paintStars(card, hoverValue);
});

promptList.addEventListener("mouseout", (event) => {
  const starButton = event.target.closest(".star-button");

  if (!starButton) {
    return;
  }

  const card = starButton.closest(".prompt-card");
  const promptId = card?.dataset.id;

  if (!card || !promptId) {
    return;
  }

  const prompt = prompts.find((item) => item.id === promptId);
  paintStars(card, prompt?.rating ?? 0);
});

promptList.addEventListener("keydown", (event) => {
  const starButton = event.target.closest(".star-button");

  if (!starButton) {
    return;
  }

  const card = starButton.closest(".prompt-card");
  const promptId = card?.dataset.id;

  if (!promptId) {
    return;
  }

  const currentPrompt = prompts.find((item) => item.id === promptId);
  const currentRating = currentPrompt?.rating ?? 0;

  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    setRating(promptId, currentRating + 1);
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    event.preventDefault();
    setRating(promptId, currentRating - 1);
  }
});

function loadPrompts() {
  try {
    const storedPrompts = localStorage.getItem(STORAGE_KEY);
    const parsed = storedPrompts ? JSON.parse(storedPrompts) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        rating: normalizeRating(item.rating),
        notes: normalizeNotes(item.notes),
      }))
      .filter((item) => item.id && item.title && item.content);
  } catch {
    return [];
  }
}

function savePrompts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function renderPrompts() {
  promptList.innerHTML = "";
  emptyState.classList.toggle("hide", prompts.length > 0);

  if (prompts.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();

  prompts.forEach((prompt) => {
    const promptCard = template.content.firstElementChild.cloneNode(true);
    promptCard.dataset.id = prompt.id;
    promptCard.querySelector(".prompt-title").textContent = prompt.title;
    const rating = normalizeRating(prompt.rating);
    paintStars(promptCard, rating);
    updateRatingText(promptCard, rating);
    promptCard.querySelector(".prompt-preview").textContent = buildPreview(prompt.content);
    renderNotes(promptCard, prompt.notes);
    fragment.appendChild(promptCard);
  });

  promptList.appendChild(fragment);
}

function setRating(promptId, newRating) {
  const prompt = prompts.find((item) => item.id === promptId);

  if (!prompt) {
    return;
  }

  prompt.rating = normalizeRating(newRating);
  savePrompts();

  const card = promptList.querySelector(`.prompt-card[data-id="${promptId}"]`);
  if (!card) {
    return;
  }

  paintStars(card, prompt.rating);
  updateRatingText(card, prompt.rating);
}

function addNote(promptId, text) {
  const prompt = prompts.find((item) => item.id === promptId);

  if (!prompt) {
    return;
  }

  prompt.notes = Array.isArray(prompt.notes) ? prompt.notes : [];
  prompt.notes.unshift({
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  savePrompts();
  renderPrompts();
}

function deleteNote(promptId, noteId) {
  const prompt = prompts.find((item) => item.id === promptId);

  if (!prompt || !Array.isArray(prompt.notes)) {
    return;
  }

  prompt.notes = prompt.notes.filter((note) => note.id !== noteId);
  savePrompts();
  renderPrompts();
}

function saveEditedNote(promptId, noteId, noteItem) {
  const prompt = prompts.find((item) => item.id === promptId);

  if (!prompt || !Array.isArray(prompt.notes)) {
    return;
  }

  const note = prompt.notes.find((item) => item.id === noteId);
  const editInput = noteItem.querySelector(".note-edit-input");
  const text = editInput?.value.trim();

  if (!note || !text) {
    return;
  }

  note.text = text;
  note.updatedAt = Date.now();
  savePrompts();
  renderPrompts();
}

function setNoteEditing(noteItem, isEditing) {
  const view = noteItem.querySelector(".note-view");
  const editPanel = noteItem.querySelector(".note-edit-panel");
  const editInput = noteItem.querySelector(".note-edit-input");
  const text = noteItem.querySelector(".note-text")?.textContent ?? "";

  view?.classList.toggle("hide", isEditing);
  editPanel?.classList.toggle("hide", !isEditing);

  if (isEditing && editInput) {
    editInput.value = text;
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  }
}

function normalizeRating(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(numeric)));
}

function normalizeNotes(notes) {
  if (!Array.isArray(notes)) {
    return [];
  }

  return notes
    .filter((note) => note && typeof note === "object")
    .map((note) => ({
      id: note.id,
      text: typeof note.text === "string" ? note.text.trim() : "",
      createdAt: Number(note.createdAt) || Date.now(),
      updatedAt: Number(note.updatedAt) || Number(note.createdAt) || Date.now(),
    }))
    .filter((note) => note.id && note.text);
}

function paintStars(card, rating) {
  const stars = card.querySelectorAll(".star-button");

  stars.forEach((star) => {
    const value = Number(star.dataset.value);
    const isActive = value <= rating;
    star.classList.toggle("is-active", isActive);
    star.textContent = isActive ? "★" : "☆";
    star.setAttribute("aria-checked", value === rating ? "true" : "false");
  });
}

function renderNotes(card, notes) {
  const notesList = card.querySelector(".notes-list");

  if (!notesList) {
    return;
  }

  notesList.innerHTML = "";

  const normalizedNotes = Array.isArray(notes) ? notes : [];

  if (normalizedNotes.length === 0) {
    const emptyNote = document.createElement("li");
    emptyNote.className = "notes-empty";
    emptyNote.textContent = "No notes yet.";
    notesList.appendChild(emptyNote);
    return;
  }

  const fragment = document.createDocumentFragment();

  normalizedNotes.forEach((note) => {
    const noteCard = noteTemplate.content.firstElementChild.cloneNode(true);
    noteCard.dataset.noteId = note.id;
    noteCard.querySelector(".note-text").textContent = note.text;
    noteCard.querySelector(".note-edit-input").value = note.text;
    fragment.appendChild(noteCard);
  });

  notesList.appendChild(fragment);
}

function updateRatingText(card, rating) {
  const ratingValue = card.querySelector(".rating-value");

  if (!ratingValue) {
    return;
  }

  ratingValue.textContent = `${rating}/5`;
}

function buildPreview(content) {
  const words = content.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 8) {
    return content.trim();
  }

  return `${words.slice(0, 8).join(" ")}...`;
}
