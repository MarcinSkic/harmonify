import { createPinia } from 'pinia'

import { createApp } from 'vue'
import App from './pages/App.vue'

import router from './router'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
