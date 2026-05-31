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
      name: $gettext('Cloud Sync'),
      icon: 'cloud-line',
      color: '#0D856F'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        name: 'cloud-sync',
        redirect: '/cloud-sync/providers',
        meta: { authContext: 'user', title: $gettext('Cloud Sync') }
      },
      {
        path: '/providers',
        name: 'cloud-sync-providers',
        component: () => import('./views/RclonePage.vue'),
        meta: { authContext: 'user', title: $gettext('Cloud Sync') }
      },
      {
        path: '/sync',
        name: 'cloud-sync-sync',
        redirect: '/cloud-sync/sync/jobs',
        meta: { authContext: 'user', title: $gettext('Sync Jobs') }
      },
      {
        path: '/sync/jobs',
        name: 'cloud-sync-sync-jobs',
        component: () => import('./views/RclonePage.vue'),
        meta: { authContext: 'user', title: $gettext('Sync Jobs') }
      },
      {
        path: '/sync/history',
        name: 'cloud-sync-sync-history',
        component: () => import('./views/RclonePage.vue'),
        meta: { authContext: 'user', title: $gettext('Sync Run History') }
      },
      {
        path: '/confluence',
        name: 'cloud-sync-confluence',
        redirect: '/cloud-sync/confluence/connections',
        meta: { authContext: 'user', title: $gettext('Confluence Importer') }
      },
      {
        path: '/confluence/connections',
        name: 'cloud-sync-confluence-connections',
        component: () => import('./views/ConfluencePage.vue'),
        meta: { authContext: 'user', title: $gettext('Confluence Connections') }
      },
      {
        path: '/confluence/jobs',
        name: 'cloud-sync-confluence-jobs',
        component: () => import('./views/ConfluencePage.vue'),
        meta: { authContext: 'user', title: $gettext('Confluence Import Jobs') }
      },
      {
        path: '/confluence/history',
        name: 'cloud-sync-confluence-history',
        component: () => import('./views/ConfluencePage.vue'),
        meta: { authContext: 'user', title: $gettext('Confluence Run History') }
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
