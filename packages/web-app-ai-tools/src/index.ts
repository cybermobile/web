import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { RouteRecordRaw } from 'vue-router'
import { ApplicationInformation, defineWebApplication } from '@opencloud-eu/web-pkg'
import { APPID } from './appid'

function complianceRedirect(tab?: string | string[]) {
  const segment = Array.isArray(tab) ? tab[0] : tab

  return segment ? `/compliance/${segment}` : '/compliance'
}

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo: ApplicationInformation = {
      id: APPID,
      name: $gettext('AI Tools'),
      icon: 'magic-line',
      color: '#0D856F'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        redirect: '/ai-chat'
      },
      {
        path: '/organizer',
        redirect: '/file-organizer'
      },
      {
        path: '/sync',
        redirect: '/cloud-sync'
      },
      {
        path: '/confluence',
        redirect: '/confluence'
      },
      {
        path: '/chat',
        redirect: '/ai-chat'
      },
      {
        path: '/compliance/:tab?',
        redirect: (to) => complianceRedirect(to.params.tab)
      }
    ]

    return {
      appInfo,
      routes,
      translations
    }
  }
})
