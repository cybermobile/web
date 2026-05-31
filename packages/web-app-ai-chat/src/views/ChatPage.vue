<template>
  <div class="chat-page">
    <ChatPanelSdk />
  </div>
</template>

<script setup lang="ts">
import ChatPanelSdk from '../components/chat/ChatPanelSdk.vue'
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 24px 0;
  box-sizing: border-box;
}
</style>
