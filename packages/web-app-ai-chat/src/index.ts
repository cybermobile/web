import translations from '../l10n/translations.json'
import { computed, markRaw } from 'vue'
import { useGettext } from 'vue3-gettext'
import { RouteRecordRaw } from 'vue-router'
import {
  ApplicationInformation,
  CustomComponentExtension,
  defineWebApplication,
  Extension
} from '@opencloud-eu/web-pkg'
import { APPID } from './appid'
import ChatWidget from './components/chat/ChatWidget.vue'

function extensions(appInfo: ApplicationInformation) {
  return computed<Extension[]>(() => {
    const chatWidget: CustomComponentExtension = {
      id: `app.${appInfo.id}.chat-widget`,
      type: 'customComponent',
      extensionPointIds: ['app.runtime.header.right'],
      content: markRaw(ChatWidget)
    }

    return [chatWidget]
  })
}

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo: ApplicationInformation = {
      id: APPID,
      name: $gettext('AI Chat'),
      icon: 'magic-line',
      color: '#0D856F'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        name: 'ai-chat',
        component: () => import('./views/ChatPage.vue'),
        meta: { authContext: 'user', title: $gettext('AI Chat') }
      }
    ]

    return {
      appInfo,
      routes,
      translations,
      extensions: extensions(appInfo)
    }
  }
})
