<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const SETTINGS_STORAGE_KEY = 'faction-settings'
const geminiApiKey = ref('')

// Load settings from localStorage
function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      const settings = JSON.parse(stored)
      geminiApiKey.value = settings.geminiApiKey || ''
    }
  } catch (err) {
    console.error('Error loading settings from localStorage:', err)
  }
}

// Save settings to localStorage
function saveSettings() {
  try {
    const settings = {
      geminiApiKey: geminiApiKey.value.trim()
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (err) {
    console.error('Error saving settings to localStorage:', err)
  }
}

// Watch for popup open/close to load settings
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadSettings()
  }
})

const closeModal = () => {
  emit('close')
}

const saveSettingsAndClose = () => {
  saveSettings()
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
                    Settings
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
            <form @submit.prevent="saveSettingsAndClose">
                <div class="grid gap-4 mb-4 sm:grid-cols-1">
                    <div>
                        <label for="geminiApiKey" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Gemini API Key</label>
                        <input 
                          v-model="geminiApiKey"
                          type="text" 
                          name="geminiApiKey" 
                          id="geminiApiKey" 
                          class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500" 
                          placeholder="Enter your Gemini API key"
                        >
                        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-blue-600 hover:underline dark:text-blue-500">Google AI Studio</a>
                        </p>
                    </div>
                </div>
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
            </form>
        </div>
    </div>
</div>
</template>
