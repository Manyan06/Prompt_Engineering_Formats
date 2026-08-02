const STORAGE_KEY = "prompt-library-items";
const STORAGE_BACKUP_KEY = "prompt-library-items-backup";
const EXPORT_VERSION = 1;

const form = document.getElementById("prompt-form");
const modelInput = document.getElementById("prompt-model");
const titleInput = document.getElementById("prompt-title");
const contentInput = document.getElementById("prompt-content");
const exportButton = document.getElementById("export-button");
const importButton = document.getElementById("import-button");
const importFileInput = document.getElementById("import-file");
const promptList = document.getElementById("prompt-list");
const emptyState = document.getElementById("empty-state");
const template = document.getElementById("prompt-template");
const noteTemplate = document.getElementById("note-template");

let prompts = loadPrompts();

renderPrompts();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const modelName = modelInput.value.trim();
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!modelName || !title || !content) {
    return;
  }

  try {
    prompts.unshift({
      id: crypto.randomUUID(),
      title,
      content,
      rating: 0,
      notes: [],
      metadata: trackModel(modelName, content),
    });

    savePrompts();
    renderPrompts();
    form.reset();
    modelInput.focus();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Unable to save prompt metadata.");
  }
});

exportButton?.addEventListener("click", () => {
  try {
    exportPrompts();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Unable to export prompts.");
  }
});

importButton?.addEventListener("click", () => {
  importFileInput?.click();
});

importFileInput?.addEventListener("change", async () => {
  const file = importFileInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    const fileName = typeof file.name === "string" ? file.name.toLowerCase() : "";
    if (file.type && file.type !== "application/json" && file.type !== "text/plain" && !fileName.endsWith(".json")) {
      throw new Error("Please choose a JSON export file.");
    }

    const fileText = await file.text();
    importPrompts(fileText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import prompts.";
    window.alert(message.startsWith("Import failed:") ? message : `Import failed: ${message}`);
  } finally {
    importFileInput.value = "";
  }
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
        metadata: normalizeMetadata(item.metadata, item.content),
      }))
      .filter((item) => item.id && item.title && item.content);
  } catch {
    return [];
  }
}

function savePrompts() {
  try {
    persistPrompts(prompts);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Unable to save prompts.");
  }
}

function persistPrompts(nextPrompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPrompts));
}

function exportPrompts() {
  const normalizedPrompts = prompts.map((prompt, index) => normalizePromptRecord(prompt, index));
  const exportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    statistics: buildExportStatistics(normalizedPrompts),
    prompts: normalizedPrompts,
  };
  const exportJson = JSON.stringify(exportData, null, 2);
  const blob = new Blob([exportJson], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  downloadLink.href = downloadUrl;
  downloadLink.download = `prompt-library-export-${timestamp}.json`;
  downloadLink.rel = "noopener";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(downloadUrl);
}

function importPrompts(fileText) {
  const backupState = {
    prompts: clonePrompts(prompts),
    storage: localStorage.getItem(STORAGE_KEY),
  };

  localStorage.setItem(STORAGE_BACKUP_KEY, JSON.stringify(backupState));

  try {
    const parsed = JSON.parse(fileText);
    const importedPrompts = validateImportPayload(parsed);
    const mode = chooseImportMode(importedPrompts);
    const mergedPrompts = mergeImportedPrompts(prompts, importedPrompts, mode);

    prompts = mergedPrompts;
    persistPrompts(prompts);
    localStorage.removeItem(STORAGE_BACKUP_KEY);
    renderPrompts();
    window.alert(`Imported ${importedPrompts.length} prompt${importedPrompts.length === 1 ? "" : "s"}.`);
  } catch (error) {
    restoreBackupState();
    const message = error instanceof Error ? error.message : "Import failed.";
    throw new Error(message.startsWith("Import failed:") ? message : `Import failed: ${message}`);
  }
}

function restoreBackupState() {
  try {
    const backupText = localStorage.getItem(STORAGE_BACKUP_KEY);

    if (!backupText) {
      return;
    }

    const backupState = JSON.parse(backupText);

    if (Array.isArray(backupState.prompts)) {
      prompts = backupState.prompts;
      persistPrompts(prompts);
      renderPrompts();
      return;
    }

    if (typeof backupState.storage === "string") {
      localStorage.setItem(STORAGE_KEY, backupState.storage);
      prompts = loadPrompts();
      renderPrompts();
    }
  } catch {
    prompts = loadPrompts();
    renderPrompts();
  } finally {
    localStorage.removeItem(STORAGE_BACKUP_KEY);
  }
}

function renderPrompts() {
  promptList.innerHTML = "";
  const sortedPrompts = [...prompts].sort((left, right) => {
    const leftCreated = Date.parse(left.metadata?.createdAt ?? "");
    const rightCreated = Date.parse(right.metadata?.createdAt ?? "");
    return (Number.isNaN(rightCreated) ? 0 : rightCreated) - (Number.isNaN(leftCreated) ? 0 : leftCreated);
  });

  emptyState.classList.toggle("hide", sortedPrompts.length > 0);

  if (sortedPrompts.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();

  sortedPrompts.forEach((prompt) => {
    const promptCard = template.content.firstElementChild.cloneNode(true);
    promptCard.dataset.id = prompt.id;
    promptCard.querySelector(".prompt-title").textContent = prompt.title;
    const rating = normalizeRating(prompt.rating);
    paintStars(promptCard, rating);
    updateRatingText(promptCard, rating);
    promptCard.querySelector(".prompt-preview").textContent = buildPreview(prompt.content);
    renderMetadata(promptCard, prompt.metadata);
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
  prompt.metadata = updateTimestamps(prompt.metadata ?? trackModel("Prompt Library Default", prompt.content));

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

  prompt.metadata = updateTimestamps(prompt.metadata ?? trackModel("Prompt Library Default", prompt.content));

  savePrompts();
  renderPrompts();
}

function deleteNote(promptId, noteId) {
  const prompt = prompts.find((item) => item.id === promptId);

  if (!prompt || !Array.isArray(prompt.notes)) {
    return;
  }

  prompt.notes = prompt.notes.filter((note) => note.id !== noteId);
  prompt.metadata = updateTimestamps(prompt.metadata ?? trackModel("Prompt Library Default", prompt.content));
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
  prompt.metadata = updateTimestamps(prompt.metadata ?? trackModel("Prompt Library Default", prompt.content));
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

function normalizeMetadata(metadata, content) {
  const fallback = trackModel("Prompt Library Default", typeof content === "string" ? content : "");

  if (!metadata || typeof metadata !== "object") {
    return fallback;
  }

  try {
    const model = typeof metadata.model === "string" && metadata.model.trim() ? metadata.model.trim() : fallback.model;
    const createdAt = isValidIsoDate(metadata.createdAt) ? metadata.createdAt : fallback.createdAt;
    const updatedAt = isValidIsoDate(metadata.updatedAt) && Date.parse(metadata.updatedAt) >= Date.parse(createdAt)
      ? metadata.updatedAt
      : createdAt;
    const tokenEstimate = normalizeTokenEstimate(metadata.tokenEstimate, typeof content === "string" ? content : "");

    return {
      model,
      createdAt,
      updatedAt,
      tokenEstimate,
    };
  } catch {
    return fallback;
  }
}

function normalizeTokenEstimate(tokenEstimate, content) {
  const fallback = estimateTokens(content, false);

  if (!tokenEstimate || typeof tokenEstimate !== "object") {
    return fallback;
  }

  const min = Number(tokenEstimate.min);
  const max = Number(tokenEstimate.max);
  const confidence = tokenEstimate.confidence;

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return fallback;
  }

  if (!["high", "medium", "low"].includes(confidence)) {
    return fallback;
  }

  return {
    min,
    max,
    confidence,
  };
}

function trackModel(modelName, content) {
  const model = validateModelName(modelName);
  const createdAt = new Date().toISOString();
  const tokenEstimate = estimateTokens(content, false);

  return {
    model,
    createdAt,
    updatedAt: createdAt,
    tokenEstimate,
  };
}

function updateTimestamps(metadata) {
  if (!metadata || typeof metadata !== "object") {
    throw new Error("Metadata must be an object.");
  }

  const createdAt = metadata.createdAt;

  if (!isValidIsoDate(createdAt)) {
    throw new Error("createdAt must be a valid ISO 8601 string.");
  }

  const updatedAt = new Date().toISOString();

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new Error("updatedAt must be greater than or equal to createdAt.");
  }

  return {
    ...metadata,
    updatedAt,
  };
}

function estimateTokens(text, isCode) {
  const source = typeof text === "string" ? text : "";
  const wordCount = source.trim() ? source.trim().split(/\s+/).filter(Boolean).length : 0;
  const characterCount = source.length;
  const multiplier = isCode ? 1.3 : 1;
  const min = Number((0.75 * wordCount * multiplier).toFixed(2));
  const max = Number((0.25 * characterCount * multiplier).toFixed(2));
  const estimatedTokens = Math.max(min, max);

  let confidence = "high";

  if (estimatedTokens > 5000) {
    confidence = "low";
  } else if (estimatedTokens >= 1000) {
    confidence = "medium";
  }

  return {
    min,
    max,
    confidence,
  };
}

function validateModelName(modelName) {
  if (typeof modelName !== "string") {
    throw new Error("Model name must be a non-empty string.");
  }

  const trimmed = modelName.trim();

  if (!trimmed) {
    throw new Error("Model name must be a non-empty string.");
  }

  if (trimmed.length > 100) {
    throw new Error("Model name must be 100 characters or fewer.");
  }

  return trimmed;
}

function isValidIsoDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function renderMetadata(card, metadata) {
  if (!metadata) {
    return;
  }

  const modelValue = card.querySelector(".metadata-model");
  const createdValue = card.querySelector(".metadata-created");
  const updatedValue = card.querySelector(".metadata-updated");
  const tokenValue = card.querySelector(".metadata-token");
  const confidenceBadge = card.querySelector(".confidence-badge");

  if (modelValue) {
    modelValue.textContent = metadata.model;
  }

  if (createdValue && isValidIsoDate(metadata.createdAt)) {
    createdValue.textContent = formatReadableDate(metadata.createdAt);
  }

  if (updatedValue && isValidIsoDate(metadata.updatedAt)) {
    updatedValue.textContent = formatReadableDate(metadata.updatedAt);
  }

  if (tokenValue) {
    tokenValue.textContent = `${metadata.tokenEstimate.min} - ${metadata.tokenEstimate.max} tokens`;
  }

  if (confidenceBadge) {
    confidenceBadge.textContent = metadata.tokenEstimate.confidence;
    confidenceBadge.dataset.confidence = metadata.tokenEstimate.confidence;
  }
}

function formatReadableDate(isoDate) {
  const date = new Date(isoDate);

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function normalizePromptRecord(prompt, index) {
  if (!prompt || typeof prompt !== "object") {
    throw new Error(`Prompt at position ${index + 1} is not a valid object.`);
  }

  const id = typeof prompt.id === "string" && prompt.id.trim() ? prompt.id.trim() : "";
  const title = typeof prompt.title === "string" && prompt.title.trim() ? prompt.title.trim() : "";
  const content = typeof prompt.content === "string" && prompt.content.trim() ? prompt.content.trim() : "";

  if (!id) {
    throw new Error(`Prompt at position ${index + 1} is missing a valid id.`);
  }

  if (!title) {
    throw new Error(`Prompt ${id} is missing a valid title.`);
  }

  if (!content) {
    throw new Error(`Prompt ${id} is missing valid content.`);
  }

  return {
    id,
    title,
    content,
    rating: normalizeRating(prompt.rating),
    notes: normalizeNotes(prompt.notes),
    metadata: normalizeMetadata(prompt.metadata, content),
  };
}

function buildExportStatistics(exportPromptsList) {
  const totalPrompts = exportPromptsList.length;
  const averageRating = totalPrompts
    ? Number((exportPromptsList.reduce((sum, item) => sum + normalizeRating(item.rating), 0) / totalPrompts).toFixed(2))
    : 0;
  const modelCounts = new Map();

  exportPromptsList.forEach((item) => {
    const modelName = item.metadata?.model;

    if (!modelName) {
      return;
    }

    modelCounts.set(modelName, (modelCounts.get(modelName) ?? 0) + 1);
  });

  let mostUsedModel = null;
  let highestCount = 0;

  modelCounts.forEach((count, modelName) => {
    if (count > highestCount) {
      highestCount = count;
      mostUsedModel = {
        model: modelName,
        count,
      };
    }
  });

  return {
    totalPrompts,
    averageRating,
    mostUsedModel,
  };
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Imported file must contain a JSON object.");
  }

  if (payload.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${payload.version}. Expected version ${EXPORT_VERSION}.`);
  }

  if (typeof payload.exportedAt !== "string" || !isValidIsoDate(payload.exportedAt)) {
    throw new Error("Imported file is missing a valid exportedAt timestamp.");
  }

  if (!Array.isArray(payload.prompts)) {
    throw new Error("Imported file must include a prompts array.");
  }

  const seenIds = new Set();

  return payload.prompts.map((prompt, index) => {
    const normalizedPrompt = normalizePromptRecord(prompt, index);

    if (seenIds.has(normalizedPrompt.id)) {
      throw new Error(`Duplicate prompt id found in imported file: ${normalizedPrompt.id}`);
    }

    seenIds.add(normalizedPrompt.id);
    return normalizedPrompt;
  });
}

function chooseImportMode(importedPrompts) {
  const conflictCount = importedPrompts.filter((prompt) => prompts.some((existingPrompt) => existingPrompt.id === prompt.id)).length;
  const promptMessage = conflictCount > 0
    ? `Found ${conflictCount} duplicate prompt id${conflictCount === 1 ? "" : "s"} against your current library. Type merge to keep existing prompts and add only new ones, or replace to overwrite the current library.`
    : "Type merge to add the imported prompts to your current library, or replace to overwrite the current library.";
  const response = window.prompt(promptMessage, "merge");

  if (response === null) {
    throw new Error("Import cancelled.");
  }

  const mode = response.trim().toLowerCase();

  if (mode !== "merge" && mode !== "replace") {
    throw new Error('Import mode must be either "merge" or "replace".');
  }

  return mode;
}

function mergeImportedPrompts(existingPrompts, importedPrompts, mode) {
  if (mode === "replace") {
    return importedPrompts;
  }

  const existingIds = new Set(existingPrompts.map((prompt) => prompt.id));
  const mergedPrompts = clonePrompts(existingPrompts);

  importedPrompts.forEach((prompt) => {
    if (existingIds.has(prompt.id)) {
      return;
    }

    mergedPrompts.push(prompt);
  });

  return mergedPrompts;
}

function clonePrompts(promptList) {
  return promptList.map((prompt) => JSON.parse(JSON.stringify(prompt)));
}
