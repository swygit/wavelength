<template>
  <teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="$emit('cancel')"
    >
      <div class="w-full max-w-lg card border border-brand-500/40">
        <p class="text-xs uppercase tracking-wide text-brand-300">External Link</p>
        <h2 class="text-lg font-bold mt-1">This may take you outside Wavelength!</h2>
        <p class="text-sm text-gray-300 mt-3 leading-relaxed">
          You're about to open <span class="font-semibold text-white break-all">{{ url }}</span> in a new tab.
        </p>
        <div class="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2">
          <button class="btn-secondary text-sm w-full sm:w-auto" @click="$emit('cancel')">Not now</button>
          <button class="btn-primary text-sm w-full sm:w-auto" @click="$emit('confirm')">Continue</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  url: { type: String, default: '' },
})

defineEmits(['cancel', 'confirm'])
</script>