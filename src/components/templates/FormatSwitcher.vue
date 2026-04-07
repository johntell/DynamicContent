<script setup>
import { ref } from 'vue';
import { useTemplateBuilderStore } from '../../stores/templateBuilder.js';

const store = useTemplateBuilderStore();

const emit = defineEmits(['select-format', 'delete-format']);

const menuOpen = ref(false);
const editingId = ref(null);
const editingLabel = ref('');
const renameInput = ref(null);

function toggleMenu() { menuOpen.value = !menuOpen.value; }
function closeMenu() { menuOpen.value = false; editingId.value = null; }

function selectFormat(id) {
  emit('select-format', id);
  closeMenu();
}

function startRename(id, label, e) {
  e.stopPropagation();
  editingId.value = id;
  editingLabel.value = label;
  setTimeout(() => renameInput.value?.select(), 20);
}

function commitRename() {
  if (editingId.value && editingLabel.value.trim()) {
    store.updateFormat(editingId.value, 'label', editingLabel.value.trim());
  }
  editingId.value = null;
}

function deleteFormat(id, e) {
  e.stopPropagation();
  emit('delete-format', id);
}

function onMenuBlur() {
  setTimeout(() => { if (!editingId.value) closeMenu(); }, 200);
}
</script>

<template>
  <div class="format-switcher" @focusout="onMenuBlur">
    <button class="fmt-btn" @click="toggleMenu">
      <span class="fmt-btn-label">Formats</span>
      <span class="fmt-btn-count">{{ store.formats.length }}</span>
      <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.75 5 6.25 7.5 3.75"/></svg>
    </button>

    <div v-if="menuOpen" class="fmt-menu" @click.stop>
      <div class="fmt-list">
        <div
          v-for="fmt in store.formats"
          :key="fmt.id"
          class="fmt-item"
          :class="{ active: fmt.id === store.activeSettingsId }"
        >
          <!-- Rename mode -->
          <template v-if="editingId === fmt.id">
            <input
              ref="renameInput"
              class="fmt-rename-input"
              v-model="editingLabel"
              @keydown.enter="commitRename"
              @keydown.escape="editingId = null"
              @blur="commitRename"
            >
          </template>
          <!-- Normal mode -->
          <template v-else>
            <button class="fmt-item-btn" @click="selectFormat(fmt.id)">
              <div class="fmt-item-info">
                <span class="fmt-item-name">{{ fmt.label }}</span>
                <span class="fmt-item-dims">{{ fmt.w }} &times; {{ fmt.h }}</span>
              </div>
            </button>
            <div class="fmt-item-actions">
              <button class="fmt-act" @click="startRename(fmt.id, fmt.label, $event)" title="Rename">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button
                v-if="store.formats.length > 1"
                class="fmt-act fmt-act-danger"
                @click="deleteFormat(fmt.id, $event)"
                title="Delete"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.format-switcher {
  position: relative;
}

.fmt-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 10px;
  background: var(--bg, #f1f5f9);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 7px;
  color: var(--text, #334155);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.fmt-btn:hover { background: var(--card-bg, #fff); border-color: #a5b4fc; }

.fmt-btn-label { color: #475569; }

.fmt-btn-count {
  display: inline-flex;
  align-items: center; justify-content: center;
  min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 8px;
  background: #cbd5e1; color: #475569;
  font-size: 10px; font-weight: 700;
  line-height: 1;
}

.chevron { opacity: 0.4; flex-shrink: 0; }

.fmt-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  max-height: 400px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04);
  padding: 4px;
  z-index: 100;
  animation: fmt-fade 0.1s ease;
}

@keyframes fmt-fade {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.fmt-list {
  max-height: 340px;
  overflow-y: auto;
}

.fmt-item {
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: background 0.1s;
}
.fmt-item:hover { background: rgba(99,102,241,0.06); }
.fmt-item.active { background: rgba(99,102,241,0.08); }

.fmt-item-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--text, #1f2937);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}

.fmt-item-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.fmt-item-name {
  font-size: 12.5px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fmt-item-dims {
  font-size: 10px;
  color: var(--text-muted, #94a3b8);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}

.fmt-item-actions {
  display: flex;
  align-items: center;
  gap: 1px;
  padding-right: 4px;
  opacity: 0;
  transition: opacity 0.12s;
}
.fmt-item:hover .fmt-item-actions { opacity: 1; }

.fmt-act {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--text-muted, #64748b);
  cursor: pointer; border-radius: 4px; padding: 0;
  transition: background 0.12s, color 0.12s;
}
.fmt-act:hover { background: var(--bg, #f1f5f9); color: var(--text, #1f2937); }
.fmt-act-danger:hover { background: #fef2f2; color: #ef4444; }

.fmt-rename-input {
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
</style>
