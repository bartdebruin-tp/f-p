import { ref } from 'vue'
import { GoogleGenAI } from '@google/genai'

const SETTINGS_STORAGE_KEY = 'faction-settings'
const FALLBACK_API_KEY = 'AIzaSyC31c-JvsbjNTMuZFltn1svp5NJZkaVphk'

function getApiKey() {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      const settings = JSON.parse(stored)
      return settings.geminiApiKey || FALLBACK_API_KEY
    }
  } catch (err) {
    console.error('Error loading API key from localStorage:', err)
  }
  return FALLBACK_API_KEY
}

const isGenerating = ref(false)

export async function generateWithAi(prompt) {
  try {
    isGenerating.value = true
    const apiKey = getApiKey()
    const ai = new GoogleGenAI({ apiKey })
    console.log('AI Prompt:', prompt)
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: prompt,
    })
    return response.text
  } catch (error) {
    console.error('Error generating with AI:', error)
    throw error
  } finally {
    isGenerating.value = false
  }
}

export { isGenerating }
