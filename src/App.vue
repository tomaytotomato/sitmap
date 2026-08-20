<script setup>
import { computed, ref } from 'vue'
import MapView from './components/MapView.vue'
import Toolbar from './components/Toolbar.vue'
import MusicPlayer from './components/MusicPlayer.vue'
import { ui } from './store.js'

const mapView = ref(null)

const HINTS = {
  pan: 'drag to pan · scroll to zoom',
  territory: 'click to add points · click the ringed start point to close · double-click, right-click or Enter also finish · Esc cancels',
  shade: 'click a country to shade it · click again with the same faction to unshade',
  arrow: 'click a path for the arrow · double-click, right-click or Enter to finish · Esc cancels',
  unit: 'click the map to place the selected unit · drag to reposition · click a placed unit to select it',
  label: 'click the map to place a labelled point',
  erase: 'click a territory, arrow, shaded country, unit or label to remove it',
}

const SELECTED_UNIT_HINT = 'hold R and drag to rotate (or [ / ]) · scroll or - / = to scale · F flips · Delete removes · Esc deselects'

const hint = computed(() => (ui.selectedUnitId ? SELECTED_UNIT_HINT : HINTS[ui.tool]))
</script>

<template>
  <div class="app">
    <MapView ref="mapView" />
    <div class="crt-overlay"></div>
    <Toolbar
      @export="mapView.exportImage()"
      @save="mapView.saveScenario()"
      @load="(file) => mapView.loadScenario(file)"
      @clear="mapView.clearAll()"
    />
    <div class="hint-bar">{{ hint }}</div>
    <div class="credit">MAP: NATURAL EARTH · ICONS: SVG REPO / GAME-ICONS.NET (CC BY 3.0) / FONT AWESOME (CC BY 4.0)</div>
    <MusicPlayer />
  </div>
</template>
