<script setup>
import { computed, reactive, ref, watch, watchEffect } from 'vue'
import { ui } from '../store.js'
import { FACTION_COLOURS } from '../lib/mapstyle.js'
import { UNIT_KINDS, iconDataURL, unitAvailable } from '../lib/units.js'

const emit = defineEmits(['export', 'save', 'load', 'clear'])

const TOOLS = [
  { id: 'pan', label: 'PAN' },
  { id: 'territory', label: 'TERRITORY' },
  { id: 'shade', label: 'SHADE' },
  { id: 'arrow', label: 'ARROW' },
  { id: 'unit', label: 'UNIT' },
  { id: 'label', label: 'LABEL' },
  { id: 'erase', label: 'ERASE' },
]

const FACTIONS = [
  { id: 'red', label: 'PACT' },
  { id: 'blue', label: 'NATO' },
  { id: 'tan', label: 'ALLIED' },
]

const ERAS = [
  { id: 'modern', label: 'MODERN' },
  { id: 'coldwar', label: 'COLD WAR \'80s' },
]

const fileInput = ref(null)

function onFileChosen(e) {
  const file = e.target.files?.[0]
  if (file) emit('load', file)
  e.target.value = ''
}

const availableUnitKinds = computed(() => UNIT_KINDS.filter((kind) => unitAvailable(kind, ui.faction, ui.mapEra)))

// A unit kind picked under one faction or era (e.g. a Soviet hull under
// PACT, or the Osprey in modern mode) can become unavailable after
// switching either; fall back to a kind every faction/era can use rather
// than leave a hidden selection armed.
watch(() => ui.faction, (faction) => {
  if (!unitAvailable(ui.unitKind, faction, ui.mapEra)) ui.unitKind = 'infantry'
})
watch(() => ui.mapEra, (era) => {
  if (!unitAvailable(ui.unitKind, ui.faction, era)) ui.unitKind = 'infantry'
})

const iconSrcs = reactive({})
watchEffect(() => {
  const faction = ui.faction
  for (const kind of UNIT_KINDS) {
    const colour = kind === 'battle' ? '#ffffff' : FACTION_COLOURS[faction]
    iconDataURL(kind, colour, 22).then((src) => {
      if (ui.faction === faction) iconSrcs[kind] = src
    })
  }
})
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-title">SITMAP</div>

    <div class="toolbar-section">
      <div class="toolbar-heading">FACTION</div>
      <div class="faction-row">
        <button
          v-for="f in FACTIONS"
          :key="f.id"
          class="faction-chip"
          :class="{ active: ui.faction === f.id }"
          :style="{ '--chip': FACTION_COLOURS[f.id] }"
          @click="ui.faction = f.id"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <div class="toolbar-section">
      <div class="toolbar-heading">ERA</div>
      <button
        v-for="e in ERAS"
        :key="e.id"
        class="tool-button"
        :class="{ active: ui.mapEra === e.id }"
        @click="ui.mapEra = e.id"
      >
        {{ e.label }}
      </button>
    </div>

    <div class="toolbar-section">
      <div class="toolbar-heading">MAP</div>
      <button
        class="tool-button"
        :class="{ active: ui.showCountryLabels }"
        @click="ui.showCountryLabels = !ui.showCountryLabels"
      >
        COUNTRY NAMES
      </button>
      <button
        class="tool-button"
        :class="{ active: ui.showBases }"
        @click="ui.showBases = !ui.showBases"
      >
        STRATEGIC BASES
      </button>
    </div>

    <div class="toolbar-section">
      <div class="toolbar-heading">TOOLS</div>
      <button
        v-for="t in TOOLS"
        :key="t.id"
        class="tool-button"
        :class="{ active: ui.tool === t.id }"
        @click="ui.tool = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <div v-if="ui.tool === 'unit'" class="toolbar-section">
      <div class="toolbar-heading">UNIT TYPE</div>
      <div class="unit-grid">
        <button
          v-for="kind in availableUnitKinds"
          :key="kind"
          class="unit-button"
          :class="{ active: ui.unitKind === kind }"
          :title="kind"
          @click="ui.unitKind = kind"
        >
          <img v-if="iconSrcs[kind]" :src="iconSrcs[kind]" :alt="kind" width="22" height="22" />
        </button>
      </div>
    </div>

    <div class="toolbar-section toolbar-actions">
      <button class="tool-button" @click="emit('export')">EXPORT PNG</button>
      <button class="tool-button" @click="emit('save')">SAVE</button>
      <button class="tool-button" @click="fileInput.click()">LOAD</button>
      <button class="tool-button danger" @click="emit('clear')">CLEAR</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFileChosen" />
    </div>

    <a class="tool-button" href="https://github.com/tomaytotomato/sitmap" target="_blank" rel="noopener noreferrer">
      SOURCE ON GITHUB ↗
    </a>
  </div>
</template>
