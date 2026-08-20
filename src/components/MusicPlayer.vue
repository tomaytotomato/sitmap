<script setup>
import { ref } from 'vue'
import trackUrl from '../assets/audio/wic-main-menu.mp3'

const audioEl = ref(null)
const playing = ref(false)

// Browsers block audio with sound until a real user gesture, so this can
// never autoplay on load — starting paused behind a button is the only
// approach that works consistently anyway.
function toggle() {
  if (playing.value) {
    audioEl.value.pause()
  } else {
    audioEl.value.play().catch(() => {})
  }
}
</script>

<template>
  <audio ref="audioEl" :src="trackUrl" :volume="0.5" loop @play="playing = true" @pause="playing = false" />
  <button
    class="music-toggle"
    :class="{ playing }"
    :title="playing ? 'Pause music' : 'Play music'"
    @click="toggle"
  >
    {{ playing ? '⏸' : '▶' }}
  </button>
</template>
