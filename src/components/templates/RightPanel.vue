<script setup>
import FormatPropertiesPanel from './FormatPropertiesPanel.vue';
import GlobalStylesPanel from './GlobalStylesPanel.vue';

defineProps({
  format: { type: [Object, null], default: null },
  canDelete: { type: Boolean, default: true },
  sourceType: { type: String, default: 'image' },
});

defineEmits(['close', 'delete', 'export']);
</script>

<template>
  <div class="right-panel">
    <!-- Format properties (full panel) — replaces design when a format is selected -->
    <template v-if="format">
      <FormatPropertiesPanel
        :format="format"
        :can-delete="canDelete"
        :source-type="sourceType"
        @close="$emit('close')"
        @delete="$emit('delete', $event)"
        @export="$emit('export')"
      />
    </template>

    <!-- Global styles — shown when no format is selected -->
    <template v-else>
      <div class="rp-header">
        <span class="rp-header-title">Design</span>
      </div>
      <div class="rp-styles-section">
        <GlobalStylesPanel />
      </div>
    </template>
  </div>
</template>

<style scoped>
.right-panel {
  width: 290px;
  flex-shrink: 0;
  overflow-y: auto;
  border-left: 1px solid var(--border);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  z-index: 25;
}

/* Remove FormatPropertiesPanel's own border-left + width since wrapper handles it */
.right-panel :deep(.props-panel) {
  border-left: none;
  width: 100%;
}

/* Header when no format selected — same height as toolbar row */
.rp-header {
  flex-shrink: 0;
  padding: 0 16px;
  height: 45px;
  border-bottom: 1px solid var(--border);
  background: var(--card-bg);
  display: flex;
  align-items: center;
}
.rp-header-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

/* Match FormatPropertiesPanel header to same height */
.right-panel :deep(.props-header) {
  padding: 0 14px;
  height: 45px;
  box-sizing: border-box;
}

/* Styles section fills remaining space */
.rp-styles-section {
  flex: 1;
  overflow-y: auto;
  background: var(--card-bg);
}
</style>
