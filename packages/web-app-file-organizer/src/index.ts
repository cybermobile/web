import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { RouteRecordRaw } from 'vue-router'
import { ApplicationInformation, defineWebApplication } from '@opencloud-eu/web-pkg'
import { APPID } from './appid'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo: ApplicationInformation = {
      id: APPID,
      name: $gettext('File Organizer'),
      icon: 'folder-settings-line',
      color: '#0D856F'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        name: 'file-organizer',
        redirect: '/files/organizer',
        meta: { authContext: 'user', title: $gettext('File Organizer') }
      }
    ]

    return {
      appInfo,
      routes,
      translations
    }
  }
})
