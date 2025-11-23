import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/base.css'
import '@/assets/main.scss'
// 初始化 alova 实例
import '@/utils/alova'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
