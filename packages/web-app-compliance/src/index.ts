import translations from '../l10n/translations.json'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { RouteRecordRaw } from 'vue-router'
import {
  AppMenuItemExtension,
  ApplicationInformation,
  defineWebApplication,
  Extension
} from '@opencloud-eu/web-pkg'
import { APPID } from './appid'

function extensions(appInfo: ApplicationInformation) {
  return computed<Extension[]>(() => {
    const menuItem: AppMenuItemExtension = {
      id: `app.${appInfo.id}.menuItem`,
      type: 'appMenuItem',
      label: () => appInfo.name,
      color: appInfo.color,
      icon: appInfo.icon,
      path: `/${appInfo.id}`
    }

    return [menuItem]
  })
}

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo: ApplicationInformation = {
      id: APPID,
      name: $gettext('Compliance'),
      icon: 'shield-check-line',
      color: '#0D856F'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/:tab?',
        name: 'compliance',
        component: () => import('./views/CompliancePage.vue'),
        meta: { authContext: 'user', title: $gettext('Compliance') }
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
