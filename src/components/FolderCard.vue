<template>
  <div
    class="card hover:border-brand-500 transition-colors group cursor-pointer relative"
    :class="{
      'border-brand-400 bg-gray-800/50': isDragOverGig,
      'border-l-4 border-l-brand-400': folderDropSide === 'left',
      'border-r-4 border-r-brand-400': folderDropSide === 'right',
    }"
    draggable="true"
    @dragstart="handleFolderDragStart"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @click="$emit('open', folder.id)"
  >
    <div class="flex items-start justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="text-xl">📁</span>
        <h2 v-if="!editing" class="font-semibold group-hover:text-brand-400 transition-colors">{{ folder.name }}</h2>
        <input
          v-else
          ref="nameInput"
          v-model="editName"
          class="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none focus:border-brand-500"
          @keydown.enter="saveRename"
          @keydown.escape="cancelRename"
          @blur="saveRename"
          @click.stop
        />
      </div>
      <div class="flex items-center gap-1" @click.stop>
        <button
          class="text-gray-500 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          title="Rename folder"
          @click="startRename"
        >
          ✏️
        </button>
        <button
          class="text-gray-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          title="Delete folder"
          @click="$emit('delete', folder.id)"
        >
          🗑️
        </button>
      </div>
    </div>
    <p class="text-xs text-gray-500">{{ gigCount }} gig{{ gigCount === 1 ? '' : 's' }}</p>
    <div v-if="isDragOverGig" class="absolute inset-0 border-2 border-dashed border-brand-400 rounded-xl pointer-events-none"></div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  folder: { type: Object, required: true },
  gigCount: { type: Number, default: 0 },
})

const emit = defineEmits(['open', 'delete', 'rename', 'drop-gig', 'reorder'])

const isDragOverGig = ref(false)
const folderDropSide = ref(null)
const editing = ref(false)
const editName = ref('')
const nameInput = ref(null)

function handleFolderDragStart(event) {
  event.dataTransfer.setData('text/folder-id', props.folder.id)
  event.dataTransfer.effectAllowed = 'move'
}

function handleDragOver(event) {
  const types = event.dataTransfer.types
  if (types.includes('text/folder-id')) {
    // Folder reorder – show left/right indicator based on mouse position
    const rect = event.currentTarget.getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    folderDropSide.value = event.clientX < midX ? 'left' : 'right'
    isDragOverGig.value = false
  } else {
    // Gig drop
    isDragOverGig.value = true
    folderDropSide.value = null
  }
}

function handleDragLeave() {
  isDragOverGig.value = false
  folderDropSide.value = null
}

function handleDrop(event) {
  isDragOverGig.value = false
  folderDropSide.value = null

  const folderId = event.dataTransfer.getData('text/folder-id')
  if (folderId) {
    // Folder reorder
    const rect = event.currentTarget.getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    const side = event.clientX < midX ? 'before' : 'after'
    if (folderId !== props.folder.id) {
      emit('reorder', folderId, props.folder.id, side)
    }
    return
  }

  const gigId = event.dataTransfer.getData('text/gig-id')
  if (gigId) {
    emit('drop-gig', props.folder.id, gigId)
  }
}

function startRename() {
  editName.value = props.folder.name
  editing.value = true
  nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

function saveRename() {
  if (!editing.value) return
  const trimmed = editName.value.trim()
  if (trimmed && trimmed !== props.folder.name) {
    emit('rename', props.folder.id, trimmed)
  }
  editing.value = false
}

function cancelRename() {
  editing.value = false
}
</script>
