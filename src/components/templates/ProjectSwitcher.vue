<script setup>
import { ref, nextTick } from 'vue';
import { useProjectManagerStore } from '../../stores/projectManager.js';

const pm = useProjectManagerStore();

const emit = defineEmits(['switch-project', 'delete-project']);

const menuOpen = ref(false);
const editingId = ref(null);
const editingName = ref('');
const renameInput = ref(null);

function toggleMenu() { menuOpen.value = !menuOpen.value; }
function closeMenu() { menuOpen.value = false; editingId.value = null; }

function switchTo(id) {
  if (id === pm.activeProjectId) { closeMenu(); return; }
  emit('switch-project', id);
  closeMenu();
}

function startRename(id, name) {
  editingId.value = id;
  editingName.value = name;
  nextTick(() => renameInput.value?.select());
}

function commitRename() {
  if (editingId.value && editingName.value.trim()) {
    pm.renameProject(editingId.value, editingName.value.trim());
  }
  editingId.value = null;
}

function createNew() {
  const id = pm.createProject('Untitled Project');
  emit('switch-project', id);
  closeMenu();
  // Open rename immediately after a tick
  nextTick(() => {
    menuOpen.value = true;
    nextTick(() => startRename(id, 'Untitled Project'));
  });
}

function duplicate(id) {
  const newId = pm.duplicateProject(id);
  if (newId) {
    emit('switch-project', newId);
    closeMenu();
  }
}

function deleteProject(id) {
  if (pm.projectOrder.length <= 1) return;
  emit('delete-project', id);
  closeMenu();
}

function onMenuBlur() {
  setTimeout(() => { if (!editingId.value) closeMenu(); }, 200);
}
</script>

<template>
  <div class="project-switcher" @focusout="onMenuBlur">
    <button class="project-btn" @click="toggleMenu" :title="pm.activeProject?.name || 'Project'">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
      </svg>
      <span class="project-name">{{ pm.activeProject?.name || 'Project' }}</span>
      <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.75 5 6.25 7.5 3.75"/></svg>
    </button>

    <div v-if="menuOpen" class="project-menu" @click.stop>
      <div class="pm-list">
        <div
          v-for="proj in pm.projectList"
          :key="proj.id"
          class="pm-item"
          :class="{ active: proj.id === pm.activeProjectId }"
        >
          <!-- Rename mode -->
          <template v-if="editingId === proj.id">
            <input
              ref="renameInput"
              class="pm-rename-input"
              v-model="editingName"
              @keydown.enter="commitRename"
              @keydown.escape="editingId = null"
              @blur="commitRename"
            >
          </template>
          <!-- Normal mode -->
          <template v-else>
            <button class="pm-item-btn" @click="switchTo(proj.id)">
              <span class="pm-item-dot" :class="{ on: proj.id === pm.activeProjectId }"></span>
              <span class="pm-item-name">{{ proj.name }}</span>
            </button>
            <div class="pm-item-actions">
              <button class="pm-act" @click.stop="startRename(proj.id, proj.name)" title="Rename">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="pm-act" @click.stop="duplicate(proj.id)" title="Duplicate">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
              <button
                v-if="pm.projectOrder.length > 1"
                class="pm-act pm-act-danger"
                @click.stop="deleteProject(proj.id)"
                title="Delete"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </template>
        </div>
      </div>
      <div class="pm-divider"></div>
      <button class="pm-new" @click="createNew">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 1v10M1 6h10"/></svg>
        New Project
      </button>
    </div>
  </div>
</template>

<style scoped>
.project-switcher {
  position: relative;
}

.project-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 8px;
  background: var(--bg, #f1f5f9);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 7px;
  color: var(--text, #334155);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
  max-width: 200px;
  white-space: nowrap;
}
.project-btn:hover { background: var(--card-bg, #fff); border-color: #a5b4fc; }
.project-btn svg:first-child { opacity: 0.5; flex-shrink: 0; }

.project-name {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.chevron { opacity: 0.4; flex-shrink: 0; transition: transform 0.15s; }

.project-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  max-height: 360px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04);
  padding: 4px;
  z-index: 100;
  animation: pm-fade 0.1s ease;
}

@keyframes pm-fade {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.pm-list {
  max-height: 280px;
  overflow-y: auto;
}

.pm-item {
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: background 0.1s;
}
.pm-item:hover { background: rgba(99,102,241,0.06); }
.pm-item.active { background: rgba(99,102,241,0.08); }

.pm-item-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  background: transparent;
  color: var(--text, #1f2937);
  font-size: 12.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}

.pm-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pm-item-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #cbd5e1;
  flex-shrink: 0;
  transition: background 0.15s;
}
.pm-item-dot.on { background: #6366f1; }

.pm-item-actions {
  display: flex;
  align-items: center;
  gap: 1px;
  padding-right: 4px;
  opacity: 0;
  transition: opacity 0.12s;
}
.pm-item:hover .pm-item-actions { opacity: 1; }

.pm-act {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--text-muted, #64748b);
  cursor: pointer; border-radius: 4px; padding: 0;
  transition: background 0.12s, color 0.12s;
}
.pm-act:hover { background: var(--bg, #f1f5f9); color: var(--text, #1f2937); }
.pm-act-danger:hover { background: #fef2f2; color: #ef4444; }

.pm-rename-input {
  flex: 1;
  margin: 4px 8px;
  padding: 4px 8px;
  font-size: 12.5px;
  font-weight: 500;
  font-family: inherit;
  border: 1.5px solid #6366f1;
  border-radius: 5px;
  background: var(--card-bg, #fff);
  color: var(--text, #1f2937);
  outline: none;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
}

.pm-divider {
  height: 1px;
  background: var(--border, #e5e7eb);
  margin: 3px 6px;
}

.pm-new {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6366f1;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.1s;
}
.pm-new:hover { background: rgba(99,102,241,0.08); }
</style>
