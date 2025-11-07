<script setup>
import { ref, watch } from 'vue'
import { useFactionStore } from '../stores/faction'

const factionStore = useFactionStore()

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  nodeId: {
    type: String,
    default: null
  },
  parentId: {
    type: String,
    default: null
  },
  mode: {
    type: String, // 'add' or 'edit'
    default: 'add'
  }
})

const emit = defineEmits(['close', 'save', 'delete'])

const nodeName = ref('')
const nodeRole = ref('')
const nodeDescription = ref('')

// Check if the node has children
const hasChildren = () => {
  if (!props.nodeId || !factionStore.pyramid) return false
  
  // Check if any node has this node as its manager
  return Object.entries(factionStore.pyramid).some(([id, node]) => {
    return id !== props.nodeId && node.manager === props.nodeId
  })
}

// Watch for prop changes to update form fields
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.mode === 'edit' && props.nodeId && factionStore.pyramid[props.nodeId]) {
      const currentData = factionStore.pyramid[props.nodeId]
      nodeName.value = currentData.name || ''
      nodeRole.value = currentData.role || ''
      nodeDescription.value = currentData.description || ''
    } else {
      // Reset form for add mode
      nodeName.value = ''
      nodeRole.value = ''
      nodeDescription.value = ''
    }
  }
})

const closeModal = () => {
  emit('close')
}

const saveNode = () => {
  if (!nodeName.value.trim()) {
    alert('Name is required')
    return
  }

  if (!factionStore.pyramid) {
    factionStore.pyramid = {}
  }

  if (props.mode === 'add') {
    // Generate a unique ID
    const newNodeId = `node_${Date.now()}`
    
    factionStore.pyramid[newNodeId] = {
      name: nodeName.value.trim(),
      manager: props.parentId || '',
      role: nodeRole.value.trim(),
      description: nodeDescription.value.trim()
    }
  } else if (props.mode === 'edit' && props.nodeId) {
    // Update existing node
    const currentData = factionStore.pyramid[props.nodeId]
    factionStore.pyramid[props.nodeId] = {
      ...currentData,
      name: nodeName.value.trim(),
      role: nodeRole.value.trim(),
      description: nodeDescription.value.trim()
    }
  }

  emit('save')
  closeModal()
}

const deleteNode = () => {
  if (!props.nodeId) return
  
  // Check if node has children
  if (hasChildren()) {
    alert('Cannot delete this node because it has child nodes underneath it. Please delete or reassign the child nodes first.')
    return
  }
  
  // Confirm deletion
  if (!confirm(`Are you sure you want to delete "${nodeName.value}"?`)) {
    return
  }
  
  // Delete the node from datamodel
  if (factionStore.pyramid && factionStore.pyramid[props.nodeId]) {
    delete factionStore.pyramid[props.nodeId]
  }
  
  emit('delete')
  closeModal()
}
</script>

<template>
<div 
  v-if="isOpen"
  tabindex="-1" 
  class="flex overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 h-modal md:h-full bg-gray-900 bg-opacity-50"
  @click.self="closeModal"
>
    <div class="relative p-4 w-full max-w-2xl h-full md:h-auto">
        <!-- Modal content -->
        <div class="relative p-4 bg-white rounded-lg shadow dark:bg-gray-800 sm:p-5">
            <!-- Modal header -->
            <div class="flex justify-between items-center pb-4 mb-4 rounded-t border-b sm:mb-5 dark:border-gray-600">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ mode === 'add' ? 'Add Organization Node' : 'Update Organization Node' }}
                </h3>
                <button 
                  type="button" 
                  @click="closeModal"
                  class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white"
                >
                    <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                    <span class="sr-only">Close modal</span>
                </button>
            </div>
            <!-- Modal body -->
            <form @submit.prevent="saveNode">
                <div class="grid gap-4 mb-4 sm:grid-cols-1">
                    <div>
                        <label for="name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Name *</label>
                        <input 
                          v-model="nodeName"
                          type="text" 
                          name="name" 
                          id="name" 
                          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500" 
                          placeholder="Enter name"
                          required
                        >
                    </div>
                    <div>
                        <label for="role" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Role</label>
                        <input 
                          v-model="nodeRole"
                          type="text" 
                          name="role" 
                          id="role" 
                          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500" 
                          placeholder="Enter role (optional)"
                        >
                    </div>
                    <div>
                        <label for="description" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Description</label>
                        <textarea 
                          v-model="nodeDescription"
                          id="description" 
                          rows="3" 
                          class="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500" 
                          placeholder="Enter description (optional)"
                        ></textarea>                    
                    </div>
                </div>
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <button 
                          type="submit" 
                          class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                        >
                            Save
                        </button>
                        <button 
                          type="button"
                          @click="closeModal"
                          class="text-gray-900 bg-white border border-gray-300 hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-gray-600 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-700 dark:focus:ring-gray-700"
                        >
                            Cancel
                        </button>
                    </div>
                    <button 
                      v-if="mode === 'edit'"
                      type="button"
                      @click="deleteNode"
                      class="text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-800"
                    >
                        Delete
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
</template>
