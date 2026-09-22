'use strict';
function renderWorshipGuide(target, deity, draft, sourceNotes = []) {
  const details = document.createElement('details');
  details.className = 'strategy'; details.open = true;
  const summary = document.createElement('summary'); summary.textContent = `${deity.name}祭拜攻略`;
  const body = document.createElement('div'); body.className = 'strategy-body';
  const list = document.createElement('ul'); list.className = 'checklist';
  const checks = (draft.offerings || []).map(item => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const check = document.createElement('input'); check.type = 'checkbox';
    label.append(check, document.createTextNode(item.label));
    const link = document.createElement('a'); link.className = 'text-link'; link.textContent = ' 找店家';
    link.href = '/miniapp/map.html?offering=' + encodeURIComponent(item.label);
    li.append(label, link); list.append(li); return check;
  });
  const steps = document.createElement('ol'); steps.className = 'strategy-steps';
  (draft.guide || []).forEach(step => { const li = document.createElement('li'); li.textContent = step.label; steps.append(li); });
  const save = document.createElement('button'); save.className = 'btn'; save.textContent = '儲存供品清單';
  const status = document.createElement('p'); status.className = 'meta'; status.setAttribute('role', 'status');
  let saved;
  save.onclick = async () => {
    save.disabled = true;
    try {
      saved = await apiPost('/api/checklists', { deityId: deity.id, userIdHash: MiniApp.uid() });
      for (let i = 0; i < checks.length; i++) if (checks[i].checked) await apiPatch(`/api/checklists/${saved.id}/items/${saved.items[i].id}`, { checked: true });
      localStorage.setItem('gg-checklist-' + deity.id, saved.id);
      status.textContent = '已儲存，後續勾選會同步。'; save.hidden = true;
    } catch { status.textContent = '儲存失敗，請重試。'; save.disabled = false; }
  };
  checks.forEach((check, i) => { check.onchange = async () => {
    if (!saved) return;
    check.disabled = true;
    try { await apiPatch(`/api/checklists/${saved.id}/items/${saved.items[i].id}`, { checked: check.checked }); }
    catch { check.checked = !check.checked; status.textContent = '同步失敗，請重試。'; }
    finally { check.disabled = false; }
  }; });
  const source = document.createElement('p'); source.className = 'meta'; source.textContent = '出處：' + sourceNotes.join('；');
  const nearby = document.createElement('a'); nearby.className = 'btn secondary'; nearby.textContent = '找供奉此神明的宮廟';
  nearby.href = '/miniapp/map.html?deity=' + encodeURIComponent(deity.id);
  body.append(list, save, status, steps, nearby, source); details.append(summary, body); target.append(details);
  return details;
}
