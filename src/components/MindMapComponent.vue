<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useFactionStore } from '../stores/faction'
import UpdateOrganizationNodePopupComponent from './UpdateOrganizationNodePopupComponent.vue'

const factionStore = useFactionStore()

const canvasRef = ref(null)
const ctx = ref(null)
const canvasContainer = ref(null)

// State management
const nodes = reactive([])
const connections = reactive([])
const selectedNode = ref(null)
const draggingNode = ref(null)
const dragOffset = reactive({ x: 0, y: 0 })
const hoveredNode = ref(null)
const canvasSize = reactive({ width: 0, height: 0 })
const editingNode = ref(null)
const editText = ref('')
const inlineInput = ref(null)

// Modal state
const isModalOpen = ref(false)
const modalMode = ref('add') // 'add' or 'edit'
const currentNodeId = ref(null)
const currentParentId = ref(null)

// Mouse state
const mousePos = reactive({ x: 0, y: 0 })

// Pan/scroll state
const isPanning = ref(false)
const panOffset = reactive({ x: 0, y: 0 })
const panStart = reactive({ x: 0, y: 0 })

// Tooltip state
const tooltipVisible = ref(false)
const tooltipContent = reactive({ name: '', role: '', description: '' })
const tooltipPos = reactive({ x: 0, y: 0 })
let tooltipTimeout = null

let nextNodeId = 1
let isLoadingFromDatamodel = false

onMounted(() => {
  if (canvasRef.value && canvasContainer.value) {
    ctx.value = canvasRef.value.getContext('2d')
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    
    // Load nodes from datamodel
    loadFromDatamodel()
  }
  window.addEventListener('keydown', handleKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('keydown', handleKeyDown)
})

// Load nodes from datamodel.pyramid
const loadFromDatamodel = () => {
  isLoadingFromDatamodel = true
  nodes.splice(0, nodes.length)
  connections.splice(0, connections.length)
  
  const pyramidData = factionStore.pyramid
  
  if (!pyramidData || Object.keys(pyramidData).length === 0) {
    // Add initial root node if no data
    addNode(canvasSize.width / 2, canvasSize.height / 2, 'Root Node', true)
    isLoadingFromDatamodel = false
    return
  }
  
  // Find root nodes (nodes without a manager)
  const nodeMap = new Map()
  const childrenMap = new Map()
  
  // First pass: create all nodes and build relationships
  for (const [nodeId, nodeData] of Object.entries(pyramidData)) {
    nodeMap.set(nodeId, {
      id: nodeId,
      text: nodeData.name || nodeId,
      manager: nodeData.manager || null,
      isRoot: !nodeData.manager
    })
    
    if (!childrenMap.has(nodeId)) {
      childrenMap.set(nodeId, [])
    }
    
    if (nodeData.manager) {
      if (!childrenMap.has(nodeData.manager)) {
        childrenMap.set(nodeData.manager, [])
      }
      childrenMap.get(nodeData.manager).push(nodeId)
    }
  }
  
  // Find root nodes
  const rootNodes = Array.from(nodeMap.values()).filter(n => n.isRoot)
  
  if (rootNodes.length === 0 && nodeMap.size > 0) {
    // If no root found, make first node the root
    const firstNode = Array.from(nodeMap.values())[0]
    firstNode.isRoot = true
    rootNodes.push(firstNode)
  }
  
  // Check if we have saved positions in the datamodel
  const hasSavedPositions = Object.values(pyramidData).some(
    nodeData => nodeData.x !== undefined && nodeData.y !== undefined
  )
  
  let positions
  if (hasSavedPositions) {
    // Use saved positions from datamodel
    positions = new Map()
    for (const [nodeId, nodeData] of Object.entries(pyramidData)) {
      if (nodeData.x !== undefined && nodeData.y !== undefined) {
        positions.set(nodeId, { x: nodeData.x, y: nodeData.y })
      }
    }
  } else {
    // Calculate hierarchical layout if no saved positions
    positions = calculateHierarchicalLayout(rootNodes, nodeMap, childrenMap)
  }
  
  // Create nodes with positions
  for (const [nodeId, pos] of positions.entries()) {
    const nodeInfo = nodeMap.get(nodeId)
    const node = {
      id: nodeId,
      x: pos.x,
      y: pos.y,
      width: 140,
      height: 60,
      text: nodeInfo.text,
      isRoot: nodeInfo.isRoot,
      color: nodeInfo.isRoot ? '#2563eb' : '#3b82f6'
    }
    nodes.push(node)
  }
  
  // Create connections based on manager relationships
  for (const [nodeId, nodeData] of Object.entries(pyramidData)) {
    if (nodeData.manager) {
      connections.push({ from: nodeData.manager, to: nodeId })
    }
  }
  
  // Update nextNodeId
  const existingIds = Array.from(nodeMap.keys())
  const numericIds = existingIds
    .filter(id => /^node-\d+$/.test(id))
    .map(id => parseInt(id.replace('node-', '')))
  
  if (numericIds.length > 0) {
    nextNodeId = Math.max(...numericIds) + 1
  }
  
  isLoadingFromDatamodel = false
  draw()
}

// Calculate hierarchical tree layout
const calculateHierarchicalLayout = (rootNodes, nodeMap, childrenMap) => {
  const positions = new Map()
  const levelGap = 150
  const nodeGap = 180
  
  let currentY = 100
  
  rootNodes.forEach((rootNode, rootIndex) => {
    const levels = []
    
    // Build level structure using BFS
    const queue = [{ id: rootNode.id, level: 0 }]
    const visited = new Set()
    
    while (queue.length > 0) {
      const { id, level } = queue.shift()
      
      if (visited.has(id)) continue
      visited.add(id)
      
      if (!levels[level]) {
        levels[level] = []
      }
      levels[level].push(id)
      
      const children = childrenMap.get(id) || []
      children.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: level + 1 })
        }
      })
    }
    
    // Calculate positions for each level
    const treeWidth = Math.max(...levels.map(level => level.length)) * nodeGap
    const startX = (canvasSize.width - treeWidth) / 2
    
    levels.forEach((levelNodes, levelIndex) => {
      const y = currentY + levelIndex * levelGap
      const levelWidth = levelNodes.length * nodeGap
      const levelStartX = startX + (treeWidth - levelWidth) / 2
      
      levelNodes.forEach((nodeId, nodeIndex) => {
        const x = levelStartX + nodeIndex * nodeGap + nodeGap / 2
        positions.set(nodeId, { x, y })
      })
    })
    
    // Offset for next root tree
    currentY += levels.length * levelGap + 100
  })
  
  return positions
}

// Sync nodes back to datamodel
const syncToDatamodel = () => {
  if (isLoadingFromDatamodel) return
  
  if (!factionStore.pyramid) {
    factionStore.pyramid = {}
  }
  
  // Clear existing pyramid data
  const newPyramid = {}
  
  // Add all current nodes
  nodes.forEach(node => {
    // Find manager (parent) by checking connections
    const parentConnection = connections.find(c => c.to === node.id)
    const manager = parentConnection ? parentConnection.from : null
    
    // Preserve existing data from store if it exists
    const existingData = factionStore.pyramid[node.id] || {}
    
    newPyramid[node.id] = {
      name: node.text,
      manager: manager || '',
      role: existingData.role || '',
      description: existingData.description || '',
      x: node.x,
      y: node.y
    }
  })
  
  // Update datamodel
  factionStore.pyramid = newPyramid
}

// Watch for changes in datamodel.pyramid from outside
watch(() => factionStore.pyramid, () => {
  if (!isLoadingFromDatamodel) {
    loadFromDatamodel()
  }
}, { deep: true })


const resizeCanvas = () => {
  if (canvasRef.value && canvasContainer.value) {
    canvasSize.width = canvasContainer.value.clientWidth
    canvasSize.height = canvasContainer.value.clientHeight
    canvasRef.value.width = canvasSize.width
    canvasRef.value.height = canvasSize.height
    draw()
  }
}

const addNode = (x, y, text = 'New Node', isRoot = false) => {
  const nodeId = `node-${nextNodeId++}`
  const node = {
    id: nodeId,
    x,
    y,
    width: 140,
    height: 60,
    text,
    isRoot,
    color: isRoot ? '#2563eb' : '#3b82f6'
  }
  nodes.push(node)
  syncToDatamodel()
  draw()
  return node
}

const addConnection = (fromId, toId) => {
  // Check if connection already exists
  const exists = connections.some(
    c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
  )
  if (!exists && fromId !== toId) {
    connections.push({ from: fromId, to: toId })
    syncToDatamodel()
    draw()
  }
}

const getNodeAtPosition = (x, y) => {
  // Adjust for pan offset
  const adjustedX = x - panOffset.x
  const adjustedY = y - panOffset.y
  
  // Check from last to first (top to bottom in rendering)
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (
      adjustedX >= node.x - node.width / 2 &&
      adjustedX <= node.x + node.width / 2 &&
      adjustedY >= node.y - node.height / 2 &&
      adjustedY <= node.y + node.height / 2
    ) {
      return node
    }
  }
  return null
}

const handleCanvasMouseDown = (e) => {
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  // Middle mouse button for panning
  if (e.button === 1) {
    e.preventDefault()
    isPanning.value = true
    panStart.x = x - panOffset.x
    panStart.y = y - panOffset.y
    return
  }
  
  const node = getNodeAtPosition(x, y)
  
  if (e.shiftKey && node) {
    // Shift + click to open edit popup
    openEditModal(node.id)
  } else if (node) {
    // Start dragging
    draggingNode.value = node
    selectedNode.value = node
    dragOffset.x = x - panOffset.x - node.x
    dragOffset.y = y - panOffset.y - node.y
  } else {
    // Deselect
    selectedNode.value = null
  }
  
  draw()
}

const handleCanvasMouseMove = (e) => {
  const rect = canvasRef.value.getBoundingClientRect()
  mousePos.x = e.clientX - rect.left
  mousePos.y = e.clientY - rect.top
  
  if (isPanning.value) {
    panOffset.x = mousePos.x - panStart.x
    panOffset.y = mousePos.y - panStart.y
    hideTooltip()
    draw()
  } else if (draggingNode.value) {
    draggingNode.value.x = mousePos.x - panOffset.x - dragOffset.x
    draggingNode.value.y = mousePos.y - panOffset.y - dragOffset.y
    hideTooltip()
    draw()
  } else {
    // Update hovered node for cursor feedback
    const node = getNodeAtPosition(mousePos.x, mousePos.y)
    const prevHovered = hoveredNode.value
    hoveredNode.value = node
    
    // Handle tooltip
    if (node && node !== prevHovered) {
      showTooltip(node, e.clientX, e.clientY)
    } else if (!node) {
      hideTooltip()
    }
  }
}

const handleCanvasMouseUp = () => {
  if (draggingNode.value) {
    // Save position after dragging
    syncToDatamodel()
  }
  draggingNode.value = null
  isPanning.value = false
}

const handleCanvasMouseLeave = () => {
  hideTooltip()
}

const handleCanvasDoubleClick = (e) => {
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const node = getNodeAtPosition(x, y)
  
  if (node) {
    // Start editing the node
    startEditingNode(node)
  } else {
    // Create new node at click position (accounting for pan offset)
    addNode(x - panOffset.x, y - panOffset.y)
  }
}

const startEditingNode = (node) => {
  editingNode.value = node
  editText.value = node.text
  selectedNode.value = node
  
  // Focus the input on next tick
  setTimeout(() => {
    if (inlineInput.value) {
      inlineInput.value.focus()
      inlineInput.value.select()
    }
  }, 10)
}

const finishEditingNode = () => {
  if (editingNode.value && editText.value.trim()) {
    editingNode.value.text = editText.value.trim()
    syncToDatamodel()
    draw()
  }
  editingNode.value = null
  editText.value = ''
}

const cancelEditingNode = () => {
  editingNode.value = null
  editText.value = ''
}

const draw = () => {
  if (!ctx.value || !canvasRef.value) return
  
  const canvas = canvasRef.value
  ctx.value.clearRect(0, 0, canvas.width, canvas.height)
  
  // Save context and apply pan offset
  ctx.value.save()
  ctx.value.translate(panOffset.x, panOffset.y)
  
  // Draw connections
  ctx.value.strokeStyle = '#64748b'
  ctx.value.lineWidth = 2
  
  connections.forEach(conn => {
    const fromNode = nodes.find(n => n.id === conn.from)
    const toNode = nodes.find(n => n.id === conn.to)
    
    if (fromNode && toNode) {
      ctx.value.beginPath()
      ctx.value.moveTo(fromNode.x, fromNode.y)
      ctx.value.lineTo(toNode.x, toNode.y)
      ctx.value.stroke()
    }
  })
  
  // Draw nodes
  nodes.forEach(node => {
    const isSelected = selectedNode.value?.id === node.id
    const isHovered = hoveredNode.value?.id === node.id
    
    // Shadow for depth
    if (isSelected || isHovered) {
      ctx.value.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.value.shadowBlur = 10
      ctx.value.shadowOffsetX = 0
      ctx.value.shadowOffsetY = 4
    }
    
    // Draw node rectangle with rounded corners
    const x = node.x - node.width / 2
    const y = node.y - node.height / 2
    const radius = 8
    
    ctx.value.fillStyle = isSelected ? '#2563eb' : node.color
    ctx.value.beginPath()
    ctx.value.roundRect(x, y, node.width, node.height, radius)
    ctx.value.fill()
    
    // Border
    if (isSelected) {
      ctx.value.strokeStyle = '#1d4ed8'
      ctx.value.lineWidth = 2
    } else {
      ctx.value.strokeStyle = '#1e293b'
      ctx.value.lineWidth = 1
    }
    ctx.value.stroke()
    
    // Reset shadow
    ctx.value.shadowColor = 'transparent'
    ctx.value.shadowBlur = 0
    ctx.value.shadowOffsetX = 0
    ctx.value.shadowOffsetY = 0
    
    // Draw text
    ctx.value.fillStyle = '#ffffff'
    ctx.value.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.value.textAlign = 'center'
    ctx.value.textBaseline = 'middle'
    
    // Word wrap text
    const words = node.text.split(' ')
    const lines = []
    let currentLine = words[0]
    
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i]
      const metrics = ctx.value.measureText(testLine)
      if (metrics.width > node.width - 20) {
        lines.push(currentLine)
        currentLine = words[i]
      } else {
        currentLine = testLine
      }
    }
    lines.push(currentLine)
    
    const lineHeight = 18
    const startY = node.y - ((lines.length - 1) * lineHeight) / 2
    
    lines.forEach((line, i) => {
      ctx.value.fillText(line, node.x, startY + i * lineHeight)
    })
  })
  
  // Restore context
  ctx.value.restore()
}

const createChildNode = () => {
  if (selectedNode.value) {
    const parent = selectedNode.value
    const angle = Math.random() * Math.PI * 2
    const distance = 150
    const x = parent.x + Math.cos(angle) * distance
    const y = parent.y + Math.sin(angle) * distance
    
    const newNode = addNode(x, y)
    addConnection(parent.id, newNode.id)
    selectedNode.value = newNode
  }
}

const deleteSelectedNode = () => {
  if (selectedNode.value && nodes.length > 1) {
    const nodeId = selectedNode.value.id
    
    // Remove connections
    for (let i = connections.length - 1; i >= 0; i--) {
      if (connections[i].from === nodeId || connections[i].to === nodeId) {
        connections.splice(i, 1)
      }
    }
    
    // Remove node
    const index = nodes.findIndex(n => n.id === nodeId)
    if (index !== -1) {
      nodes.splice(index, 1)
    }
    
    selectedNode.value = null
    editingNode.value = null
    syncToDatamodel()
    draw()
  }
}

const updateNodeText = (text) => {
  if (selectedNode.value) {
    selectedNode.value.text = text
    syncToDatamodel()
    draw()
  }
}


const reorganizeLayout = () => {
  // Rebuild the layout based on current connections
  const nodeMap = new Map()
  const childrenMap = new Map()
  
  // Build node relationships
  nodes.forEach(node => {
    nodeMap.set(node.id, {
      id: node.id,
      text: node.text,
      isRoot: false,
      node: node
    })
    childrenMap.set(node.id, [])
  })
  
  // Determine parent-child relationships from connections
  connections.forEach(conn => {
    childrenMap.get(conn.from).push(conn.to)
  })
  
  // Find root nodes (nodes that are not children of anyone)
  const childIds = new Set(connections.map(c => c.to))
  const rootNodes = Array.from(nodeMap.values()).filter(n => !childIds.has(n.id))
  
  if (rootNodes.length === 0 && nodes.length > 0) {
    // If no root found, make first node the root
    rootNodes.push(nodeMap.get(nodes[0].id))
  }
  
  rootNodes.forEach(r => r.isRoot = true)
  
  // Calculate new positions
  const positions = calculateHierarchicalLayout(rootNodes, nodeMap, childrenMap)
  
  // Update node positions
  positions.forEach((pos, nodeId) => {
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      node.x = pos.x
      node.y = pos.y
    }
  })
  
  // Save new positions to datamodel
  syncToDatamodel()
  draw()
}

// Keyboard shortcuts
const handleKeyDown = (e) => {
  // Don't process shortcuts if editing
  if (editingNode.value) {
    if (e.key === 'Enter') {
      e.preventDefault()
      finishEditingNode()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditingNode()
    }
    return
  }
  
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedNode.value && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault()
      deleteSelectedNode()
    }
  } else if (e.key === 'Escape') {
    selectedNode.value = null
    draw()
  } else if (e.key === 'Enter' && e.shiftKey && selectedNode.value) {
    createChildNode()
  }
}

// Modal functions
const openEditModal = (nodeId) => {
  modalMode.value = 'edit'
  currentNodeId.value = nodeId
  currentParentId.value = null
  isModalOpen.value = true
}

const openAddModal = (parentId) => {
  modalMode.value = 'add'
  currentParentId.value = parentId
  currentNodeId.value = null
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const onSaveNode = () => {
  // Reload from datamodel after save
  loadFromDatamodel()
}

const onDeleteNode = () => {
  // Reload from datamodel after delete
  loadFromDatamodel()
}

// Tooltip functions
const showTooltip = (node, clientX, clientY) => {
  // Clear any existing timeout
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
  }
  
  // Set a delay before showing tooltip
  tooltipTimeout = setTimeout(() => {
    // Get node data from store
    const nodeData = factionStore.pyramid[node.id]
    
    if (nodeData) {
      tooltipContent.name = nodeData.name || node.text
      tooltipContent.role = nodeData.role || ''
      tooltipContent.description = nodeData.description || ''
    } else {
      tooltipContent.name = node.text
      tooltipContent.role = ''
      tooltipContent.description = ''
    }
    
    // Position tooltip near cursor
    tooltipPos.x = clientX + 15
    tooltipPos.y = clientY + 15
    tooltipVisible.value = true
  }, 500) // 500ms delay
}

const hideTooltip = () => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
    tooltipTimeout = null
  }
  tooltipVisible.value = false
}

</script>

<template>
  <div class="mindmap-container">
    <UpdateOrganizationNodePopupComponent 
      :isOpen="isModalOpen"
      :nodeId="currentNodeId"
      :parentId="currentParentId"
      :mode="modalMode"
      @close="closeModal"
      @save="onSaveNode"
      @delete="onDeleteNode"
    />
    <div class="toolbar">
      <div class="toolbar-section">
        <button @click="createChildNode" :disabled="!selectedNode" class="btn btn-primary">
          <span class="icon">+</span>
          Add Child Node
        </button>
        <button @click="deleteSelectedNode" :disabled="!selectedNode" class="btn btn-danger">
          <span class="icon">×</span>
          Delete Node
        </button>
        <button @click="reorganizeLayout" class="btn btn-secondary">
          <span class="icon">⚡</span>
          Auto Layout
        </button>
      </div>
      <div class="instructions">
        <div class="instruction-item">
          <kbd>Double Click</kbd> Edit/Create
        </div>
        <div class="instruction-item">
          <kbd>Shift + Click</kbd> Edit node
        </div>
        <div class="instruction-item">
          <kbd>Middle Click</kbd> Pan view
        </div>
        <div class="instruction-item">
          <kbd>Drag</kbd> Move nodes
        </div>
        <div class="instruction-item">
          <kbd>Shift+Enter</kbd> Add child
        </div>
        <div class="instruction-item">
          <kbd>Del</kbd> Delete
        </div>
      </div>
    </div>
    
    <div 
      ref="canvasContainer" 
      class="canvas-container"
    >
      <canvas
        ref="canvasRef"
        @mousedown="handleCanvasMouseDown"
        @mousemove="handleCanvasMouseMove"
        @mouseup="handleCanvasMouseUp"
        @mouseleave="handleCanvasMouseLeave"
        @dblclick="handleCanvasDoubleClick"
        @contextmenu.prevent
        :style="{ cursor: isPanning ? 'grabbing' : hoveredNode ? 'pointer' : 'default' }"
      ></canvas>
      
      <!-- Inline text editor -->
      <input
        v-if="editingNode"
        type="text"
        v-model="editText"
        @blur="finishEditingNode"
        @keydown.enter.prevent="finishEditingNode"
        @keydown.esc.prevent="cancelEditingNode"
        class="inline-editor"
        :style="{
          left: (editingNode.x + panOffset.x - editingNode.width / 2) + 'px',
          top: (editingNode.y + panOffset.y - editingNode.height / 2) + 'px',
          width: editingNode.width + 'px',
          height: editingNode.height + 'px'
        }"
        ref="inlineInput"
      />
      
      <!-- Tooltip -->
      <div
        v-if="tooltipVisible"
        class="tooltip"
        :style="{
          left: tooltipPos.x + 'px',
          top: tooltipPos.y + 'px'
        }"
      >
        <div class="tooltip-name">{{ tooltipContent.name }}</div>
        <div v-if="tooltipContent.role" class="tooltip-role">{{ tooltipContent.role }}</div>
        <div v-if="tooltipContent.description" class="tooltip-text">{{ tooltipContent.description }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mindmap-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  position: relative;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  gap: 1rem;
  flex-wrap: wrap;
}

.toolbar-section {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.instructions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: #64748b;
}

.instruction-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

kbd {
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #ffffff;
  color: #334155;
}

.btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border-color: #cbd5e1;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
}

.icon {
  font-size: 1.25rem;
  line-height: 1;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #ffffff;
  background-image: 
    linear-gradient(rgba(100, 116, 139, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(100, 116, 139, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
  width: 100%;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.inline-editor {
  position: absolute;
  padding: 0.5rem;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  font-family: Inter, system-ui, sans-serif;
  text-align: center;
  background: #2563eb;
  color: white;
  outline: none;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  z-index: 1000;
}

.inline-editor::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.tooltip {
  position: fixed;
  background: #1e293b;
  color: #ffffff;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  pointer-events: none;
  max-width: 300px;
  font-size: 0.875rem;
  line-height: 1.5;
}

.tooltip-name {
  font-weight: bold;
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.tooltip-role {
  color: #94a3b8;
  font-style: italic;
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
}

.tooltip-text {
  color: #cbd5e1;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #475569;
}
</style>
