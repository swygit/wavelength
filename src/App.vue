<template>
  <div class="app-fit-root">
    <div class="app-fit-shell" :style="shellStyle">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" :key="$route.fullPath" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterView } from 'vue-router'

const PHONE_CANVAS_WIDTH = 980
const TABLET_CANVAS_WIDTH = 1120
const scale = ref(1)
const canvasWidth = ref(PHONE_CANVAS_WIDTH)

function updateScale() {
  const vw = window.innerWidth || PHONE_CANVAS_WIDTH

  // Desktop and large tablets: render at native scale.
  if (vw >= TABLET_CANVAS_WIDTH) {
    canvasWidth.value = TABLET_CANVAS_WIDTH
    scale.value = 1
    return
  }

  // Tablet portrait: preserve desktop composition with gentler scaling.
  if (vw >= 700) {
    canvasWidth.value = TABLET_CANVAS_WIDTH
    scale.value = Math.max(0.68, Math.min(1, vw / TABLET_CANVAS_WIDTH))
    return
  }

  // Phones: stronger scale-down to keep desktop-like layout fitting in 9:16 viewports.
  canvasWidth.value = PHONE_CANVAS_WIDTH
  scale.value = Math.max(0.42, Math.min(1, vw / PHONE_CANVAS_WIDTH))
}

onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScale)
})

const shellStyle = computed(() => {
  if (scale.value >= 1) return {}
  return {
    width: `${canvasWidth.value}px`,
    transform: `scale(${scale.value})`,
    transformOrigin: 'top center',
    minHeight: `calc(100dvh / ${scale.value})`,
  }
})
</script>

<style>
.app-fit-root {
  width: 100%;
  display: flex;
  justify-content: center;
  overflow-x: hidden;
}

.app-fit-shell {
  width: 100%;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.18s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
