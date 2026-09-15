'use strict';

// Checklist JSON persistence (plan.md:5, plan.md:10).
// MVP: read-modify-write on server/data/checklists.json (low concurrency).
// filePath param exists so tests can use a temp file; Repository interface
// keeps future PG migration painless.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DATA_DIR } = require('../../utils/store');

const DEFAULT_FILE = path.join(DATA_DIR, 'checklists.json');

function loadList(file = DEFAULT_FILE) {
  try {
    // Strip BOM: PowerShell Set-Content -Encoding UTF8 writes one, and
    // JSON.parse chokes on it ("Unexpected token '[BOM]'"). Never 500 on that.
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw.trim() || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function saveList(list, file = DEFAULT_FILE) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, file);
}

// Persisted checklist holds OFFERINGS only. Ritual steps are a guided
// flow (see chat draft `guide`), never persisted checkboxes.
function buildItems(deity) {
  return (deity.common_offerings || []).map((label, i) => ({
    id: `offer-${i + 1}`,
    label,
    category: 'offering',
    checked: false,
  }));
}

function createChecklist({ userIdHash = '', deity, title }, file = DEFAULT_FILE) {
  if (!deity) {
    const err = new Error('deity not found');
    err.status = 404;
    throw err;
  }
  const list = loadList(file);
  const now = new Date().toISOString();
  const checklist = {
    id: crypto.randomUUID(),
    userIdHash,
    deityId: deity.id,
    title: title || `${deity.name}祭拜清單`,
    items: buildItems(deity),
    createdAt: now,
  };
  list.push(checklist);
  saveList(list, file);
  return checklist;
}

function toggleItem(checklistId, itemId, checked, file = DEFAULT_FILE) {
  if (typeof checked !== 'boolean') {
    const err = new Error('checked must be boolean');
    err.status = 400;
    throw err;
  }
  const list = loadList(file);
  const checklist = list.find((c) => c.id === checklistId);
  if (!checklist) {
    const err = new Error('checklist not found');
    err.status = 404;
    throw err;
  }
  const item = checklist.items.find((it) => it.id === itemId);
  if (!item) {
    const err = new Error('item not found');
    err.status = 404;
    throw err;
  }
  item.checked = checked;
  saveList(list, file);
  return checklist;
}

module.exports = { loadList, saveList, buildItems, createChecklist, toggleItem, DEFAULT_FILE };
